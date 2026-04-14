/**
 * CI guard: asserts every name in a `Key Exports` cell of any
 * libs-*\/SKILL.md resolves to a public export of the corresponding library.
 *
 * Strict-positive only — advertised names must exist; unadvertised library
 * exports are fine. Mirrors the intent of spec 390's check-exports pattern.
 *
 * Usage: node scripts/check-skill-exports.js
 * Exit:  0 on success, 1 on any missing export
 */

import { readFileSync, existsSync } from "node:fs";
import { globSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

// ── Regex patterns ───────────────────────────────────────────────────────────
// eslint-disable-next-line security/detect-unsafe-regex -- runs on trusted library source files, not user input
const RE_EXPORT_FUNCTION = /export +(async +)?function +(\w+)/g;
const RE_EXPORT_CLASS = /export +class +(\w+)/g;
const RE_EXPORT_VAR = /export +(?:const|let|var) +(\w+)/g;
const RE_EXPORT_DEFAULT = /export +default\b/;
// eslint-disable-next-line security/detect-unsafe-regex -- runs on trusted library source files, not user input
const RE_EXPORT_NAMED = /export +\{([\s\S]*?)\}( *from *["']([^"']+)["'])?/g;
const RE_EXPORT_STAR = /export +\* +from +["']([^"']+)["']/g;

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseSkillTable(content) {
  const lines = content.split("\n");
  let inTable = false;
  let headerFound = false;
  const rows = [];

  for (const line of lines) {
    if (line.startsWith("## Libraries")) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;

    if (line.startsWith("| Library")) {
      headerFound = true;
      continue;
    }
    if (!headerFound) continue;

    // Separator row
    if (/^\| *-+/.test(line)) continue;

    // End of table
    if (!line.startsWith("|")) break;

    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 3) continue;

    const library = cells[0];
    const keyExportsRaw = cells[2];
    const keyExports = keyExportsRaw
      .split(",")
      .map((name) => name.trim().replace(/`/g, ""))
      .filter(Boolean);

    rows.push({ library, keyExports });
  }

  return rows;
}

function readSource(filePath) {
  const abs = resolve(filePath);
  let actualPath = abs;
  if (!existsSync(actualPath) && !actualPath.endsWith(".js")) {
    actualPath = actualPath + ".js";
  }
  if (!existsSync(actualPath)) return null;
  return { path: actualPath, content: readFileSync(actualPath, "utf-8") };
}

function addDirectExports(source, names) {
  for (const m of source.matchAll(RE_EXPORT_FUNCTION)) names.add(m[2]);
  for (const m of source.matchAll(RE_EXPORT_CLASS)) names.add(m[1]);
  for (const m of source.matchAll(RE_EXPORT_VAR)) names.add(m[1]);
  if (RE_EXPORT_DEFAULT.test(source)) names.add("default");
}

function parseNamedBlock(block) {
  return block
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => {
      const parts = item.split(/ +as +/);
      return (parts.length > 1 ? parts[1] : parts[0]).trim();
    })
    .filter(Boolean);
}

function collectExports(filePath, visited = new Set()) {
  const abs = resolve(filePath);
  if (visited.has(abs)) return new Set();
  visited.add(abs);

  const file = readSource(filePath);
  if (!file) return new Set();

  const names = new Set();
  const dir = dirname(file.path);

  addDirectExports(file.content, names);

  for (const m of file.content.matchAll(RE_EXPORT_NAMED)) {
    for (const name of parseNamedBlock(m[1])) names.add(name);
    if (m[3]) {
      const target = resolveImportPath(m[3], dir);
      if (target) {
        for (const n of collectExports(target, visited)) names.add(n);
      }
    }
  }

  for (const m of file.content.matchAll(RE_EXPORT_STAR)) {
    const target = resolveImportPath(m[1], dir);
    if (target) {
      for (const n of collectExports(target, visited)) names.add(n);
    }
  }

  return names;
}

function resolveImportPath(specifier, fromDir) {
  if (specifier.startsWith(".")) {
    let resolved = resolve(fromDir, specifier);
    if (!existsSync(resolved) && !resolved.endsWith(".js")) {
      resolved += ".js";
    }
    return existsSync(resolved) ? resolved : null;
  }

  if (specifier.startsWith("@forwardimpact/")) {
    const pkgName = specifier.replace("@forwardimpact/", "");
    const indexPath = join(resolve("libraries", pkgName), "src", "index.js");
    return existsSync(indexPath) ? indexPath : null;
  }

  return null;
}

function getLibraryExports(libName) {
  const libDir = resolve("libraries", libName);
  const pkgPath = join(libDir, "package.json");

  if (!existsSync(pkgPath)) {
    return { exports: new Set(), error: `package.json not found: ${pkgPath}` };
  }

  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const allExports = new Set();

  if (pkg.main) {
    const mainPath = resolve(libDir, pkg.main);
    for (const n of collectExports(mainPath)) allExports.add(n);
  }

  if (pkg.exports) {
    walkExportsMap(pkg.exports, libDir, allExports);
  }

  if (!pkg.main && !pkg.exports) {
    const fallback = join(libDir, "src", "index.js");
    if (existsSync(fallback)) {
      for (const n of collectExports(fallback)) allExports.add(n);
    }
  }

  return { exports: allExports, error: null };
}

function walkExportsMap(exportsObj, libDir, allExports) {
  if (typeof exportsObj === "string") {
    if (exportsObj.includes("*")) return;
    if (!/\.m?js$/.test(exportsObj)) return;
    const filePath = resolve(libDir, exportsObj);
    for (const n of collectExports(filePath)) allExports.add(n);
    return;
  }

  if (typeof exportsObj === "object" && exportsObj !== null) {
    for (const [key, value] of Object.entries(exportsObj)) {
      if (key.includes("*")) continue;
      walkExportsMap(value, libDir, allExports);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

const skillFiles = globSync(".claude/skills/libs-*/SKILL.md");
let totalFiles = 0;
let totalRows = 0;
let totalExports = 0;
let failures = 0;

for (const skillFile of skillFiles) {
  totalFiles++;
  const content = readFileSync(skillFile, "utf-8");
  const rows = parseSkillTable(content);

  for (const { library, keyExports } of rows) {
    totalRows++;
    const { exports: libExports, error } = getLibraryExports(library);

    if (error) {
      console.error(`${skillFile}: ${library} — ${error}`);
      failures++;
      continue;
    }

    for (const name of keyExports) {
      totalExports++;
      if (!libExports.has(name)) {
        console.error(
          `${skillFile}: ${library}.${name} is not a public export`,
        );
        console.error(
          `  available exports: ${[...libExports].sort().join(", ")}`,
        );
        console.error(
          `  Fix: update the Key Exports cell in ${skillFile} to match, or restore the export.`,
        );
        failures++;
      }
    }
  }
}

if (failures > 0) {
  console.error(
    `\nChecked ${totalFiles} libs-* skill files, ${totalRows} library rows, ${totalExports} key exports.`,
  );
  console.error(`${failures} missing.`);
  process.exit(1);
} else {
  console.log(
    `Checked ${totalFiles} libs-* skill files, ${totalRows} library rows, ${totalExports} key exports. All resolve.`,
  );
}

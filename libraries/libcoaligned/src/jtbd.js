import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as prettier from "prettier";

const VALID_USERS = [
  "Engineering Leaders",
  "Empowered Engineers",
  "Platform Builders",
  "Teams Using Agents",
];

const USER_ORDER = new Map(VALID_USERS.map((u, i) => [u, i]));

function catalogs(root) {
  return [
    {
      name: "products",
      dir: join(root, "products"),
      readme: join(root, "products", "README.md"),
      filter: (name) => !name.startsWith(".") && name !== "node_modules",
      column: "Product",
      skipUniqueHires: true,
    },
    {
      name: "services",
      dir: join(root, "services"),
      readme: join(root, "services", "README.md"),
      filter: (name) => !name.startsWith(".") && name !== "node_modules",
      column: "Service",
    },
    {
      name: "libraries",
      dir: join(root, "libraries"),
      readme: join(root, "libraries", "README.md"),
      filter: (name) => name.startsWith("lib"),
      column: "Library",
    },
  ];
}

function loadPackages(dir, filter) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    if (!filter(name)) continue;
    const pkgPath = join(dir, name, "package.json");
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    } catch {
      continue;
    }
    out.push({ dir: name, pkg });
  }
  return out.sort((a, b) => a.dir.localeCompare(b.dir));
}

function validateEntry(entry, ctx) {
  const findings = [];
  const slot = `.jobs[${ctx.index}]`;
  if (!(entry.user && VALID_USERS.includes(entry.user))) {
    findings.push({
      id: "jtbd.invalid-user",
      level: "fail",
      path: ctx.pkgPath,
      message: `${slot}: invalid user "${entry.user}"`,
      hint: `must be one of: ${VALID_USERS.join(", ")}`,
    });
  }
  for (const field of ["goal", "trigger", "competesWith"]) {
    if (!entry[field] || typeof entry[field] !== "string") {
      findings.push({
        id: "jtbd.missing-field",
        level: "fail",
        path: ctx.pkgPath,
        message: `${slot}: ${field} is required and must be a string`,
        hint: `add a non-empty ${field} string to the job entry`,
      });
    }
  }
  for (const field of ["bigHire", "littleHire"]) {
    if (!entry[field] || typeof entry[field] !== "string") {
      findings.push({
        id: "jtbd.missing-field",
        level: "fail",
        path: ctx.pkgPath,
        message: `${slot}: ${field} is required and must be a string`,
        hint: `add a non-empty ${field} string ending in "."`,
      });
    } else if (!entry[field].endsWith(".")) {
      findings.push({
        id: "jtbd.hire-missing-period",
        level: "fail",
        path: ctx.pkgPath,
        message: `${slot}: ${field} must end with "." — "${entry[field]}"`,
        hint: `append a period to the ${field} sentence`,
      });
    }
  }
  return findings;
}

function checkHireUniqueness(entry, ctx, allHires) {
  const findings = [];
  const slot = `.jobs[${ctx.index}]`;
  for (const field of ["bigHire", "littleHire"]) {
    if (!entry[field] || typeof entry[field] !== "string") continue;
    const key = `${field}:${entry[field].toLowerCase()}`;
    if (allHires.has(key) && allHires.get(key).goal !== entry.goal) {
      findings.push({
        id: "jtbd.duplicate-hire",
        level: "fail",
        path: ctx.pkgPath,
        message: `${slot}: duplicate ${field} "${entry[field]}" (also in ${allHires.get(key).loc})`,
        hint: `merge the duplicate job into a single entry, or differentiate the ${field} text`,
      });
    }
    allHires.set(key, { loc: ctx.loc, goal: entry.goal });
  }
  return findings;
}

function validate(
  packages,
  catalogDir,
  catalogName,
  { skipUniqueHires = false } = {},
) {
  const allHires = new Map();
  const findings = [];
  for (const { dir, pkg } of packages) {
    const pkgPath = join(catalogDir, dir, "package.json");
    const jobs = pkg.jobs;
    if (!jobs) continue;
    if (!Array.isArray(jobs)) {
      findings.push({
        id: "jtbd.jobs-must-be-array",
        level: "fail",
        path: pkgPath,
        message: ".jobs must be an array",
        hint: "wrap the value in [] — even a single job is an array of one",
      });
      continue;
    }
    const loc = `${catalogName}/${dir}`;
    for (let i = 0; i < jobs.length; i++) {
      const entry = jobs[i];
      const ctx = { pkgPath, index: i, loc };
      findings.push(...validateEntry(entry, ctx));
      if (!skipUniqueHires) {
        findings.push(...checkHireUniqueness(entry, ctx, allHires));
      }
    }
  }
  return findings;
}

function renderTable(headers, rows) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length)),
  );
  const line = (cells) =>
    `| ${cells.map((c, i) => c.padEnd(widths[i])).join(" | ")} |`;
  return [
    line(headers),
    line(widths.map((w) => "-".repeat(w))),
    ...rows.map(line),
  ].join("\n");
}

function findMarker(content, tag) {
  const pattern = new RegExp(`<!--\\s*${tag}[^>]*-->`);
  const match = content.match(pattern);
  if (!match) return null;
  return { text: match[0], index: match.index };
}

function replaceBlock(content, beginTag, endTag, body) {
  const begin = findMarker(content, beginTag);
  const end = findMarker(content, endTag);
  if (!(begin && end) || end.index < begin.index) return null;
  return (
    content.slice(0, begin.index) +
    `${begin.text}\n\n${body}\n\n${end.text}` +
    content.slice(end.index + end.text.length)
  );
}

function mergeTriggers(triggers) {
  const stripped = triggers.map((t) => t.replace(/\.\s*$/, "").trim());
  const unique = [...new Set(stripped)];
  const parts = unique.map((s, i) =>
    i > 0 ? s.charAt(0).toLowerCase() + s.slice(1) : s,
  );
  return parts.join("; ") + ".";
}

function mergeCompetesWith(fragments) {
  if (fragments.length === 0) return null;
  const seen = new Set();
  const unique = [];
  for (const f of fragments) {
    const normalized = f.replace(/\.\s*$/, "").trim();
    const key = normalized.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(normalized);
    }
  }
  return unique.join("; ") + ".";
}

function mergeHireField(entries, capitalize) {
  if (entries.length === 0) return null;
  const stripped = entries.map((e) => e.text.replace(/\.\s*$/, "").trim());
  const unique = [...new Set(stripped)];
  const parts = unique.map((s, i) =>
    i > 0 ? s.charAt(0).toLowerCase() + s.slice(1) : s,
  );
  const pkgs = [...new Set(entries.map((e) => e.pkg))];
  const names = pkgs.map((p) =>
    capitalize ? p.charAt(0).toUpperCase() + p.slice(1) : p,
  );
  return `Help me ${parts.join("; ")}. → **${names.join(", ")}**`;
}

function addEntryToGroup(group, entry, dir) {
  if (entry.trigger) group.triggers.push(entry.trigger);
  if (entry.bigHire) group.bigHires.push({ text: entry.bigHire, pkg: dir });
  if (entry.littleHire)
    group.littleHires.push({ text: entry.littleHire, pkg: dir });
  if (entry.competesWith) {
    for (const fragment of entry.competesWith.split(";")) {
      const trimmed = fragment.trim();
      if (trimmed) group.competesWith.push(trimmed);
    }
  }
  if (entry.forces && !group.forces) group.forces = entry.forces;
  if (entry.firedWhen && !group.firedWhen) group.firedWhen = entry.firedWhen;
}

function collectJobGroups(packages) {
  const groups = new Map();
  for (const { dir, pkg } of packages) {
    if (!pkg.jobs) continue;
    for (const entry of pkg.jobs) {
      const key = `${entry.user}\0${entry.goal}`;
      if (!groups.has(key)) {
        groups.set(key, {
          user: entry.user,
          goal: entry.goal,
          triggers: [],
          bigHires: [],
          littleHires: [],
          competesWith: [],
          forces: null,
          firedWhen: null,
        });
      }
      addEntryToGroup(groups.get(key), entry, dir);
    }
  }
  return groups;
}

function buildJobProse(group, capitalize) {
  const trigger = mergeTriggers(group.triggers);
  const competesWith = mergeCompetesWith(group.competesWith);
  const bigHire = mergeHireField(group.bigHires, capitalize);
  const littleHire = mergeHireField(group.littleHires, capitalize);

  const lines = [
    `## ${group.user}: ${group.goal}`,
    "",
    `**Trigger:** ${trigger}`,
  ];
  if (bigHire) lines.push("", `**Big Hire:** ${bigHire}`);
  if (littleHire) lines.push("", `**Little Hire:** ${littleHire}`);
  lines.push("", `**Competes With:** ${competesWith}`);

  if (group.forces) {
    lines.push(
      "",
      "**Forces:**",
      `- **Push:** ${group.forces.push}`,
      `- **Pull:** ${group.forces.pull}`,
      `- **Habit:** ${group.forces.habit}`,
      `- **Anxiety:** ${group.forces.anxiety}`,
    );
  }
  if (group.firedWhen) lines.push("", `**Fired When:** ${group.firedWhen}`);
  return lines.join("\n");
}

function makeFormatter(prettierConfig) {
  return async function formatMarkdown(text) {
    const formatted = await prettier.format(text, {
      ...prettierConfig,
      parser: "markdown",
    });
    // Prettier inserts a blank line between bold labels and bullet lists;
    // remove it to match the hand-written JTBD.md style.
    return formatted.replace(/\*\*\n\n(- )/g, "**\n$1").trimEnd();
  };
}

async function buildCatalog(content, packages, column, formatMarkdown) {
  const rows = packages
    .filter(({ pkg }) => pkg.description)
    .map(({ dir, pkg }) => [`**${dir}**`, pkg.description]);
  if (rows.length === 0) return content;
  const body = await formatMarkdown(renderTable([column, "Description"], rows));
  return replaceBlock(content, "BEGIN:catalog", "END:catalog", body) ?? content;
}

async function buildJobs(
  content,
  packages,
  formatMarkdown,
  { capitalize = false } = {},
) {
  const groups = collectJobGroups(packages);
  if (groups.size === 0) return content;

  const sorted = [...groups.values()].sort((a, b) => {
    const ua = USER_ORDER.get(a.user) ?? 99;
    const ub = USER_ORDER.get(b.user) ?? 99;
    if (ua !== ub) return ua - ub;
    return a.goal.localeCompare(b.goal);
  });

  const blocks = await Promise.all(
    sorted.map(async (group) => {
      const formatted = await formatMarkdown(buildJobProse(group, capitalize));
      return `<job user="${group.user}" goal="${group.goal}">\n\n${formatted}\n\n</job>`;
    }),
  );

  const body = blocks.join("\n\n");
  return replaceBlock(content, "BEGIN:jobs", "END:jobs", body) ?? content;
}

async function buildDescription(content, description, formatMarkdown) {
  const formatted = await formatMarkdown(description);
  const result = replaceBlock(
    content,
    "BEGIN:description",
    "END:description",
    formatted,
  );
  if (result !== null) return result;

  const headingMatch = content.match(/^# .+\n/);
  if (!headingMatch) return null;
  const headingEnd = headingMatch[0].length;
  const nextSection = content.indexOf("\n\n## ", headingEnd);
  const descEnd = nextSection !== -1 ? nextSection : content.length;

  const begin =
    "<!-- BEGIN:description — Do not edit. Generated from package.json. -->";
  const end = "<!-- END:description -->";

  return (
    content.slice(0, headingEnd) +
    `\n${begin}\n\n${formatted}\n\n${end}` +
    content.slice(descEnd)
  );
}

function commitUpdate(filePath, label, original, updated, fix, result) {
  if (updated === null || updated === original) return;
  if (!fix) {
    result.stale.push(label);
    return;
  }
  writeFileSync(filePath, updated);
  result.fixed.push(label);
}

async function processCatalog(catalog, fix, formatMarkdown, result) {
  const packages = loadPackages(catalog.dir, catalog.filter);
  const findings = validate(packages, catalog.dir, catalog.name, {
    skipUniqueHires: catalog.skipUniqueHires ?? false,
  });
  if (findings.length > 0) {
    result.findings.push(...findings);
    return;
  }

  if (existsSync(catalog.readme)) {
    const original = readFileSync(catalog.readme, "utf8");
    let content = original;
    content = await buildCatalog(
      content,
      packages,
      catalog.column,
      formatMarkdown,
    );
    content = await buildJobs(content, packages, formatMarkdown);
    commitUpdate(
      catalog.readme,
      `${catalog.name}/README.md`,
      original,
      content,
      fix,
      result,
    );
  }

  for (const { dir, pkg } of packages) {
    if (!pkg.description) continue;
    const pkgReadme = join(catalog.dir, dir, "README.md");
    if (!existsSync(pkgReadme)) continue;
    const original = readFileSync(pkgReadme, "utf8");
    const updated = await buildDescription(
      original,
      pkg.description,
      formatMarkdown,
    );
    commitUpdate(
      pkgReadme,
      `${catalog.name}/${dir}/README.md`,
      original,
      updated,
      fix,
      result,
    );
  }
}

async function processJtbdMd(root, fix, formatMarkdown, result) {
  const jtbdPath = join(root, "JTBD.md");
  if (!existsSync(jtbdPath)) return;
  const productsCatalog = catalogs(root).find((c) => c.name === "products");
  const packages = loadPackages(productsCatalog.dir, productsCatalog.filter);
  const findings = validate(packages, productsCatalog.dir, "products", {
    skipUniqueHires: true,
  });
  if (findings.length > 0) {
    if (result.findings.length === 0) result.findings.push(...findings);
    return;
  }
  const original = readFileSync(jtbdPath, "utf8");
  const updated = await buildJobs(original, packages, formatMarkdown, {
    capitalize: true,
  });
  commitUpdate(jtbdPath, "JTBD.md", original, updated, fix, result);
}

/**
 * Validate every `package.json .jobs` entry under products/, services/, and
 * libraries/, and (when `fix` is true) regenerate the marker-delimited catalog,
 * jobs, and description blocks in the corresponding README.md and JTBD.md.
 *
 * @param {{ root: string, fix?: boolean }} options
 * @returns {Promise<{ findings: Finding[], stale: string[], fixed: string[] }>}
 *   `findings` are validation failures (structured for `emitFindingsText` /
 *   `emitFindingsJson` from libutil); `stale` is files whose generated blocks
 *   are out of date (only populated when `fix` is false); `fixed` is files
 *   that were rewritten in place.
 */
export async function checkJtbd({ root, fix = false }) {
  const result = { findings: [], stale: [], fixed: [] };
  const prettierConfig = await prettier.resolveConfig(join(root, "JTBD.md"));
  const formatMarkdown = makeFormatter(prettierConfig);

  for (const catalog of catalogs(root)) {
    await processCatalog(catalog, fix, formatMarkdown, result);
  }
  await processJtbdMd(root, fix, formatMarkdown, result);

  return result;
}

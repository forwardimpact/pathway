#!/usr/bin/env node
// Render or check catalog tables in libraries/README.md and services/README.md.
// Source of truth: each package's package.json (forwardimpact.capability + description + needs).
//
// Usage: check-catalog.mjs [capabilities|needs] [--fix] [--dir libraries|services]
//
//   check-catalog.mjs                            # check both catalogs
//   check-catalog.mjs capabilities               # check capability tables in both
//   check-catalog.mjs --fix                      # regenerate both
//   check-catalog.mjs --dir services --fix       # regenerate services catalog only

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const CAPABILITY_CATEGORIES = [
  "agent-capability",
  "agent-retrieval",
  "agent-self-improvement",
  "agent-infrastructure",
  "foundations",
];

const CATALOGS = [
  {
    name: "libraries",
    dir: join(ROOT, "libraries"),
    readme: join(ROOT, "libraries", "README.md"),
    filter: (name) => name.startsWith("lib"),
    column: "Library",
  },
  {
    name: "services",
    dir: join(ROOT, "services"),
    readme: join(ROOT, "services", "README.md"),
    filter: (name) => !name.startsWith(".") && name !== "node_modules",
    column: "Service",
  },
];

function loadPackages(dir, filter) {
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

function replaceBlock(content, begin, end, body) {
  const beginIdx = content.indexOf(begin);
  const endIdx = content.indexOf(end);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    throw new Error(`Marker pair not found: ${begin} / ${end}`);
  }
  return (
    content.slice(0, beginIdx) +
    `${begin}\n\n${body}\n\n${end}` +
    content.slice(endIdx + end.length)
  );
}

function buildCapabilities(content, packages, column) {
  for (const { dir, pkg } of packages) {
    const cap = pkg.forwardimpact?.capability;
    if (!cap) {
      throw new Error(`${dir}/package.json: missing forwardimpact.capability`);
    }
    if (!CAPABILITY_CATEGORIES.includes(cap)) {
      throw new Error(`${dir}/package.json: unknown capability "${cap}"`);
    }
    if (!pkg.description) {
      throw new Error(`${dir}/package.json: missing description`);
    }
  }
  for (const cap of CAPABILITY_CATEGORIES) {
    const begin = `<!-- BEGIN:capability:${cap} -->`;
    const end = `<!-- END:capability:${cap} -->`;
    if (!content.includes(begin) || !content.includes(end)) continue;

    const rows = packages
      .filter(({ pkg }) => pkg.forwardimpact?.capability === cap)
      .map(({ dir, pkg }) => [`**${dir}**`, pkg.description]);
    if (rows.length === 0) {
      throw new Error(
        `No packages categorized as "${cap}" but markers exist in README`,
      );
    }
    content = replaceBlock(
      content,
      begin,
      end,
      renderTable([column, "Capability"], rows),
    );
  }
  return content;
}

function buildNeeds(content, packages, column) {
  const begin = "<!-- BEGIN:needs -->";
  const end = "<!-- END:needs -->";
  if (!content.includes(begin) || !content.includes(end)) return content;

  const seen = new Map();
  const rows = [];
  for (const { dir, pkg } of packages) {
    for (const need of pkg.forwardimpact?.needs ?? []) {
      if (seen.has(need)) {
        throw new Error(
          `Duplicate need "${need}" claimed by ${seen.get(need)} and ${dir}`,
        );
      }
      seen.set(need, dir);
      rows.push([need, `\`${dir}\``]);
    }
  }
  if (rows.length === 0) {
    throw new Error("No forwardimpact.needs entries found.");
  }
  rows.sort((a, b) => a[0].localeCompare(b[0]));
  return replaceBlock(
    content,
    begin,
    end,
    renderTable(["I need to…", column], rows),
  );
}

const TARGETS = {
  capabilities: { build: buildCapabilities, label: "capability tables" },
  needs: { build: buildNeeds, label: "needs table" },
};

const args = process.argv.slice(2);
const fix = args.includes("--fix");
const dirIdx = args.indexOf("--dir");
const dirFilter = dirIdx !== -1 ? args[dirIdx + 1] : null;
const positional = args.filter(
  (a, i) => !a.startsWith("--") && i !== dirIdx + 1,
);

if (positional.length > 1) {
  console.error(
    "usage: check-catalog.mjs [capabilities|needs] [--fix] [--dir libraries|services]",
  );
  process.exit(2);
}

const targets = positional.length === 0 ? Object.keys(TARGETS) : positional;
for (const target of targets) {
  if (!TARGETS[target]) {
    console.error(`unknown target "${target}". expected: capabilities|needs`);
    process.exit(2);
  }
}

const catalogs = dirFilter
  ? CATALOGS.filter((c) => c.name === dirFilter)
  : CATALOGS;

if (catalogs.length === 0) {
  console.error(
    `unknown catalog "${dirFilter}". expected: ${CATALOGS.map((c) => c.name).join("|")}`,
  );
  process.exit(2);
}

let stale = false;

for (const catalog of catalogs) {
  if (!existsSync(catalog.readme)) continue;
  const packages = loadPackages(catalog.dir, catalog.filter);

  for (const target of targets) {
    const config = TARGETS[target];
    const original = readFileSync(catalog.readme, "utf8");
    const content = config.build(original, packages, catalog.column);

    if (content === original) {
      if (fix) {
        console.log(
          `${catalog.name}/README.md ${config.label} already up to date.`,
        );
      }
      continue;
    }

    if (!fix) {
      console.error(
        `${catalog.name}/README.md ${config.label} out of date. Run \`bun run context:fix\` to regenerate.`,
      );
      stale = true;
      continue;
    }

    writeFileSync(catalog.readme, content);
    console.log(`Regenerated ${config.label} in ${catalog.name}/README.md.`);
  }
}

process.exit(stale ? 1 : 0);

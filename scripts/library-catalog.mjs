#!/usr/bin/env node
// Render or check the library catalog tables in libraries/README.md.
// Source of truth: each libraries/<lib>/package.json.
//
// Usage: library-catalog.mjs [capabilities|needs] [--fix]
//
//   library-catalog.mjs                            # check both tables
//   library-catalog.mjs capabilities               # check one table
//   library-catalog.mjs --fix                      # regenerate both
//   library-catalog.mjs capabilities --fix         # regenerate one

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const LIB_DIR = join(ROOT, "libraries");
const README = join(LIB_DIR, "README.md");

const CAPABILITY_CATEGORIES = [
  "agent-capability",
  "agent-retrieval",
  "agent-self-improvement",
  "agent-infrastructure",
  "foundations",
];

function loadPackages() {
  const out = [];
  for (const dir of readdirSync(LIB_DIR)) {
    if (!dir.startsWith("lib")) continue;
    const pkgPath = join(LIB_DIR, dir, "package.json");
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    } catch {
      continue;
    }
    out.push({ dir, pkg });
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

function buildCapabilities(content, packages) {
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
    const rows = packages
      .filter(({ pkg }) => pkg.forwardimpact?.capability === cap)
      .map(({ dir, pkg }) => [`**${dir}**`, pkg.description]);
    if (rows.length === 0) {
      throw new Error(`No libraries categorized as "${cap}"`);
    }
    content = replaceBlock(
      content,
      `<!-- BEGIN:capability:${cap} -->`,
      `<!-- END:capability:${cap} -->`,
      renderTable(["Library", "Capability"], rows),
    );
  }
  return content;
}

function buildNeeds(content, packages) {
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
    throw new Error("No forwardimpact.needs entries found across libraries.");
  }
  rows.sort((a, b) => a[0].localeCompare(b[0]));
  return replaceBlock(
    content,
    "<!-- BEGIN:needs -->",
    "<!-- END:needs -->",
    renderTable(["I need to…", "Library"], rows),
  );
}

const TARGETS = {
  capabilities: { build: buildCapabilities, label: "capability tables" },
  needs: { build: buildNeeds, label: "needs table" },
};

const args = process.argv.slice(2);
const fix = args.includes("--fix");
const positional = args.filter((a) => !a.startsWith("--"));

if (positional.length > 1) {
  console.error(`usage: library-catalog.mjs [capabilities|needs] [--fix]`);
  process.exit(2);
}

const targets = positional.length === 0 ? Object.keys(TARGETS) : positional;
for (const target of targets) {
  if (!TARGETS[target]) {
    console.error(`unknown target "${target}". expected: capabilities|needs`);
    process.exit(2);
  }
}

const packages = loadPackages();
let stale = false;

for (const target of targets) {
  const config = TARGETS[target];
  const original = readFileSync(README, "utf8");
  const content = config.build(original, packages);

  if (content === original) {
    if (fix) {
      console.log(`libraries/README.md ${config.label} already up to date.`);
    }
    continue;
  }

  if (!fix) {
    console.error(
      `libraries/README.md ${config.label} out of date. Run \`bun run lib:fix\` to regenerate.`,
    );
    stale = true;
    continue;
  }

  writeFileSync(README, content);
  console.log(`Regenerated ${config.label} in libraries/README.md.`);
}

process.exit(stale ? 1 : 0);

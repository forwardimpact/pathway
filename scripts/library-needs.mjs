#!/usr/bin/env node
// Render or check the "I need to..." table in libraries/README.md.
// Source of truth: each libraries/<lib>/package.json forwardimpact.needs array.
//
// Usage:
//   node scripts/library-needs.mjs           # regenerate README needs table
//   node scripts/library-needs.mjs --check   # CI mode: fail if README is stale

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const LIB_DIR = join(ROOT, "libraries");
const README = join(LIB_DIR, "README.md");

function loadEntries() {
  const entries = [];
  const seen = new Map();
  for (const dir of readdirSync(LIB_DIR)) {
    if (!dir.startsWith("lib")) continue;
    const pkgPath = join(LIB_DIR, dir, "package.json");
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    } catch {
      continue;
    }
    const needs = pkg.forwardimpact?.needs ?? [];
    for (const need of needs) {
      if (seen.has(need)) {
        throw new Error(
          `Duplicate need "${need}" claimed by ${seen.get(need)} and ${dir}`,
        );
      }
      seen.set(need, dir);
      entries.push({ need, library: dir });
    }
  }
  return entries.sort((a, b) => a.need.localeCompare(b.need));
}

function renderTable(entries) {
  const headerNeed = "I need to…";
  const headerLib = "Library";
  const needW = Math.max(
    headerNeed.length,
    ...entries.map((e) => e.need.length),
  );
  const libW = Math.max(
    headerLib.length,
    ...entries.map((e) => `\`${e.library}\``.length),
  );
  const lines = [
    `| ${headerNeed.padEnd(needW)} | ${headerLib.padEnd(libW)} |`,
    `| ${"-".repeat(needW)} | ${"-".repeat(libW)} |`,
  ];
  for (const e of entries) {
    lines.push(
      `| ${e.need.padEnd(needW)} | ${`\`${e.library}\``.padEnd(libW)} |`,
    );
  }
  return lines.join("\n");
}

const original = readFileSync(README, "utf8");
const entries = loadEntries();
if (entries.length === 0) {
  throw new Error("No forwardimpact.needs entries found across libraries.");
}

const begin = "<!-- BEGIN:needs -->";
const end = "<!-- END:needs -->";
const beginIdx = original.indexOf(begin);
const endIdx = original.indexOf(end);
if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
  throw new Error(`Marker pair not found: ${begin} / ${end}`);
}

const content =
  original.slice(0, beginIdx) +
  `${begin}\n\n${renderTable(entries)}\n\n${end}` +
  original.slice(endIdx + end.length);
const isCheck = process.argv.includes("--check");

if (content === original) {
  if (!isCheck) {
    console.log(`libraries/README.md needs table already up to date.`);
  }
  process.exit(0);
}

if (isCheck) {
  console.error(
    `libraries/README.md needs table is out of date. Run \`bun run lib:needs\` to regenerate.`,
  );
  process.exit(1);
}

writeFileSync(README, content);
console.log(
  `Regenerated needs table in libraries/README.md (${entries.length} entries).`,
);

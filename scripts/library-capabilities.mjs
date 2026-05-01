#!/usr/bin/env node
// Render or check the capability tables in libraries/README.md.
// Source of truth: each libraries/<lib>/package.json forwardimpact.capability +
// name + description.
//
// Usage:
//   node scripts/library-capabilities.mjs           # regenerate README tables
//   node scripts/library-capabilities.mjs --check   # CI mode: fail if README is stale

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const LIB_DIR = join(ROOT, "libraries");
const README = join(LIB_DIR, "README.md");

const CATEGORIES = [
  "agent-capability",
  "agent-retrieval",
  "agent-self-improvement",
  "agent-infrastructure",
  "foundations",
];

function loadLibraries() {
  const libs = [];
  for (const dir of readdirSync(LIB_DIR)) {
    if (!dir.startsWith("lib")) continue;
    const pkgPath = join(LIB_DIR, dir, "package.json");
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    } catch {
      continue;
    }
    const capability = pkg.forwardimpact?.capability;
    if (!capability) {
      throw new Error(`${dir}/package.json: missing forwardimpact.capability`);
    }
    if (!CATEGORIES.includes(capability)) {
      throw new Error(
        `${dir}/package.json: unknown capability "${capability}"`,
      );
    }
    if (!pkg.description) {
      throw new Error(`${dir}/package.json: missing description`);
    }
    libs.push({ name: dir, description: pkg.description, capability });
  }
  return libs.sort((a, b) => a.name.localeCompare(b.name));
}

function renderTable(rows) {
  const headerLib = "Library";
  const headerCap = "Capability";
  const libW = Math.max(
    headerLib.length,
    ...rows.map((r) => `**${r.name}**`.length),
  );
  const capW = Math.max(
    headerCap.length,
    ...rows.map((r) => r.description.length),
  );
  const lines = [
    `| ${headerLib.padEnd(libW)} | ${headerCap.padEnd(capW)} |`,
    `| ${"-".repeat(libW)} | ${"-".repeat(capW)} |`,
  ];
  for (const r of rows) {
    lines.push(
      `| ${`**${r.name}**`.padEnd(libW)} | ${r.description.padEnd(capW)} |`,
    );
  }
  return lines.join("\n");
}

function injectMarker(content, capability, body) {
  const begin = `<!-- BEGIN:capability:${capability} -->`;
  const end = `<!-- END:capability:${capability} -->`;
  const beginIdx = content.indexOf(begin);
  const endIdx = content.indexOf(end);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    throw new Error(`Marker pair not found for capability "${capability}"`);
  }
  return (
    content.slice(0, beginIdx) +
    `${begin}\n\n${body}\n\n${end}` +
    content.slice(endIdx + end.length)
  );
}

const libs = loadLibraries();
const original = readFileSync(README, "utf8");
let content = original;

for (const cap of CATEGORIES) {
  const rows = libs.filter((l) => l.capability === cap);
  if (rows.length === 0) {
    throw new Error(`No libraries categorized as "${cap}"`);
  }
  content = injectMarker(content, cap, renderTable(rows));
}

const isCheck = process.argv.includes("--check");

if (content === original) {
  if (!isCheck) {
    console.log(`libraries/README.md capability tables already up to date.`);
  }
  process.exit(0);
}

if (isCheck) {
  console.error(
    `libraries/README.md capability tables are out of date. Run \`bun run lib:capabilities\` to regenerate.`,
  );
  process.exit(1);
}

writeFileSync(README, content);
console.log(
  `Regenerated capability tables in libraries/README.md (${libs.length} libraries).`,
);

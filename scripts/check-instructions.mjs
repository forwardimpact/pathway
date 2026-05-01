#!/usr/bin/env node
// Enforce instruction layer limits (CHECKLISTS.md § Length and Loading).
// Called by `bun run check` and `just check-instructions`.

import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const L1_CLAUDE_MD_MAX_LINES = 192;
const L2_CONTRIBUTING_MAX_LINES = 256;
const L3_AGENT_PROFILE_MAX_LINES = 64;
const L4_SKILL_PROCEDURE_MAX_LINES = 192;
const L5_SKILL_REFERENCE_MAX_LINES = 128;
const L6_CHECKLIST_MAX_ITEMS = 9;

const root = resolve(new URL("..", import.meta.url).pathname);
let status = 0;

const fail = (msg) => {
  console.error(`error: ${msg}`);
  status = 1;
};

const lineCount = async (path, max, layer) => {
  let text;
  try {
    text = await readFile(resolve(root, path), "utf8");
  } catch {
    return;
  }
  // Match `wc -l`: count newline characters, not split elements.
  const lines = (text.match(/\n/g) || []).length;
  if (lines > max) fail(`${path} has ${lines} lines (max ${max}, ${layer})`);
};

const listFiles = async (dir, match) => {
  try {
    const entries = await readdir(resolve(root, dir), { withFileTypes: true });
    return entries.filter(match).map((e) => `${dir}/${e.name}`);
  } catch {
    return [];
  }
};

// Walk the repo for CLAUDE.md files, skipping dependency and build trees.
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "generated",
  "dist",
  "build",
  ".cache",
]);

const findClaudeMdFiles = async (dir = ".") => {
  const out = [];
  let entries;
  try {
    entries = await readdir(resolve(root, dir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const path = dir === "." ? e.name : `${dir}/${e.name}`;
    if (e.isDirectory()) {
      out.push(...(await findClaudeMdFiles(path)));
    } else if (e.isFile() && e.name === "CLAUDE.md") {
      out.push(path);
    }
  }
  return out;
};

// L1 — every CLAUDE.md (root and any directory-scoped instruction file).
for (const path of await findClaudeMdFiles()) {
  await lineCount(path, L1_CLAUDE_MD_MAX_LINES, "L1 CLAUDE.md");
}

// L2 — CONTRIBUTING.md
await lineCount(
  "CONTRIBUTING.md",
  L2_CONTRIBUTING_MAX_LINES,
  "L2 CONTRIBUTING.md",
);

// L3 — agent profiles
for (const f of await listFiles(
  ".claude/agents",
  (e) => e.isFile() && e.name.endsWith(".md"),
)) {
  await lineCount(f, L3_AGENT_PROFILE_MAX_LINES, "L3 agent profile");
}

// L4 — skill procedure (SKILL.md)
const skillDirs = await listFiles(".claude/skills", (e) => e.isDirectory());
for (const d of skillDirs) {
  await lineCount(
    `${d}/SKILL.md`,
    L4_SKILL_PROCEDURE_MAX_LINES,
    "L4 skill procedure",
  );
}

// L5 — skill references
for (const d of skillDirs) {
  for (const f of await listFiles(
    `${d}/references`,
    (e) => e.isFile() && e.name.endsWith(".md"),
  )) {
    await lineCount(f, L5_SKILL_REFERENCE_MAX_LINES, "L5 skill reference");
  }
}

// L6 — checklists: ≤ 9 items per tagged block.
const checklistRe =
  /<(read_do_checklist|do_confirm_checklist)\b[^>]*>([\s\S]*?)<\/\1>/g;
const itemRe = /^\s*-\s*\[\s*\]/gm;
const checklistSources = [
  "CONTRIBUTING.md",
  ...skillDirs.map((d) => `${d}/SKILL.md`),
];
for (const path of checklistSources) {
  let text;
  try {
    text = await readFile(resolve(root, path), "utf8");
  } catch {
    continue;
  }
  let m;
  let index = 0;
  while ((m = checklistRe.exec(text))) {
    index += 1;
    const type = m[1];
    const items = (m[2].match(itemRe) || []).length;
    if (items > L6_CHECKLIST_MAX_ITEMS) {
      fail(
        `${path} checklist #${index} (${type}) has ${items} items (max ${L6_CHECKLIST_MAX_ITEMS}, L6 checklist)`,
      );
    }
  }
}

process.exit(status);

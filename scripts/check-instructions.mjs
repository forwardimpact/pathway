#!/usr/bin/env node
// Enforce instruction layer limits (KATA.md § Instruction length).
// Called by `bun run check` and `just check-instructions`.

import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

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

// L2 — CLAUDE.md
await lineCount("CLAUDE.md", 192, "L2 CLAUDE.md");

// L3 — CONTRIBUTING.md
await lineCount("CONTRIBUTING.md", 256, "L3 CONTRIBUTING.md");

// L5 — agent profiles
for (const f of await listFiles(
  ".claude/agents",
  (e) => e.isFile() && e.name.endsWith(".md"),
)) {
  await lineCount(f, 64, "L5 agent profile");
}

// L6 — skill procedure (SKILL.md)
const skillDirs = await listFiles(".claude/skills", (e) => e.isDirectory());
for (const d of skillDirs) {
  await lineCount(`${d}/SKILL.md`, 192, "L6 skill procedure");
}

// L7 — skill references
for (const d of skillDirs) {
  for (const f of await listFiles(
    `${d}/references`,
    (e) => e.isFile() && e.name.endsWith(".md"),
  )) {
    await lineCount(f, 128, "L7 skill reference");
  }
}

// L8 — checklists: ≤ 9 items per tagged block.
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
    if (items > 9) {
      fail(
        `${path} checklist #${index} (${type}) has ${items} items (max 9, L8 checklist)`,
      );
    }
  }
}

process.exit(status);

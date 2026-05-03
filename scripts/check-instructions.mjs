#!/usr/bin/env node
// Enforce instruction layer limits (CO-ALIGNED.md § Length and Loading).
// Each layer is gated by a line cap AND a word cap; either breach fails.
// Called by `bun run check` and `just check-instructions`.

import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);

// --- Configuration ---

const SKIP_DIRS = new Set([
  ".cache",
  ".git",
  "build",
  "dist",
  "generated",
  "node_modules",
  "tmp",
  "wiki",
  "worktrees",
]);

// Layer definitions. Caps follow the existing 64/128/256 family; word caps
// land near P95 of the current corpus, rounded to multiples of 64 or 128 so
// agents cannot evade the line cap by collapsing bullets into prose.
const LAYERS = [
  {
    id: "L1",
    maxLines: 192,
    maxWords: 896,
    files: [{ name: "CLAUDE.md", find: findClaudeMdFiles }],
  },
  {
    id: "L2",
    maxLines: 320,
    maxWords: 1408,
    files: [
      { name: "CONTRIBUTING.md", find: async () => ["CONTRIBUTING.md"] },
      { name: "JTBD.md", find: async () => ["JTBD.md"] },
    ],
  },
  {
    id: "L3",
    maxLines: 64,
    maxWords: 384,
    files: [{ name: "agent profile", find: findAgentProfiles }],
  },
  {
    id: "L4",
    maxLines: 192,
    maxWords: 1280,
    files: [{ name: "skill procedure", find: findSkillProcedures }],
  },
  {
    id: "L5",
    maxLines: 128,
    maxWords: 768,
    files: [{ name: "skill reference", find: findSkillReferences }],
  },
];

const L6_MAX_ITEMS = 9;
const L6_MAX_WORDS_PER_ITEM = 32;

// --- Utilities ---

const walk = async (dir, visit) => {
  let entries;
  try {
    entries = await readdir(resolve(root, dir), { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const path = dir === "." ? e.name : `${dir}/${e.name}`;
    await visit(e, path);
    if (e.isDirectory()) await walk(path, visit);
  }
};

const listFiles = async (dir, match) => {
  try {
    const entries = await readdir(resolve(root, dir), { withFileTypes: true });
    return entries.filter(match).map((e) => `${dir}/${e.name}`);
  } catch {
    return [];
  }
};

const readText = async (path) => {
  try {
    return await readFile(resolve(root, path), "utf8");
  } catch {
    return null;
  }
};

// Match `wc -l`: count newline characters, not split elements.
const lineCount = (text) => (text.match(/\n/g) || []).length;
const wordCount = (text) => (text.match(/\S+/g) || []).length;

let status = 0;
const fail = (msg) => {
  console.error(`error: ${msg}`);
  status = 1;
};

// --- File discovery (hoisted so LAYERS can reference them) ---

async function findClaudeMdFiles() {
  const out = [];
  await walk(".", (e, path) => {
    if (e.isFile() && e.name === "CLAUDE.md") out.push(path);
  });
  return out;
}

async function findClaudeDirs() {
  const out = [];
  await walk(".", (e, path) => {
    if (e.isDirectory() && e.name === ".claude") out.push(path);
  });
  return out;
}

const claudeDirs = await findClaudeDirs();

async function findAgentProfiles() {
  const out = [];
  for (const d of claudeDirs) {
    const files = await listFiles(
      `${d}/agents`,
      (e) => e.isFile() && e.name.endsWith(".md"),
    );
    out.push(...files);
  }
  return out;
}

const allSkillDirs = [];
for (const d of claudeDirs) {
  const dirs = await listFiles(`${d}/skills`, (e) => e.isDirectory());
  allSkillDirs.push(...dirs);
}

async function findSkillProcedures() {
  return allSkillDirs.map((d) => `${d}/SKILL.md`);
}

async function findSkillReferences() {
  const out = [];
  for (const d of allSkillDirs) {
    const files = await listFiles(
      `${d}/references`,
      (e) => e.isFile() && e.name.endsWith(".md"),
    );
    out.push(...files);
  }
  return out;
}

// --- Execution ---

const checkFile = async (path, { id, name, maxLines, maxWords }) => {
  const text = await readText(path);
  if (text == null) return;
  const lines = lineCount(text);
  const words = wordCount(text);
  if (lines > maxLines)
    fail(`${path} has ${lines} lines (max ${maxLines}, ${id} ${name})`);
  if (words > maxWords)
    fail(`${path} has ${words} words (max ${maxWords}, ${id} ${name})`);
};

for (const { id, maxLines, maxWords, files: entries } of LAYERS) {
  for (const { name, find } of entries) {
    const files = await find();
    for (const f of files) await checkFile(f, { id, name, maxLines, maxWords });
  }
}

// L6 — checklists: ≤ 9 items per block, ≤ 32 words per item.
const checklistRe =
  /<(read_do_checklist|do_confirm_checklist)\b[^>]*>([\s\S]*?)<\/\1>/g;
const itemSplitRe = /^\s*-\s*\[[ xX]\]\s*/m;

const checklistSources = [
  "CONTRIBUTING.md",
  ...allSkillDirs.map((d) => `${d}/SKILL.md`),
];

for (const path of checklistSources) {
  const text = await readText(path);
  if (text == null) continue;
  let m;
  let index = 0;
  while ((m = checklistRe.exec(text))) {
    index += 1;
    const type = m[1];
    const items = m[2].split(itemSplitRe).slice(1);
    if (items.length > L6_MAX_ITEMS) {
      fail(
        `${path} checklist #${index} (${type}) has ${items.length} items (max ${L6_MAX_ITEMS}, L6 checklist)`,
      );
    }
    items.forEach((raw, i) => {
      const w = wordCount(raw.trim());
      if (w > L6_MAX_WORDS_PER_ITEM) {
        fail(
          `${path} checklist #${index} (${type}) item ${i + 1} has ${w} words (max ${L6_MAX_WORDS_PER_ITEM}, L6 checklist item)`,
        );
      }
    });
  }
}

process.exit(status);

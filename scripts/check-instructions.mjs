#!/usr/bin/env node
// Enforce instruction layer limits (CHECKLIST.md § Length and Loading).
// Each layer is gated by a line cap AND a word cap; either breach fails.
// Called by `bun run check` and `just check-instructions`.

import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "generated",
  "dist",
  "build",
  ".cache",
  "tmp",
  "wiki",
  "worktrees",
]);

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

// File discovery — every `.claude/` directory in the repo gets its agents and
// skills checked, so per-product templates (e.g. products/outpost/templates)
// are held to the same caps as the monorepo root.
const findClaudeMdFiles = async () => {
  const out = [];
  await walk(".", (e, path) => {
    if (e.isFile() && e.name === "CLAUDE.md") out.push(path);
  });
  return out;
};

const findClaudeDirs = async () => {
  const out = [];
  await walk(".", (e, path) => {
    if (e.isDirectory() && e.name === ".claude") out.push(path);
  });
  return out;
};

const claudeDirs = await findClaudeDirs();

const findAgentProfiles = async () => {
  const out = [];
  for (const d of claudeDirs) {
    const files = await listFiles(
      `${d}/agents`,
      (e) => e.isFile() && e.name.endsWith(".md"),
    );
    out.push(...files);
  }
  return out;
};

const allSkillDirs = [];
for (const d of claudeDirs) {
  const dirs = await listFiles(`${d}/skills`, (e) => e.isDirectory());
  allSkillDirs.push(...dirs);
}

const findSkillProcedures = async () =>
  allSkillDirs.map((d) => `${d}/SKILL.md`);

const findSkillReferences = async () => {
  const out = [];
  for (const d of allSkillDirs) {
    const files = await listFiles(
      `${d}/references`,
      (e) => e.isFile() && e.name.endsWith(".md"),
    );
    out.push(...files);
  }
  return out;
};

// Layer definitions. Caps follow the existing 64/128/256 family; word caps
// land near P95 of the current corpus, rounded to multiples of 64 or 128 so
// agents cannot evade the line cap by collapsing bullets into prose.
const LAYERS = [
  {
    id: "L1",
    what: "CLAUDE.md",
    maxLines: 192,
    maxWords: 896,
    find: findClaudeMdFiles,
  },
  {
    id: "L2",
    what: "CONTRIBUTING.md",
    maxLines: 256,
    maxWords: 1536,
    find: async () => ["CONTRIBUTING.md"],
  },
  {
    id: "L3",
    what: "agent profile",
    maxLines: 64,
    maxWords: 384,
    find: findAgentProfiles,
  },
  {
    id: "L4",
    what: "skill procedure",
    maxLines: 192,
    maxWords: 1280,
    find: findSkillProcedures,
  },
  {
    id: "L5",
    what: "skill reference",
    maxLines: 128,
    maxWords: 768,
    find: findSkillReferences,
  },
];

const checkFile = async (path, { id, what, maxLines, maxWords }) => {
  const text = await readText(path);
  if (text == null) return;
  const lines = lineCount(text);
  const words = wordCount(text);
  if (lines > maxLines)
    fail(`${path} has ${lines} lines (max ${maxLines}, ${id} ${what})`);
  if (words > maxWords)
    fail(`${path} has ${words} words (max ${maxWords}, ${id} ${what})`);
};

for (const layer of LAYERS) {
  const files = await layer.find();
  for (const f of files) await checkFile(f, layer);
}

// L6 — checklists: ≤ 9 items per block, ≤ 32 words per item.
const L6_MAX_ITEMS = 9;
const L6_MAX_WORDS_PER_ITEM = 32;

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

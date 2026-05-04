import { readdir, readFile } from "fs/promises";
import { utimesSync } from "fs";
import { join } from "path";

export async function collectPaths(dir, prefix = ".") {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const rel = prefix + "/" + entry.name;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(rel);
      result.push(...(await collectPaths(abs, rel)));
    } else {
      result.push(rel);
    }
  }
  return result;
}

export async function resetTimestamps(dir) {
  const epoch = new Date(0);
  const paths = await collectPaths(dir);
  for (const rel of paths) {
    utimesSync(join(dir, rel), epoch, epoch);
  }
  utimesSync(dir, epoch, epoch);
}

export function stringifySorted(value) {
  const seen = new WeakSet();
  const sort = (v) => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v)) throw new Error("Cannot stringify circular structure");
    seen.add(v);
    if (Array.isArray(v)) return v.map(sort);
    const out = {};
    for (const key of Object.keys(v).sort()) out[key] = sort(v[key]);
    return out;
  };
  return JSON.stringify(sort(value), null, 2) + "\n";
}

export async function collectFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const rel = prefix ? prefix + "/" + entry.name : entry.name;
    if (entry.isDirectory()) {
      result.push(...(await collectFiles(join(dir, entry.name), rel)));
    } else {
      result.push(rel);
    }
  }
  return result.sort();
}

export function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return result;
}

export async function buildSkillEntry(skillDir, name) {
  const skillMd = await readFile(join(skillDir, "SKILL.md"), "utf-8");
  const fm = parseFrontmatter(skillMd);
  const files = await collectFiles(skillDir);
  return { description: fm.description || "", files, name };
}

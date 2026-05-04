import { readdirSync, statSync } from "node:fs";
import path from "node:path";

/** List all kata-prefixed skill directory names under the skills directory, sorted alphabetically. */
export function listSkills({ skillsDir }, fs = { readdirSync, statSync }) {
  const entries = fs.readdirSync(skillsDir);
  const skills = [];

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    if (!entry.startsWith("kata-")) continue;
    const fullPath = path.join(skillsDir, entry);
    const stat = fs.statSync(fullPath);
    if (!stat.isDirectory()) continue;
    skills.push(entry);
  }

  return skills.sort();
}

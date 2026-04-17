/**
 * APM-specific pack logic for Pathway distribution.
 *
 * Transforms a `.claude/` staging directory into APM's `.apm/` package layout
 * and archives it as a deterministic `.apm.tar.gz` bundle. Consumed by
 * `generatePacks` in `build-packs.js`.
 *
 * See specs/520-apm-compatible-packs for context.
 */

import { mkdir, readdir, cp, writeFile } from "fs/promises";
import { join } from "path";
import { execFileSync } from "child_process";

import { collectPaths, resetTimestamps } from "./build-packs.js";

/**
 * Transform a `.claude/` staging directory into APM's `.apm/` package layout.
 *
 * Mapping rules:
 *  - `.claude/skills/{name}/` → `.apm/skills/{name}/`
 *  - `.claude/agents/{name}.md` → `.apm/agents/{name}.agent.md`
 *  - `CLAUDE.md` and `settings.json` are dropped (no APM primitive).
 *
 * A per-bundle `apm.yml` with `name` and `version` is written at the staging
 * root.
 *
 * @param {string} claudeStagingDir - The `.claude/` staging directory
 * @param {string} apmStagingDir - Destination for the `.apm/` layout
 * @param {string} packName - Pack name for the `apm.yml` manifest
 * @param {string} version - Version string for the `apm.yml` manifest
 */
export async function transformToApmLayout(
  claudeStagingDir,
  apmStagingDir,
  packName,
  version,
) {
  const apmSkillsDir = join(apmStagingDir, ".apm", "skills");
  const apmAgentsDir = join(apmStagingDir, ".apm", "agents");
  await mkdir(apmSkillsDir, { recursive: true });
  await mkdir(apmAgentsDir, { recursive: true });

  // Copy skills: .claude/skills/{name}/ → .apm/skills/{name}/
  const srcSkillsDir = join(claudeStagingDir, ".claude", "skills");
  const skillDirs = (
    await readdir(srcSkillsDir, { withFileTypes: true })
  ).filter((e) => e.isDirectory());
  for (const dir of skillDirs) {
    await cp(join(srcSkillsDir, dir.name), join(apmSkillsDir, dir.name), {
      recursive: true,
    });
  }

  // Copy agents: .claude/agents/{name}.md → .apm/agents/{name}.agent.md
  const srcAgentsDir = join(claudeStagingDir, ".claude", "agents");
  const agentFiles = (await readdir(srcAgentsDir)).filter((f) =>
    f.endsWith(".md"),
  );
  for (const file of agentFiles) {
    const apmName = file.replace(/\.md$/, ".agent.md");
    await cp(join(srcAgentsDir, file), join(apmAgentsDir, apmName));
  }

  // CLAUDE.md and settings.json are intentionally dropped — no APM primitive

  // Per-bundle apm.yml
  const apmYml = `name: ${packName}\nversion: ${version}\n`;
  await writeFile(join(apmStagingDir, "apm.yml"), apmYml, "utf-8");
}

/**
 * Archive an APM staging directory as a deterministic `.apm.tar.gz`.
 *
 * Uses the same deterministic strategy as `archiveRawPack`: epoch timestamps,
 * sorted file list, `gzip -n`.
 *
 * @param {string} apmStagingDir - The APM staging directory
 * @param {string} archivePath - Destination path for the `.apm.tar.gz`
 */
export async function archiveApmPack(apmStagingDir, archivePath) {
  await resetTimestamps(apmStagingDir);
  const files = await collectPaths(apmStagingDir);
  files.sort();
  const tarBuf = execFileSync("tar", [
    "--no-recursion",
    "-cf",
    "-",
    "-C",
    apmStagingDir,
    ...files,
  ]);
  const gzBuf = execFileSync("gzip", ["-n"], { input: tarBuf });
  await writeFile(archivePath, gzBuf);
}

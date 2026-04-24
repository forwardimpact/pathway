/**
 * APM-specific pack logic for Pathway distribution.
 *
 * Stages an APM-compatible bundle from a `.claude/` staging directory. The
 * bundle uses APM's deployed layout (`.claude/skills/`, `.claude/agents/`)
 * with an enriched `apm.lock.yaml` so that `apm unpack` works out of the box.
 *
 * See specs/520-apm-compatible-packs for context.
 */

import { mkdir, readdir, cp, writeFile, copyFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";

import { collectPaths, resetTimestamps } from "./build-packs.js";

/**
 * Recursively collect all file paths under `dir`, relative to `dir`, sorted.
 * @param {string} dir
 * @param {string} [prefix]
 * @returns {Promise<string[]>}
 */
async function collectFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      result.push(...(await collectFiles(join(dir, entry.name), rel)));
    } else {
      result.push(rel);
    }
  }
  return result.sort();
}

/**
 * Stage an APM-compatible bundle from a `.claude/` staging directory.
 *
 * Copies skills and agents into the deployed `.claude/` layout (the same
 * layout `apm install` produces for the Claude target) and generates an
 * enriched `apm.lock.yaml` that `apm unpack` requires.
 *
 * Files without an APM primitive (`settings.json`, `.vscode/`) are
 * intentionally excluded. `CLAUDE.md` (team instructions) is included
 * because it provides essential project-level context for agent teams.
 *
 * @param {string} claudeStagingDir - The raw pack staging directory
 * @param {string} apmStagingDir - Destination for the APM bundle
 * @param {string} packName - Pack name for the lock file
 * @param {string} version - Version string for the lock file
 */
export async function stageApmBundle(
  claudeStagingDir,
  apmStagingDir,
  packName,
  version,
) {
  const srcSkillsDir = join(claudeStagingDir, ".claude", "skills");
  const srcAgentsDir = join(claudeStagingDir, ".claude", "agents");
  const destSkillsDir = join(apmStagingDir, ".claude", "skills");
  const destAgentsDir = join(apmStagingDir, ".claude", "agents");

  await mkdir(destSkillsDir, { recursive: true });
  await mkdir(destAgentsDir, { recursive: true });

  // Copy skills (unchanged layout)
  const skillDirs = (
    await readdir(srcSkillsDir, { withFileTypes: true })
  ).filter((e) => e.isDirectory());
  for (const dir of skillDirs) {
    await cp(join(srcSkillsDir, dir.name), join(destSkillsDir, dir.name), {
      recursive: true,
    });
  }

  // Copy agents (unchanged — .md extension, no .agent.md rename)
  const agentFiles = (await readdir(srcAgentsDir)).filter((f) =>
    f.endsWith(".md"),
  );
  for (const file of agentFiles) {
    await cp(join(srcAgentsDir, file), join(destAgentsDir, file));
  }

  // Copy CLAUDE.md (team instructions) if present
  const srcClaudeMd = join(claudeStagingDir, ".claude", "CLAUDE.md");
  const destClaudeDir = join(apmStagingDir, ".claude");
  if (existsSync(srcClaudeMd)) {
    await copyFile(srcClaudeMd, join(destClaudeDir, "CLAUDE.md"));
  }

  // Build deployed file list for the lock file
  const deployedFiles = [];
  if (existsSync(join(destClaudeDir, "CLAUDE.md"))) {
    deployedFiles.push(".claude/CLAUDE.md");
  }
  for (const file of await collectFiles(destSkillsDir)) {
    deployedFiles.push(`.claude/skills/${file}`);
  }
  for (const file of await collectFiles(destAgentsDir)) {
    deployedFiles.push(`.claude/agents/${file}`);
  }
  deployedFiles.sort();

  // Enriched apm.lock.yaml — required for `apm unpack`.
  // Use epoch timestamp for deterministic, reproducible builds (same strategy
  // as the archive file timestamps).
  const epoch = new Date(0).toISOString();
  const lockLines = [
    `lockfile_version: '1'`,
    `generated_at: '${epoch}'`,
    `pack:`,
    `  format: apm`,
    `  target: claude`,
    `  packed_at: '${epoch}'`,
    `dependencies:`,
    `- repo_url: _local/${packName}`,
    `  version: '${version}'`,
    `  package_type: apm_package`,
    `  depth: 1`,
    `  deployed_files:`,
    ...deployedFiles.map((f) => `  - ${f}`),
    `local_deployed_files: []`,
    ``,
  ];
  await writeFile(
    join(apmStagingDir, "apm.lock.yaml"),
    lockLines.join("\n"),
    "utf-8",
  );
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

/**
 * Env-loader — auto-discover `.env` / `.env.local` files in a task family
 * and its tasks, load them into `process.env`, and render the merged result
 * into each agent CWD.
 *
 * Discovery paths (loaded in this order, first value per key wins):
 *   1. process.env  (CI secrets, shell env — never overwritten)
 *   2. <family>/.env.local
 *   3. <family>/.env
 *   4. tasks/<id>/.env.local
 *   5. tasks/<id>/.env
 *
 * Every discovered env file — family or task — is loaded into process.env
 * AND rendered (with resolved values) into the agent working directory.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ENV_FILES = [".env.local", ".env"];

/**
 * Parse a `.env` file into an array of {key, value} pairs.
 * Handles KEY=VALUE, # comments, blank lines, and single/double-quoted values.
 * @param {string} content
 * @returns {Array<{key: string, value: string}>}
 */
export function parseEnvFile(content) {
  const entries = [];
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries.push({ key, value });
  }
  return entries;
}

/**
 * Read and parse an env file, returning [] if the file does not exist.
 * @param {string} filePath
 * @returns {Promise<Array<{key: string, value: string}>>}
 */
async function readEnvFile(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    return parseEnvFile(content);
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

/**
 * Load entries into process.env. Existing keys are never overwritten.
 * @param {Array<{key: string, value: string}>} entries
 * @returns {string[]} var names that were loaded
 */
function applyToProcessEnv(entries) {
  const names = [];
  for (const { key, value } of entries) {
    names.push(key);
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return names;
}

/**
 * Load one env file: apply to process.env, record keys in the merged map.
 * @param {string} dir
 * @param {string} file
 * @param {Set<string>} names
 * @param {Map<string, Map<string, true>>} merged
 */
async function loadOneEnvFile(dir, file, names, merged) {
  const entries = await readEnvFile(join(dir, file));
  if (entries.length === 0) return;
  for (const name of applyToProcessEnv(entries)) names.add(name);
  if (!merged.has(file)) merged.set(file, new Map());
  const fileMap = merged.get(file);
  for (const { key } of entries) {
    if (!fileMap.has(key)) fileMap.set(key, true);
  }
}

/**
 * Scan directories for env files, load into process.env, and collect
 * a merged key manifest per filename.
 * @param {string[]} dirs
 * @returns {Promise<{names: Set<string>, merged: Map<string, Map<string, true>>}>}
 */
async function collectEnvEntries(dirs) {
  const names = new Set();
  const merged = new Map();
  for (const dir of dirs) {
    for (const file of ENV_FILES) {
      await loadOneEnvFile(dir, file, names, merged);
    }
  }
  return { names, merged };
}

/**
 * Write resolved env files into the agent CWD and warn about empty values.
 * @param {Map<string, Map<string, true>>} merged
 * @param {string} agentCwd
 */
async function renderEnvFiles(merged, agentCwd) {
  for (const [file, keyMap] of merged) {
    const keys = [...keyMap.keys()];
    const resolved = keys.map((key) => `${key}=${process.env[key] ?? ""}`);
    await writeFile(join(agentCwd, file), resolved.join("\n") + "\n");
    const empty = keys.filter((key) => !process.env[key]);
    if (empty.length > 0) {
      process.stderr.write(
        `libeval: env warning: ${file} declares vars with no value: ${empty.join(", ")}\n`,
      );
    }
  }
}

/**
 * Discover `.env` / `.env.local` in one or more directories, load them
 * into process.env, and render the resolved values into the agent CWD.
 *
 * @param {string[]} dirs - Directories to scan (family root, task dir, etc.)
 * @param {string} agentCwd - Agent working directory to render into.
 * @returns {Promise<string[]>} All var names discovered (for redaction).
 */
export async function loadEnv(dirs, agentCwd) {
  const { names, merged } = await collectEnvEntries(dirs);
  await renderEnvFiles(merged, agentCwd);
  return [...names];
}

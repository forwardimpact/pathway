/**
 * Compose an SDK `systemPrompt` value from a `.claude/agents/<name>.md` file.
 *
 * Pure function. Reads the profile file, strips YAML frontmatter, and returns
 * the SDK-shaped `{ type: "preset", preset: "claude_code", append }` object
 * with the profile body — plus an optional mode-specific trailer — in the
 * `append` slot. Callers in libeval pass the result straight into an
 * `AgentRunner`'s `systemPrompt` input so the profile reaches the main-thread
 * system prompt without going through the SDK's top-level `agent` option.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * @param {string} name - Profile basename (no `.md` suffix)
 * @param {object} opts
 * @param {string} opts.profilesDir - Directory containing `<name>.md`
 * @param {string} [opts.trailer] - Optional mode-specific trailer appended after a blank line
 * @returns {{type: "preset", preset: "claude_code", append: string}}
 */
export function composeProfilePrompt(name, { profilesDir, trailer }) {
  const path = join(profilesDir, `${name}.md`);
  const raw = readFileSync(path, "utf8");
  const body = stripFrontmatter(raw).trim();
  const append = trailer && trailer.length > 0 ? `${body}\n\n${trailer}` : body;
  return { type: "preset", preset: "claude_code", append };
}

/**
 * Strip a leading YAML frontmatter fence (`---\n…\n---\n`) from a markdown
 * string. Returns the input unchanged when no frontmatter is present.
 * @param {string} raw
 * @returns {string}
 */
function stripFrontmatter(raw) {
  if (!raw.startsWith("---\n")) return raw;
  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) return raw;
  return raw.slice(end + 5);
}

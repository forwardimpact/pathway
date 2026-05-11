/**
 * Sandboxed environment builder for user-supplied scripts (preflight and
 * scoring) that the harness spawns under task-family control.
 *
 * v1 does not containerise tasks (spec § Out of scope, deferred:
 * "Containerised isolation"), but propagating the full parent env to a
 * task author's script also propagates provider credentials like
 * `ANTHROPIC_API_KEY` and `GITHUB_TOKEN` — a malicious family could
 * exfiltrate them without filesystem access. Narrowing to an explicit
 * allow-list closes that hole without requiring a sandbox.
 *
 * The allow-list contains only the variables a typical preflight or
 * scoring script needs: a working PATH, locale and TMPDIR so child
 * processes resolve binaries and produce predictable output, and HOME so
 * shells with a startup file don't crash on missing `$HOME`.
 */

const ENV_ALLOWLIST = Object.freeze([
  "PATH",
  "HOME",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "USER",
  "LOGNAME",
  "SHELL",
  "TZ",
]);

/**
 * Build a narrowed env object: allow-listed parent variables, plus the
 * caller-supplied additions (which take precedence on collision).
 * @param {Record<string, string>} additions
 * @returns {Record<string, string>}
 */
export function buildSandboxEnv(additions) {
  const out = {};
  for (const name of ENV_ALLOWLIST) {
    const v = process.env[name];
    if (typeof v === "string" && v.length > 0) out[name] = v;
  }
  Object.assign(out, additions);
  return out;
}

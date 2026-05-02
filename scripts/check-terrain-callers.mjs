#!/usr/bin/env node
// Fail if any file in the spec 750 named surface (justfile, package.json,
// .github/workflows/**) calls `bunx fit-terrain` without one of the
// accepted verbs. Called by `bun run context:terrain`.
import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const VERBS = ["check", "validate", "build", "generate", "inspect"];
// Match the start of a `fit-terrain` invocation (the executable being
// called, not an argument or path token):
//   - preceded by `bunx ` (justfile/workflow recipe form)
//   - preceded by `"` (package.json script-value form)
// `(?![\w-])` after `fit-terrain` excludes hyphen-extended tool names
// (e.g. a hypothetical `fit-terrain-foo`).
// Verbs are inlined here (not interpolated from VERBS) to keep the regex
// literal — eslint security/detect-non-literal-regexp flags `new RegExp()`.
const INVOCATION = /(?:bunx\s+|"\s*)fit-terrain(?![\w-])/;
// Look for an accepted verb anywhere later in the same line so global
// flags between `fit-terrain` and the verb (e.g.
// `bunx fit-terrain --story=foo build`) are tolerated. A trailing
// `(?![\w-])` rejects hyphenated extensions like `check-something`.
// Verb list and regex must stay in sync with
// libterrain/bin/fit-terrain.js.
const VERB_AFTER = /\s+(?:check|validate|build|generate|inspect)(?![\w-])/;

async function listWorkflows() {
  const dir = resolve(root, ".github/workflows");
  const entries = await readdir(dir);
  return entries
    .filter((n) => n.endsWith(".yml") || n.endsWith(".yaml"))
    .map((n) => join(dir, n));
}

const targets = [
  resolve(root, "justfile"),
  resolve(root, "package.json"),
  ...(await listWorkflows()),
];

let status = 0;
for (const path of targets) {
  const text = await readFile(path, "utf8");
  text.split("\n").forEach((line, i) => {
    const m = INVOCATION.exec(line);
    if (!m) return;
    const tail = line.slice(m.index + m[0].length);
    if (!VERB_AFTER.test(tail)) {
      console.error(
        `${path}:${i + 1}: fit-terrain invocation without a verb — add one of (${VERBS.join("|")})`,
      );
      status = 1;
    }
  });
}
process.exit(status);

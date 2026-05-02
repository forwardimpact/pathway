#!/usr/bin/env node
// Fail if any file in the spec 750 named surface (justfile, package.json,
// .github/workflows/**) calls `bunx fit-terrain` without one of the
// accepted verbs. Called by `bun run context:terrain`.
import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const VERBS = ["check", "validate", "build", "generate", "inspect"];
// Match `fit-terrain` only when it is the executable being called:
//   - preceded by `bunx ` (justfile/workflow recipe form, e.g.
//     `bunx fit-terrain build`)
//   - preceded by `"` (package.json script-value form, e.g.
//     `"generate": "fit-terrain build"`)
// and NOT followed by an accepted verb. This excludes argument/path
// references like `just build-binary fit-terrain` or
// `dist/binaries/fit-terrain` that are not invocations.
// Verbs are inlined here (not interpolated from VERBS) to keep the regex
// literal — eslint security/detect-non-literal-regexp flags `new RegExp()`.
const PATTERN =
  /(?:bunx\s+|"\s*)fit-terrain\b(?!\s+(?:check|validate|build|generate|inspect)\b)/;

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
    if (PATTERN.test(line)) {
      console.error(
        `${path}:${i + 1}: bare 'bunx fit-terrain' — add a verb (${VERBS.join("|")})`,
      );
      status = 1;
    }
  });
}
process.exit(status);

#!/usr/bin/env node
// Fail if any caller in the spec 750 named surface (justfile,
// package.json, .github/workflows/**) invokes fit-terrain without one of
// the accepted verbs. Two modes: textual (requires `bunx ` prefix) for
// justfile + workflows; JSON-parsed scripts for package.json.
import { readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const VERBS = ["check", "validate", "build", "generate", "inspect"];
const VERB_GROUP = VERBS.join("|");

// Textual: any `(LOG_LEVEL=… )*bunx fit-terrain` with no verb after it.
const TEXTUAL = new RegExp(
  String.raw`(?:^|\s)(?:[A-Z_]+=\S+\s+)*bunx\s+fit-terrain\b(?!\s+(?:${VERB_GROUP})\b)`,
);

// JSON-mode: tokenize one shell command and verify the verb.
function scriptHasBareCall(value) {
  return value
    .split(/\s*(?:&&|\|\||;)\s*/)
    .map((cmd) => cmd.replace(/^(?:[A-Z_]+=\S+\s+)*/, ""))
    .map((cmd) => cmd.replace(/^bunx\s+/, ""))
    .filter((cmd) => /^fit-terrain(?:\s|$)/.test(cmd))
    .some((cmd) => {
      const next = cmd.replace(/^fit-terrain\s*/, "").split(/\s+/)[0];
      return !VERBS.includes(next);
    });
}

async function listWorkflows() {
  const dir = resolve(root, ".github/workflows");
  const entries = await readdir(dir);
  return entries
    .filter((n) => n.endsWith(".yml") || n.endsWith(".yaml"))
    .map((n) => join(dir, n));
}

let status = 0;

// Textual surfaces.
for (const path of [resolve(root, "justfile"), ...(await listWorkflows())]) {
  const text = await readFile(path, "utf8");
  text.split("\n").forEach((line, i) => {
    if (TEXTUAL.test(line)) {
      console.error(
        `${path}:${i + 1}: bare 'bunx fit-terrain' — add a verb (${VERBS.join("|")})`,
      );
      status = 1;
    }
  });
}

// package.json scripts.
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
for (const [name, value] of Object.entries(pkg.scripts ?? {})) {
  if (scriptHasBareCall(value)) {
    console.error(
      `package.json:scripts.${name}: bare fit-terrain — add a verb (${VERBS.join("|")})`,
    );
    status = 1;
  }
}

process.exit(status);

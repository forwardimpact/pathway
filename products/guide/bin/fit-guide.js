#!/usr/bin/env node
/**
 * fit-guide CLI — Claude Agent SDK harness running inside librepl
 *
 * Engineering framework knowledge agent reachable from three surfaces:
 * this CLI, Claude Code (MCP), and Claude Chat (Connector).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createCli } from "@forwardimpact/libcli";

import { runClearCommand } from "../src/commands/clear.js";
import { runInitCommand } from "../src/commands/init.js";
import { runLoginCommand } from "../src/commands/login.js";
import { runLogoutCommand } from "../src/commands/logout.js";
import { runResumeCommand } from "../src/commands/resume.js";
import { runStatusCommand } from "../src/commands/status.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const VERSION = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8"),
).version;

const definition = {
  name: "fit-guide",
  version: VERSION,
  description: "Engineering framework knowledge agent",
  commands: [
    { name: "login", description: "Authenticate with Anthropic" },
    { name: "logout", description: "Clear stored credentials" },
    { name: "clear", description: "Start a new conversation" },
    { name: "init", description: "Initialize Guide configuration" },
    { name: "status", description: "Check system readiness" },
  ],
  globalOptions: {
    data: {
      type: "string",
      short: "d",
      description: "Path to framework data",
    },
    json: { type: "boolean", description: "Output as JSON" },
    help: { type: "boolean", short: "h", description: "Show help" },
    version: { type: "boolean", description: "Show version" },
  },
  examples: [
    "npx fit-guide status",
    "npx fit-guide login",
    'echo "What skills does a senior SE need?" | npx fit-guide clear',
    "npx fit-guide",
  ],
};

const cli = createCli(definition);

// ---------------------------------------------------------------------------
// First-run UX
// ---------------------------------------------------------------------------

function checkFirstRun() {
  if (process.env.LLM_TOKEN && !process.env.ANTHROPIC_API_KEY) {
    process.stderr.write(
      "Guide has moved to Anthropic. LLM_TOKEN is no longer used.\n\n" +
        "  Run: fit-guide init    (regenerates .env)\n" +
        "  Then: fit-guide login  (or set ANTHROPIC_API_KEY)\n",
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const parsed = cli.parse(process.argv.slice(2));
if (!parsed) process.exit(0);

const { values, positionals } = parsed;
const command = positionals[0] || null;

if (command === "init") {
  await runInitCommand();
  process.exit(0);
}

if (command === "login") {
  await runLoginCommand();
  process.exit(0);
}

if (command === "logout") {
  await runLogoutCommand();
  process.exit(0);
}

if (command === "status") {
  const exitCode = await runStatusCommand({ json: values.json });
  process.exit(exitCode);
}

if (command === "clear") {
  checkFirstRun();
  try {
    await runClearCommand();
  } catch (err) {
    cli.error(err.message);
    process.exit(1);
  }
  process.exit(0);
}

// Default (or explicit `resume`): continue the last conversation via librepl.
checkFirstRun();
try {
  await runResumeCommand();
} catch (err) {
  cli.error(err.message);
  process.exit(1);
}
process.exit(0);

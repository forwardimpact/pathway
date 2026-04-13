#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createCli } from "@forwardimpact/libcli";
import { createLogger } from "@forwardimpact/libtelemetry";

import { runOutputCommand } from "../src/commands/output.js";
import { runTeeCommand } from "../src/commands/tee.js";
import { runRunCommand } from "../src/commands/run.js";
import { runSuperviseCommand } from "../src/commands/supervise.js";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const definition = {
  name: "fit-eval",
  version: VERSION,
  description: "Process Claude Code stream-json output",
  commands: [
    {
      name: "output",
      args: "",
      description: "Process trace and output formatted result",
    },
    {
      name: "tee",
      args: "[output.ndjson]",
      description: "Stream text to stdout, optionally save raw NDJSON",
    },
    {
      name: "run",
      args: "",
      description: "Run a single agent via the Claude Agent SDK",
      options: {
        "task-file": { type: "string", description: "Path to task file" },
        "task-text": { type: "string", description: "Inline task text" },
        "task-amend": {
          type: "string",
          description: "Additional text appended to task",
        },
        model: { type: "string", description: "Claude model (default: opus)" },
        "max-turns": {
          type: "string",
          description: "Max agentic turns (default: 50)",
        },
        output: { type: "string", description: "Write NDJSON trace to file" },
        cwd: { type: "string", description: "Working directory" },
        "agent-profile": { type: "string", description: "Agent profile name" },
        "allowed-tools": {
          type: "string",
          description: "Comma-separated tool list",
        },
      },
    },
    {
      name: "supervise",
      args: "",
      description: "Run a supervised agent-supervisor relay loop",
      options: {
        "task-file": { type: "string", description: "Path to task file" },
        "task-text": { type: "string", description: "Inline task text" },
        "task-amend": {
          type: "string",
          description: "Additional text appended to task",
        },
        model: { type: "string", description: "Claude model (default: opus)" },
        "max-turns": {
          type: "string",
          description: "Max agentic turns (default: 50)",
        },
        output: { type: "string", description: "Write NDJSON trace to file" },
        cwd: { type: "string", description: "Working directory" },
        "agent-profile": { type: "string", description: "Agent profile name" },
        "allowed-tools": {
          type: "string",
          description: "Comma-separated tool list",
        },
        "supervisor-cwd": {
          type: "string",
          description: "Supervisor working directory",
        },
        "agent-cwd": { type: "string", description: "Agent working directory" },
        "supervisor-profile": {
          type: "string",
          description: "Supervisor profile name",
        },
        "supervisor-allowed-tools": {
          type: "string",
          description: "Supervisor tool list",
        },
      },
    },
  ],
  globalOptions: {
    format: { type: "string", description: "Output format (json|text)" },
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
    json: { type: "boolean", description: "Output help as JSON" },
  },
  examples: [
    "fit-eval output --format=text < trace.ndjson",
    "fit-eval run --task-file=task.md --model=opus",
    "fit-eval supervise --task-file=task.md --supervisor-cwd=.",
  ],
};

const cli = createCli(definition);
const logger = createLogger("eval");

const COMMANDS = {
  output: runOutputCommand,
  tee: runTeeCommand,
  run: runRunCommand,
  supervise: runSuperviseCommand,
};

async function main() {
  const parsed = cli.parse(process.argv.slice(2));
  if (!parsed) process.exit(0);

  const { values, positionals } = parsed;

  if (positionals.length === 0) {
    cli.usageError("no command specified");
    process.exit(2);
  }

  const [command, ...args] = positionals;
  const handler = COMMANDS[command];

  if (!handler) {
    cli.usageError(`unknown command "${command}"`);
    process.exit(2);
  }

  await handler(values, args);
}

main().catch((error) => {
  logger.exception("main", error);
  cli.error(error.message);
  process.exit(1);
});

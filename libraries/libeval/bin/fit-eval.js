#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createCli } from "@forwardimpact/libcli";
import { createLogger } from "@forwardimpact/libtelemetry";

import { runOutputCommand } from "../src/commands/output.js";
import { runTeeCommand } from "../src/commands/tee.js";
import { runRunCommand } from "../src/commands/run.js";
import { runSuperviseCommand } from "../src/commands/supervise.js";
import { runFacilitateCommand } from "../src/commands/facilitate.js";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const definition = {
  name: "fit-eval",
  version: VERSION,
  description:
    "Run agents and capture NDJSON traces — for agent evaluations or multi-agent collaboration",
  commands: [
    {
      name: "run",
      args: "",
      description: "Run a single agent autonomously on a defined task",
      options: {
        "task-file": {
          type: "string",
          description: "Path to a markdown task file",
        },
        "task-text": {
          type: "string",
          description: "Inline task text (alternative to --task-file)",
        },
        "task-amend": {
          type: "string",
          description: "Additional text appended to the task",
        },
        model: { type: "string", description: "Claude model (default: opus)" },
        "max-turns": {
          type: "string",
          description: "Max agentic turns (default: 50, 0 = unlimited)",
        },
        output: {
          type: "string",
          description: "Write the NDJSON trace to a file",
        },
        cwd: { type: "string", description: "Working directory for the agent" },
        "agent-profile": {
          type: "string",
          description: "Agent profile name to load",
        },
        "allowed-tools": {
          type: "string",
          description: "Comma-separated tool allowlist",
        },
      },
    },
    {
      name: "supervise",
      args: "",
      description:
        "Run a supervisor–agent relay — typical shape for agent-as-judge evaluations",
      options: {
        "task-file": {
          type: "string",
          description: "Path to a markdown task file",
        },
        "task-text": {
          type: "string",
          description: "Inline task text (alternative to --task-file)",
        },
        "task-amend": {
          type: "string",
          description: "Additional text appended to the task",
        },
        model: { type: "string", description: "Claude model (default: opus)" },
        "max-turns": {
          type: "string",
          description: "Max agentic turns (default: 20, 0 = unlimited)",
        },
        output: {
          type: "string",
          description: "Write the NDJSON trace to a file",
        },
        "agent-profile": { type: "string", description: "Agent profile name" },
        "allowed-tools": {
          type: "string",
          description: "Agent tool allowlist",
        },
        "supervisor-cwd": {
          type: "string",
          description: "Supervisor working directory",
        },
        "agent-cwd": { type: "string", description: "Agent working directory" },
        "supervisor-profile": {
          type: "string",
          description: "Supervisor (judge) profile name",
        },
        "supervisor-allowed-tools": {
          type: "string",
          description: "Supervisor tool allowlist",
        },
      },
    },
    {
      name: "facilitate",
      args: "",
      description:
        "Run a facilitator with N participants — typical shape for multi-agent collaboration",
      options: {
        "task-file": {
          type: "string",
          description: "Path to a markdown task file",
        },
        "task-text": {
          type: "string",
          description: "Inline task text (alternative to --task-file)",
        },
        "task-amend": {
          type: "string",
          description: "Additional text appended to the task",
        },
        model: { type: "string", description: "Claude model (default: opus)" },
        "max-turns": {
          type: "string",
          description: "Max agentic turns (default: 20, 0 = unlimited)",
        },
        output: {
          type: "string",
          description: "Write the NDJSON trace to a file",
        },
        "facilitator-cwd": {
          type: "string",
          description: "Facilitator working directory",
        },
        "facilitator-profile": {
          type: "string",
          description: "Facilitator profile name",
        },
        "agent-profiles": {
          type: "string",
          description:
            "Comma-separated list of participant profile names (required)",
        },
        "agent-cwd": {
          type: "string",
          description: "Working directory shared by participants (default: .)",
        },
      },
    },
    {
      name: "output",
      args: "",
      description:
        "Read NDJSON from stdin and emit a structured or readable form",
    },
    {
      name: "tee",
      args: "[output.ndjson]",
      description:
        "Stream readable text to stdout while saving raw NDJSON to a file",
    },
  ],
  globalOptions: {
    format: { type: "string", description: "Output format (json|text)" },
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
    json: { type: "boolean", description: "Output help as JSON" },
  },
  examples: [
    "fit-eval run --task-file=task.md --output=trace.ndjson",
    "fit-eval supervise --task-file=task.md --supervisor-profile=judge --agent-profile=coder --output=trace.ndjson",
    'fit-eval facilitate --task-file=task.md --facilitator-profile=lead --agent-profiles="security-engineer,technical-writer" --output=trace.ndjson',
    "fit-eval output --format=text < trace.ndjson",
  ],
  documentation: [
    {
      title: "Agent Evaluations",
      url: "https://www.forwardimpact.team/docs/libraries/agent-evaluations/index.md",
      description:
        "Author a judge profile, run an eval locally, wire it into CI, and inspect the resulting trace.",
    },
    {
      title: "Agent Collaboration",
      url: "https://www.forwardimpact.team/docs/libraries/agent-collaboration/index.md",
      description:
        "Author a facilitator and participant profiles, run a multi-agent session, and read the message flow.",
    },
    {
      title: "Trace Analysis",
      url: "https://www.forwardimpact.team/docs/libraries/trace-analysis/index.md",
      description:
        "Read the NDJSON traces produced by `fit-eval` with `fit-trace` — grounded-theory method and worked examples.",
    },
    {
      title: "Agent Teams",
      url: "https://www.forwardimpact.team/docs/products/agent-teams/index.md",
      description:
        "How to author the agent, supervisor, and facilitator profiles consumed by --agent-profile, --supervisor-profile, --facilitator-profile, and --agent-profiles.",
    },
  ],
};

const cli = createCli(definition);
const logger = createLogger("eval");

const COMMANDS = {
  output: runOutputCommand,
  tee: runTeeCommand,
  run: runRunCommand,
  supervise: runSuperviseCommand,
  facilitate: runFacilitateCommand,
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

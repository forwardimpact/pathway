#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createCli } from "@forwardimpact/libcli";

import { runMemoCommand } from "../src/commands/memo.js";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const definition = {
  name: "fit-wiki",
  version: VERSION,
  description: "Wiki lifecycle management for the Kata agent system",
  commands: [
    {
      name: "memo",
      description:
        "Append a cross-team observation to a teammate's wiki summary",
      options: {
        from: {
          type: "string",
          description:
            "Sender agent name (falls back to LIBEVAL_AGENT_PROFILE env var)",
        },
        to: {
          type: "string",
          description:
            'Target agent name, or "all" to broadcast to every agent',
        },
        message: {
          type: "string",
          description: "Observation text",
        },
        "wiki-root": {
          type: "string",
          description: "Override wiki root directory (default: auto-detected)",
        },
      },
    },
  ],
  globalOptions: {
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
    json: {
      type: "boolean",
      description: "Render --help output as JSON",
    },
  },
  examples: [
    'fit-wiki memo --from staff-engineer --to security-engineer --message "audit d642ff0c"',
    'fit-wiki memo --from technical-writer --to all --message "new XmR baseline"',
  ],
  documentation: [
    {
      title: "Wiki Operations",
      url: "https://www.forwardimpact.team/docs/libraries/wiki-operations/index.md",
      description:
        "Send cross-team observations, discover agents, and manage wiki markers.",
    },
  ],
};

const cli = createCli(definition);

const COMMANDS = {
  memo: runMemoCommand,
};

function main() {
  const parsed = cli.parse(process.argv.slice(2));
  if (!parsed) process.exit(0);

  const { values, positionals } = parsed;

  if (positionals.length === 0) {
    cli.showHelp();
    process.exit(0);
  }

  const [command, ...args] = positionals;
  const handler = COMMANDS[command];

  if (!handler) {
    cli.usageError(`unknown command "${command}"`);
    process.exit(2);
  }

  handler(values, args, cli);
}

main();

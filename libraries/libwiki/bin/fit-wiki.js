#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createCli } from "@forwardimpact/libcli";

import { runMemoCommand } from "../src/commands/memo.js";
import { runRefreshCommand } from "../src/commands/refresh.js";
import { runInitCommand } from "../src/commands/init.js";
import { runPushCommand, runPullCommand } from "../src/commands/sync.js";

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
      description: "Send a cross-team memo into a teammate's Message Inbox",
      options: {
        from: {
          type: "string",
          description:
            "Sender agent name (falls back to LIBEVAL_AGENT_PROFILE env var)",
        },
        to: {
          type: "string",
          description:
            'Target agent name, or "all" to broadcast (sender is skipped)',
        },
        message: {
          type: "string",
          description: "Memo text",
        },
        "wiki-root": {
          type: "string",
          description: "Override wiki root directory (default: auto-detected)",
        },
      },
    },
    {
      name: "refresh",
      description:
        "Regenerate XmR chart blocks inside a storyboard markdown file",
      args: "[storyboard-path]",
    },
    {
      name: "init",
      description: "Bootstrap a wiki working tree for a Kata installation",
      options: {
        "wiki-root": {
          type: "string",
          description: "Override wiki root directory (default: wiki)",
        },
        "skills-dir": {
          type: "string",
          description: "Override skills directory (default: .claude/skills)",
        },
      },
    },
    {
      name: "push",
      description: "Commit and push local wiki changes to the remote",
      options: {
        "wiki-root": {
          type: "string",
          description: "Override wiki root directory (default: wiki)",
        },
      },
    },
    {
      name: "pull",
      description: "Pull remote wiki changes into the local working tree",
      options: {
        "wiki-root": {
          type: "string",
          description: "Override wiki root directory (default: wiki)",
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
    "fit-wiki refresh",
    "fit-wiki refresh wiki/storyboard-2026-M05.md",
    "fit-wiki init",
    "fit-wiki push",
    "fit-wiki pull",
  ],
  documentation: [
    {
      title: "Operate a Predictable Agent Team",
      url: "https://www.forwardimpact.team/docs/libraries/predictable-team/index.md",
      description:
        "End-to-end guide to wiki memory, XmR charts, and team coordination.",
    },
    {
      title: "Send a Memo or Update a Storyboard",
      url: "https://www.forwardimpact.team/docs/libraries/predictable-team/wiki-operations/index.md",
      description:
        "Send cross-team memos, refresh storyboard charts, and sync the wiki.",
    },
  ],
};

const cli = createCli(definition);

const COMMANDS = {
  memo: runMemoCommand,
  refresh: runRefreshCommand,
  init: runInitCommand,
  push: runPushCommand,
  pull: runPullCommand,
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

#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createCli } from "@forwardimpact/libcli";
import { createLogger } from "@forwardimpact/libtelemetry";

import {
  runRunsCommand,
  runDownloadCommand,
  runOverviewCommand,
  runCountCommand,
  runBatchCommand,
  runHeadCommand,
  runTailCommand,
  runSearchCommand,
  runToolsCommand,
  runToolCommand,
  runErrorsCommand,
  runReasoningCommand,
  runTimelineCommand,
  runStatsCommand,
} from "../src/commands/trace.js";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const definition = {
  name: "fit-trace",
  version: VERSION,
  description: "Download, query, and search agent execution traces",
  commands: [
    {
      name: "runs",
      args: "[pattern]",
      description: "List recent workflow runs (default pattern: kata)",
      options: {
        lookback: {
          type: "string",
          description: "How far back to search (default: 7d)",
        },
        repo: {
          type: "string",
          description: "GitHub repo override (default: git remote)",
        },
      },
    },
    {
      name: "download",
      args: "<run-id>",
      description: "Download trace artifact and convert to structured JSON",
      options: {
        dir: { type: "string", description: "Output directory" },
        artifact: { type: "string", description: "Artifact name override" },
        repo: {
          type: "string",
          description: "GitHub repo override (default: git remote)",
        },
      },
    },
    {
      name: "overview",
      args: "<file>",
      description: "Metadata, summary, turn count, tool frequency",
    },
    {
      name: "count",
      args: "<file>",
      description: "Number of turns",
    },
    {
      name: "batch",
      args: "<file> <from> <to>",
      description: "Turns in range [from, to) (zero-indexed)",
    },
    {
      name: "head",
      args: "<file> [N]",
      description: "First N turns (default 10)",
    },
    {
      name: "tail",
      args: "<file> [N]",
      description: "Last N turns (default 10)",
    },
    {
      name: "search",
      args: "<file> <pattern>",
      description: "Search all content for regex pattern",
      options: {
        limit: {
          type: "string",
          description: "Max results (default: 50)",
        },
        context: {
          type: "string",
          description: "Surrounding turns per hit (default: 0)",
        },
      },
    },
    {
      name: "tools",
      args: "<file>",
      description: "Tool usage frequency (descending)",
    },
    {
      name: "tool",
      args: "<file> <name>",
      description: "All turns involving a specific tool",
    },
    {
      name: "errors",
      args: "<file>",
      description: "Tool results with isError=true",
    },
    {
      name: "reasoning",
      args: "<file>",
      description: "Agent reasoning text only",
      options: {
        from: { type: "string", description: "Start at turn index" },
        to: { type: "string", description: "Stop before turn index" },
      },
    },
    {
      name: "timeline",
      args: "<file>",
      description: "Compact one-line-per-turn overview",
    },
    {
      name: "stats",
      args: "<file>",
      description: "Token usage and cost breakdown",
    },
  ],
  globalOptions: {
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
    json: { type: "boolean", description: "Output help as JSON" },
  },
  examples: [
    "fit-trace runs --lookback 7d",
    "fit-trace download 24497273755",
    "fit-trace overview structured.json",
    "fit-trace timeline structured.json",
    "fit-trace search structured.json 'error|fail' --context 1",
    "fit-trace tool structured.json Bash",
    "fit-trace batch structured.json 0 20",
  ],
};

const cli = createCli(definition);
const logger = createLogger("trace");

const COMMANDS = {
  runs: runRunsCommand,
  download: runDownloadCommand,
  overview: runOverviewCommand,
  count: runCountCommand,
  batch: runBatchCommand,
  head: runHeadCommand,
  tail: runTailCommand,
  search: runSearchCommand,
  tools: runToolsCommand,
  tool: runToolCommand,
  errors: runErrorsCommand,
  reasoning: runReasoningCommand,
  timeline: runTimelineCommand,
  stats: runStatsCommand,
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

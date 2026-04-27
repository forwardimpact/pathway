#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createCli } from "@forwardimpact/libcli";

import { runAnalyzeCommand } from "../src/commands/analyze.js";
import { runListCommand } from "../src/commands/list.js";
import { runValidateCommand } from "../src/commands/validate.js";
import { runSparkCommand } from "../src/commands/spark.js";
import { runSummarizeCommand } from "../src/commands/summarize.js";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const definition = {
  name: "fit-xmr",
  version: VERSION,
  description: "XmR control chart analysis for time-series CSV metrics",
  commands: [
    {
      name: "analyze",
      args: "<csv-path>",
      description: "Full XmR control chart report",
      options: {
        metric: {
          type: "string",
          short: "m",
          description: "Filter to a single metric by name",
        },
      },
    },
    {
      name: "list",
      args: "<csv-path>",
      description: "List metrics with counts and date ranges",
    },
    {
      name: "validate",
      args: "<csv-path>",
      description: "Validate CSV against the metrics schema",
    },
    {
      name: "spark",
      args: "<csv-path>",
      description: "Braille sparkline of last 12 points (for markdown tables)",
      options: {
        metric: {
          type: "string",
          short: "m",
          description: "Metric name (required)",
        },
      },
    },
    {
      name: "summarize",
      args: "<csv-path>",
      description:
        "Compact markdown table of XmR stats and classification per metric",
      options: {
        metric: {
          type: "string",
          short: "m",
          description: "Filter to a single metric by name",
        },
      },
    },
  ],
  globalOptions: {
    format: {
      type: "string",
      description: "Output format (text|json, default: text)",
    },
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
    json: { type: "boolean", description: "Output help as JSON" },
  },
  examples: [
    "fit-xmr analyze wiki/metrics/security-engineer/audit/2026.csv",
    "fit-xmr analyze wiki/metrics/security-engineer/audit/2026.csv --metric open_vulnerabilities",
    "fit-xmr analyze wiki/metrics/security-engineer/audit/2026.csv --format json",
    "fit-xmr list wiki/metrics/security-engineer/audit/2026.csv",
    "fit-xmr validate wiki/metrics/security-engineer/audit/2026.csv",
    "fit-xmr spark wiki/metrics/security-engineer/audit/2026.csv --metric open_vulnerabilities",
    "fit-xmr summarize wiki/metrics/security-engineer/audit/2026.csv",
    "fit-xmr summarize wiki/metrics/security-engineer/audit/2026.csv --format json",
  ],
};

const cli = createCli(definition);

const COMMANDS = {
  analyze: runAnalyzeCommand,
  list: runListCommand,
  validate: runValidateCommand,
  spark: runSparkCommand,
  summarize: runSummarizeCommand,
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

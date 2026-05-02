#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { createCli } from "@forwardimpact/libcli";

import { runAnalyzeCommand } from "../src/commands/analyze.js";
import { runListCommand } from "../src/commands/list.js";
import { runValidateCommand } from "../src/commands/validate.js";
import { runChartCommand } from "../src/commands/chart.js";
import { runSummarizeCommand } from "../src/commands/summarize.js";

const { version: VERSION } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const definition = {
  name: "fit-xmr",
  version: VERSION,
  description: "Wheeler/Vacanti XmR control charts for time-series CSV metrics",
  commands: [
    {
      name: "analyze",
      args: "<csv-path>",
      description:
        "Full XmR control chart report — chart, limits, signals, classification",
      options: {
        metric: {
          type: "string",
          short: "m",
          description: "Filter to a single metric by name",
        },
      },
    },
    {
      name: "chart",
      args: "<csv-path>",
      description:
        "Render the 14-line Wheeler/Vacanti XmR chart for a single metric",
      options: {
        metric: {
          type: "string",
          short: "m",
          description:
            "Metric name (optional when the CSV carries exactly one metric)",
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
      description:
        "Command output format: text (default) or json. Charts are text-only.",
    },
    ascii: {
      type: "boolean",
      description: "Render charts with ASCII glyphs instead of Unicode",
    },
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
    json: {
      type: "boolean",
      description:
        "Render the --help output itself as JSON (separate from --format)",
    },
  },
  examples: [
    "fit-xmr analyze wiki/metrics/security-engineer/audit/2026.csv",
    "fit-xmr analyze wiki/metrics/security-engineer/audit/2026.csv --metric open_vulnerabilities",
    "fit-xmr analyze wiki/metrics/security-engineer/audit/2026.csv --format json",
    "fit-xmr chart wiki/metrics/security-engineer/audit/2026.csv --metric open_vulnerabilities",
    "fit-xmr chart wiki/metrics/security-engineer/audit/2026.csv --metric open_vulnerabilities --ascii",
    "fit-xmr list wiki/metrics/security-engineer/audit/2026.csv",
    "fit-xmr validate wiki/metrics/security-engineer/audit/2026.csv",
    "fit-xmr summarize wiki/metrics/security-engineer/audit/2026.csv",
    "fit-xmr summarize wiki/metrics/security-engineer/audit/2026.csv --format json",
  ],
  documentation: [
    {
      title: "XmR Analysis",
      url: "https://www.forwardimpact.team/docs/libraries/xmr-analysis/index.md",
      description:
        "Distinguish stable processes from special causes with Wheeler/Vacanti XmR control charts — CSV schema, the three detection rules, the 14-line chart, and how to read the report.",
    },
  ],
};

const cli = createCli(definition);

const COMMANDS = {
  analyze: runAnalyzeCommand,
  chart: runChartCommand,
  list: runListCommand,
  validate: runValidateCommand,
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

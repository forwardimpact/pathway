#!/usr/bin/env node
/**
 * Landmark CLI
 *
 * Analysis and recommendation layer on top of Map activity data.
 *
 * Usage:
 *   npx fit-landmark <command> [options]
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createCli } from "@forwardimpact/libcli";

import { runOrgCommand } from "../src/commands/org.js";
import { runSnapshotCommand } from "../src/commands/snapshot.js";
import { runMarkerCommand } from "../src/commands/marker.js";
import { runEvidenceCommand } from "../src/commands/evidence.js";
import { runReadinessCommand } from "../src/commands/readiness.js";
import { runTimelineCommand } from "../src/commands/timeline.js";
import { runCoverageCommand } from "../src/commands/coverage.js";
import { runPracticeCommand } from "../src/commands/practice.js";
import { runPracticedCommand } from "../src/commands/practiced.js";
import { runHealthCommand } from "../src/commands/health.js";
import { runVoiceCommand } from "../src/commands/voice.js";
import { runInitiativeCommand } from "../src/commands/initiative.js";
import { resolveDataDir } from "../src/lib/cli.js";
import { buildContext } from "../src/lib/context.js";
import { SupabaseUnavailableError } from "../src/lib/supabase.js";
import { formatResult } from "../src/formatters/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const VERSION = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8"),
).version;

const COMMANDS = {
  org: { handler: runOrgCommand, needsSupabase: true },
  snapshot: { handler: runSnapshotCommand, needsSupabase: true },
  marker: { handler: runMarkerCommand, needsSupabase: false },
  evidence: { handler: runEvidenceCommand, needsSupabase: true },
  readiness: { handler: runReadinessCommand, needsSupabase: true },
  timeline: { handler: runTimelineCommand, needsSupabase: true },
  coverage: { handler: runCoverageCommand, needsSupabase: true },
  practice: { handler: runPracticeCommand, needsSupabase: true },
  practiced: { handler: runPracticedCommand, needsSupabase: true },
  health: { handler: runHealthCommand, needsSupabase: true },
  voice: { handler: runVoiceCommand, needsSupabase: true },
  initiative: { handler: runInitiativeCommand, needsSupabase: true },
};

const definition = {
  name: "fit-landmark",
  version: VERSION,
  description: "Landmark — analysis and recommendations on top of Map data.",
  commands: [
    { name: "org show", description: "Show full organization directory" },
    {
      name: "org team",
      description: "Show hierarchy under a manager",
      options: {
        manager: { type: "string", description: "Filter by manager email" },
      },
    },
    { name: "snapshot list", description: "List available snapshots" },
    {
      name: "snapshot show",
      description: "Show factor/driver scores for a snapshot",
      options: {
        snapshot: { type: "string", description: "Snapshot id" },
        manager: { type: "string", description: "Filter by manager email" },
      },
    },
    {
      name: "snapshot trend",
      description: "Track item trend across snapshots",
      options: {
        item: { type: "string", description: "Driver/item id for trend" },
        manager: { type: "string", description: "Filter by manager email" },
      },
    },
    {
      name: "snapshot compare",
      description: "Compare snapshot against benchmarks",
      options: {
        snapshot: { type: "string", description: "Snapshot id" },
        manager: { type: "string", description: "Filter by manager email" },
      },
    },
    {
      name: "evidence",
      description: "Show marker-linked evidence",
      options: {
        skill: { type: "string", description: "Filter by skill id" },
        email: { type: "string", description: "Filter by person email" },
      },
    },
    {
      name: "practice",
      description: "Show practice-pattern aggregates",
      options: {
        skill: { type: "string", description: "Filter by skill id" },
        manager: { type: "string", description: "Filter by manager email" },
      },
    },
    {
      name: "marker",
      args: "<skill>",
      description: "Show marker definitions for a skill",
      options: {
        level: { type: "string", description: "Filter by level" },
      },
    },
    {
      name: "health",
      description: "Show health view with driver scores and evidence",
      options: {
        manager: { type: "string", description: "Filter by manager email" },
      },
    },
    {
      name: "readiness",
      description: "Show promotion readiness checklist",
      options: {
        email: { type: "string", description: "Filter by person email" },
        target: { type: "string", description: "Readiness target level" },
      },
    },
    {
      name: "timeline",
      description: "Show individual growth timeline",
      options: {
        email: { type: "string", description: "Filter by person email" },
        skill: { type: "string", description: "Filter by skill id" },
      },
    },
    {
      name: "initiative list",
      description: "List active initiatives",
      options: {
        manager: { type: "string", description: "Filter by manager email" },
      },
    },
    {
      name: "initiative show",
      description: "Show initiative detail",
      options: {
        id: { type: "string", description: "Entity id" },
      },
    },
    {
      name: "initiative impact",
      description: "Show initiative impact on scores",
      options: {
        manager: { type: "string", description: "Filter by manager email" },
      },
    },
    {
      name: "coverage",
      description: "Show evidence coverage metrics",
      options: {
        email: { type: "string", description: "Filter by person email" },
      },
    },
    {
      name: "practiced",
      description: "Show evidenced vs derived capability",
      options: {
        manager: { type: "string", description: "Filter by manager email" },
      },
    },
    {
      name: "voice",
      description: "Surface engineer voice from GetDX comments",
      options: {
        manager: { type: "string", description: "Filter by manager email" },
        email: { type: "string", description: "Filter by person email" },
      },
    },
  ],
  globalOptions: {
    data: { type: "string", description: "Path to Map data directory" },
    format: {
      type: "string",
      default: "text",
      description: "Output format (text|json|markdown)",
    },
    help: { type: "boolean", short: "h", description: "Show help" },
    version: { type: "boolean", short: "v", description: "Show version" },
  },
  examples: [
    "fit-landmark org show",
    "fit-landmark snapshot list",
    "fit-landmark marker task_completion",
    "fit-landmark health --manager alice@example.com",
  ],
  documentation: [
    {
      title: "Landmark Overview",
      url: "https://www.forwardimpact.team/landmark/index.md",
      description: "Product overview, audience model, and key concepts.",
    },
    {
      title: "Getting Started: Landmark for Leaders",
      url: "https://www.forwardimpact.team/docs/getting-started/leaders/landmark/index.md",
      description: "From zero to your first engineering outcome measurement.",
    },
    {
      title: "Demonstrate Engineering Progress",
      url: "https://www.forwardimpact.team/docs/products/engineering-outcomes/index.md",
      description:
        "Show evidence of engineering progress without blaming individuals.",
    },
    {
      title: "Tell Whether Culture Investments Are Working",
      url: "https://www.forwardimpact.team/docs/products/engineering-outcomes/culture-investments/index.md",
      description: "Track initiative impact through outcome trends.",
    },
    {
      title: "Find Growth Areas and Build Evidence",
      url: "https://www.forwardimpact.team/docs/products/growth-areas/index.md",
      description: "Identify gaps and track progress toward the next level.",
    },
    {
      title: "Check Progress Toward Next Level",
      url: "https://www.forwardimpact.team/docs/products/growth-areas/check-progress/index.md",
      description: "See where you stand against level expectations.",
    },
  ],
};

async function main() {
  const cli = createCli(definition);
  const parsed = cli.parse(process.argv.slice(2));
  if (!parsed) process.exit(0);

  const { values, positionals } = parsed;
  const [command, ...args] = positionals;

  if (!command) {
    cli.showHelp();
    process.exit(0);
  }

  const entry = COMMANDS[command];
  if (!entry) {
    cli.usageError(`unknown command "${command}"`);
    process.exit(2);
  }

  try {
    const dataDir = resolveDataDir(values);
    const ctx = await buildContext({
      dataDir,
      options: values,
      needsSupabase: entry.needsSupabase,
    });

    const result = await entry.handler({
      args,
      options: values,
      mapData: ctx.mapData,
      supabase: ctx.supabase,
      format: ctx.format,
    });

    const output = formatResult(command, result);
    process.stdout.write(output);

    if (result.meta?.warnings?.length > 0) {
      for (const w of result.meta.warnings) {
        process.stderr.write(`  warning: ${w}\n`);
      }
    }
  } catch (error) {
    if (error instanceof SupabaseUnavailableError) {
      cli.error(error.message);
      process.exit(3);
    }
    cli.error(error.message);
    process.exit(1);
  }
}

main();

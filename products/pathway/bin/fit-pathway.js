#!/usr/bin/env node
/**
 * Engineering Pathway CLI
 *
 * A command-line interface for browsing and generating job definitions,
 * interview questions, career progression analysis, and AI agent configurations.
 *
 * Usage:
 *   npx fit-pathway <command> [options]
 */

import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import fs from "fs/promises";
import { homedir } from "os";
import { createDataLoader } from "@forwardimpact/map/loader";
import { validateAllData } from "@forwardimpact/map/validation";
import { Finder } from "@forwardimpact/libutil";
import { createLogger } from "@forwardimpact/libtelemetry";
import { createCli } from "@forwardimpact/libcli";
import { createTemplateLoader } from "@forwardimpact/libtemplate";

// Import command handlers
import { runDisciplineCommand } from "../src/commands/discipline.js";
import { runLevelCommand } from "../src/commands/level.js";
import { runTrackCommand } from "../src/commands/track.js";
import { runBehaviourCommand } from "../src/commands/behaviour.js";
import { runSkillCommand } from "../src/commands/skill.js";
import { runDriverCommand } from "../src/commands/driver.js";
import { runStageCommand } from "../src/commands/stage.js";
import { runToolCommand } from "../src/commands/tool.js";
import { runJobCommand } from "../src/commands/job.js";
import { runInterviewCommand } from "../src/commands/interview.js";
import { runProgressCommand } from "../src/commands/progress.js";
import { runQuestionsCommand } from "../src/commands/questions.js";
import { runAgentCommand } from "../src/commands/agent.js";
import { runDevCommand } from "../src/commands/dev.js";
import { runBuildCommand } from "../src/commands/build.js";
import { runUpdateCommand } from "../src/commands/update.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, "..", "templates");

/** Package version read from package.json */
const VERSION = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8"),
).version;

const COMMANDS = {
  discipline: runDisciplineCommand,
  level: runLevelCommand,
  track: runTrackCommand,
  behaviour: runBehaviourCommand,
  skill: runSkillCommand,
  driver: runDriverCommand,
  stage: runStageCommand,
  tool: runToolCommand,
  job: runJobCommand,
  interview: runInterviewCommand,
  progress: runProgressCommand,
  questions: runQuestionsCommand,
  agent: runAgentCommand,
};

const definition = {
  name: "fit-pathway",
  version: VERSION,
  description: "Career progression for engineering frameworks",
  commands: [
    { name: "discipline", args: "[<id>]", description: "Show disciplines" },
    { name: "level", args: "[<id>]", description: "Show levels" },
    { name: "track", args: "[<id>]", description: "Show tracks" },
    { name: "behaviour", args: "[<id>]", description: "Show behaviours" },
    { name: "skill", args: "[<id>]", description: "Show skills" },
    { name: "driver", args: "[<id>]", description: "Show drivers" },
    { name: "stage", args: "[<id>]", description: "Show stages" },
    { name: "tool", args: "[<name>]", description: "Show tools" },
    {
      name: "job",
      args: "[<discipline> <level>]",
      description: "Generate job definition",
    },
    {
      name: "interview",
      args: "<discipline> <level>",
      description: "Generate interview questions",
    },
    {
      name: "progress",
      args: "<discipline> <level>",
      description: "Career progression analysis",
    },
    {
      name: "questions",
      args: "[options]",
      description: "Browse interview questions",
    },
    {
      name: "agent",
      args: "[<discipline>]",
      description: "Generate AI agent profile",
    },
    {
      name: "dev",
      args: "[--port=PORT]",
      description: "Run live development server",
    },
    {
      name: "build",
      args: "[--output=PATH]",
      description: "Generate static site",
    },
    {
      name: "update",
      args: "[--url=URL]",
      description: "Update local installation",
    },
  ],
  options: {
    list: {
      type: "boolean",
      short: "l",
      description: "Output IDs only (for piping)",
    },
    json: { type: "boolean", description: "Output as JSON" },
    data: { type: "string", description: "Path to data directory" },
    track: { type: "string", description: "Track specialization" },
    level: { type: "string", description: "Target level" },
    type: { type: "string", description: "Interview type", default: "full" },
    compare: { type: "string", description: "Compare to level" },
    format: { type: "string", description: "Output format" },
    output: { type: "string", description: "Output path" },
    stage: { type: "string", description: "Lifecycle stage" },
    checklist: { type: "string", description: "Handoff checklist stage" },
    maturity: {
      type: "string",
      description: "Filter by behaviour maturity",
    },
    skill: { type: "string", description: "Filter by skill ID" },
    behaviour: { type: "string", description: "Filter by behaviour ID" },
    capability: { type: "string", description: "Filter by capability" },
    port: { type: "string", description: "Dev server port" },
    path: { type: "string", description: "File path" },
    url: { type: "string", description: "URL for update" },
    role: { type: "string", description: "Role filter" },
    stats: { type: "boolean", description: "Show detailed statistics" },
    "all-stages": { type: "boolean", description: "Show all stages" },
    agent: { type: "boolean", description: "Output as agent format" },
    skills: { type: "boolean", description: "Output skill IDs" },
    tools: { type: "boolean", description: "Output tool names" },
    clean: { type: "boolean", default: true, description: "Clean build" },
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", short: "v", description: "Show version" },
  },
  examples: [
    "fit-pathway discipline backend",
    "fit-pathway job software_engineering J060 --track=platform",
    "fit-pathway interview software_engineering J060 --json",
    "fit-pathway agent software_engineering --track=platform",
  ],
};

/**
 * Main CLI entry point
 */
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

  let dataDir;
  if (values.data) {
    dataDir = resolve(values.data);
  } else {
    const logger = createLogger("pathway");
    const finder = new Finder(fs, logger, process);
    try {
      dataDir = join(finder.findData("data", homedir()), "pathway");
    } catch {
      cli.error(
        "No data directory found. Use --data=<path> to specify location.",
      );
      process.exit(1);
    }
  }

  if (command === "dev") {
    await runDevCommand({ dataDir, options: values });
    return;
  }

  if (command === "build") {
    await runBuildCommand({ dataDir, options: values });
    process.exit(0);
  }

  if (command === "update") {
    await runUpdateCommand({ dataDir, options: values });
    process.exit(0);
  }

  const handler = COMMANDS[command];

  if (!handler) {
    cli.usageError(`unknown command "${command}"`);
    process.exit(2);
  }

  try {
    const loader = createDataLoader();
    const templateLoader = createTemplateLoader(TEMPLATE_DIR);

    const data = await loader.loadAllData(dataDir);
    validateAllData(data);

    await handler({
      data,
      args,
      options: values,
      dataDir,
      templateLoader,
      loader,
    });
  } catch (error) {
    cli.error(error.message);
    process.exit(1);
  }
}

main();

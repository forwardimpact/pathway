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
    {
      name: "discipline",
      args: "[<id>]",
      description: "Show disciplines",
      options: {
        stats: { type: "boolean", description: "Show detailed statistics" },
      },
    },
    { name: "level", args: "[<id>]", description: "Show levels" },
    { name: "track", args: "[<id>]", description: "Show tracks" },
    {
      name: "behaviour",
      args: "[<id>]",
      description: "Show behaviours",
      options: {
        maturity: {
          type: "string",
          description: "Filter by behaviour maturity",
        },
      },
    },
    {
      name: "skill",
      args: "[<id>]",
      description: "Show skills",
      options: {
        skill: { type: "string", description: "Filter by skill ID" },
        stats: { type: "boolean", description: "Show detailed statistics" },
      },
    },
    { name: "driver", args: "[<id>]", description: "Show drivers" },
    { name: "tool", args: "[<name>]", description: "Show tools" },
    {
      name: "job",
      args: "[<discipline> <level>]",
      description: "Generate job definition",
      options: {
        track: { type: "string", description: "Track specialization" },
        level: { type: "string", description: "Target level" },
        output: { type: "string", description: "Output path" },
        capability: { type: "string", description: "Filter by capability" },
      },
    },
    {
      name: "interview",
      args: "<discipline> <level>",
      description: "Generate interview questions",
      options: {
        track: { type: "string", description: "Track specialization" },
        level: { type: "string", description: "Target level" },
        type: {
          type: "string",
          description: "Interview type",
          default: "full",
        },
      },
    },
    {
      name: "progress",
      args: "<discipline> <level>",
      description: "Career progression analysis",
      options: {
        track: { type: "string", description: "Track specialization" },
        level: { type: "string", description: "Target level" },
        compare: { type: "string", description: "Compare to level" },
      },
    },
    {
      name: "questions",
      args: "[options]",
      description: "Browse interview questions",
      options: {
        skill: { type: "string", description: "Filter by skill ID" },
        behaviour: { type: "string", description: "Filter by behaviour ID" },
        capability: { type: "string", description: "Filter by capability" },
        role: { type: "string", description: "Role filter" },
      },
    },
    {
      name: "agent",
      args: "[<discipline>]",
      description: "Generate AI agent profile",
      options: {
        track: { type: "string", description: "Track specialization" },
        level: { type: "string", description: "Target level" },
        agent: { type: "boolean", description: "Output as agent format" },
        skills: { type: "boolean", description: "Output skill IDs" },
        tools: { type: "boolean", description: "Output tool names" },
      },
    },
    {
      name: "dev",
      args: "",
      description: "Run live development server",
      options: {
        port: { type: "string", description: "Dev server port" },
      },
    },
    {
      name: "build",
      args: "",
      description: "Generate static site",
      options: {
        output: { type: "string", description: "Output path" },
        path: { type: "string", description: "File path" },
        clean: { type: "boolean", default: true, description: "Clean build" },
      },
    },
    {
      name: "update",
      args: "",
      description: "Update local installation",
      options: {
        url: { type: "string", description: "URL for update" },
      },
    },
  ],
  globalOptions: {
    list: {
      type: "boolean",
      short: "l",
      description: "Output IDs only (for piping)",
    },
    json: { type: "boolean", description: "Output as JSON" },
    data: { type: "string", description: "Path to data directory" },
    format: { type: "string", description: "Output format" },
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

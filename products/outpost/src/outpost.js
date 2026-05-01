#!/usr/bin/env bun

// Outpost — CLI and scheduler for autonomous agent teams.
//
// Usage:
//   fit-outpost                     Wake due agents once and exit
//   fit-outpost daemon              Run continuously (poll every 60s)
//   fit-outpost wake <agent>        Wake a specific agent immediately
//   fit-outpost init <path>         Initialize a new knowledge base
//   fit-outpost update [path]       Update KB with latest CLAUDE.md, agents and skills
//   fit-outpost stop                Gracefully stop daemon and all running agents
//   fit-outpost validate            Validate agent definitions exist
//   fit-outpost status              Show agent status
//   fit-outpost --help              Show this help

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  cpSync,
  appendFileSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { createCli } from "@forwardimpact/libcli";
import { createLogger } from "@forwardimpact/libtelemetry";

const logger = createLogger("outpost");

import * as posixSpawn from "@forwardimpact/libmacos/posix-spawn";
import { StateManager } from "./state-manager.js";
import { AgentRunner } from "./agent-runner.js";
import { Scheduler } from "./scheduler.js";
import { KBManager } from "./kb-manager.js";
import { SocketServer, requestShutdown } from "./socket-server.js";

// --- Paths -------------------------------------------------------------------

const HOME = homedir();
const OUTPOST_HOME = join(HOME, ".fit", "outpost");
const CONFIG_PATH = join(OUTPOST_HOME, "scheduler.json");
const STATE_PATH = join(OUTPOST_HOME, "state.json");
const LOG_DIR = join(OUTPOST_HOME, "logs");
const CACHE_DIR = join(HOME, ".cache", "fit", "outpost");
const __dirname =
  import.meta.dirname || dirname(fileURLToPath(import.meta.url));
const SHARE_DIR = "/usr/local/share/fit-outpost";
const SOCKET_PATH = join(OUTPOST_HOME, "outpost.sock");

// In compiled binaries (bun build --compile), `bun build --define` injects the
// version string here so the readFileSync branch is eliminated as dead code.
// Source execution (bun src/outpost.js) falls through to package.json.
const VERSION =
  process.env.OUTPOST_VERSION ||
  JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"))
    .version;

// --- Logging -----------------------------------------------------------------

function createFileLogger(logDir, fs) {
  if (!logDir) throw new Error("logDir is required");
  if (!fs) throw new Error("fs is required");
  fs.mkdirSync(logDir, { recursive: true });
  return function log(msg) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${msg}`;
    logger.info(line);
    fs.appendFileSync(
      join(logDir, `scheduler-${ts.slice(0, 10)}.log`),
      line + "\n",
    );
  };
}

const log = createFileLogger(LOG_DIR, { mkdirSync, appendFileSync });

// --- Config ------------------------------------------------------------------

function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return { agents: {} };
  }
}

function expandPath(p) {
  return p.startsWith("~/") ? join(HOME, p.slice(2)) : resolve(p);
}

// --- Wire dependencies -------------------------------------------------------

const fsOps = { readFileSync, writeFileSync, mkdirSync };
const stateManager = new StateManager(STATE_PATH, fsOps);
const agentRunner = new AgentRunner(posixSpawn, stateManager, log, CACHE_DIR);
const scheduler = new Scheduler(loadConfig, stateManager, agentRunner, log);
const kbManager = new KBManager(
  {
    existsSync,
    mkdirSync,
    copyFileSync,
    cpSync,
    readFileSync,
    writeFileSync,
    readdirSync,
  },
  log,
);

// --- Template dir resolution -------------------------------------------------

/**
 * Detect if running from inside a macOS .app bundle.
 * @returns {{ bundle: string, resources: string } | null}
 */
function getBundlePath() {
  try {
    const exe = process.execPath || "";
    const macosDir = dirname(exe);
    const contentsDir = dirname(macosDir);
    const resourcesDir = join(contentsDir, "Resources");
    if (existsSync(join(resourcesDir, "config"))) {
      return { bundle: dirname(contentsDir), resources: resourcesDir };
    }
  } catch {
    /* not in bundle */
  }
  return null;
}

function requireTemplateDir() {
  const bundle = getBundlePath();
  if (bundle) {
    const tpl = join(bundle.resources, "templates");
    if (existsSync(tpl)) return tpl;
  }
  for (const d of [
    join(SHARE_DIR, "templates"),
    join(__dirname, "..", "templates"),
  ])
    if (existsSync(d)) return d;
  console.error("Template not found. Reinstall fit-outpost.");
  process.exit(1);
}

// --- Daemon ------------------------------------------------------------------

function daemon() {
  const daemonStartedAt = Date.now();
  log("Scheduler daemon started. Polling every 60 seconds.");
  log(`Config: ${CONFIG_PATH}  State: ${STATE_PATH}`);

  // Reset any agents left "active" from a previous daemon session.
  const state = stateManager.load();
  stateManager.resetStaleAgents(state, { reason: "Daemon restarted" }, log);

  const socketServer = new SocketServer(
    SOCKET_PATH,
    scheduler,
    agentRunner,
    stateManager,
    loadConfig,
    log,
    CACHE_DIR,
    daemonStartedAt,
  );
  socketServer.start();

  async function tick() {
    try {
      await scheduler.wakeDueAgents();
    } catch (err) {
      log(`Error: ${err.message}`);
    }
    setTimeout(tick, 60_000);
  }
  tick();
}

// --- Update ------------------------------------------------------------------

function runUpdate(args) {
  if (args[0]) {
    kbManager.update(args[0], requireTemplateDir());
    return;
  }

  const config = loadConfig();
  const kbPaths = [
    ...new Set(
      Object.values(config.agents)
        .filter((a) => a.kb)
        .map((a) => expandPath(a.kb)),
    ),
  ];

  if (kbPaths.length === 0) {
    console.error(
      "No knowledge bases configured and no path given.\n" +
        "Usage: fit-outpost update [path]",
    );
    process.exit(1);
  }

  for (const kb of kbPaths) {
    logger.info(`\nUpdating ${kb}...`);
    kbManager.update(kb, requireTemplateDir());
  }
}

// --- Status ------------------------------------------------------------------

function formatAgentStatus(name, agent, s) {
  const enabledMark = agent.enabled !== false ? "+" : "-";
  const kbStatus =
    agent.kb && !existsSync(expandPath(agent.kb)) ? " (not found)" : "";
  const lastWake = s.lastWokeAt
    ? new Date(s.lastWokeAt).toLocaleString()
    : "never";
  const lines = [
    `  ${enabledMark} ${name}`,
    `    KB: ${agent.kb || "(none)"}${kbStatus}  Schedule: ${JSON.stringify(agent.schedule)}`,
    `    Status: ${s.status || "never-woken"}  Last wake: ${lastWake}  Wakes: ${s.wakeCount || 0}`,
  ];
  if (s.lastAction) lines.push(`    Last action: ${s.lastAction}`);
  if (s.lastDecision) lines.push(`    Last decision: ${s.lastDecision}`);
  if (s.lastError) lines.push(`    Error: ${s.lastError.slice(0, 80)}`);
  return lines.join("\n");
}

function showStatus() {
  const config = loadConfig();
  const state = stateManager.load();
  logger.info("\nOutpost Scheduler\n==================\n");

  const agents = Object.entries(config.agents || {});
  if (agents.length === 0) {
    logger.info(`No agents configured.\n\nEdit ${CONFIG_PATH} to add agents.`);
    return;
  }

  logger.info("Agents:");
  for (const [name, agent] of agents) {
    logger.info(formatAgentStatus(name, agent, state.agents[name] || {}));
  }
}

// --- Validate ----------------------------------------------------------------

function findInLocalOrGlobal(kbPath, subPath) {
  const local = join(kbPath, ".claude", subPath);
  const global = join(HOME, ".claude", subPath);
  if (existsSync(local)) return local;
  if (existsSync(global)) return global;
  return null;
}

function validate() {
  const config = loadConfig();
  const agents = Object.entries(config.agents || {});
  if (agents.length === 0) {
    logger.info("No agents configured. Nothing to validate.");
    return;
  }

  logger.info("\nValidating agents...\n");
  let errors = 0;

  for (const [name, agent] of agents) {
    if (!agent.kb) {
      logger.info(`  [FAIL] ${name}: no "kb" path specified`);
      errors++;
      continue;
    }
    const kbPath = expandPath(agent.kb);
    if (!existsSync(kbPath)) {
      logger.info(`  [FAIL] ${name}: path not found: ${kbPath}`);
      errors++;
      continue;
    }

    const agentFile = join("agents", name + ".md");
    const found = findInLocalOrGlobal(kbPath, agentFile);
    logger.info(
      `  [${found ? "OK" : "FAIL"}]  ${name}: agent definition${found ? "" : " not found"}`,
    );
    if (!found) errors++;
  }

  logger.info(errors > 0 ? `\n${errors} error(s).` : "\nAll OK.");
  if (errors > 0) process.exit(1);
}

// --- CLI definition ----------------------------------------------------------

const definition = {
  name: "fit-outpost",
  version: VERSION,
  description: "Schedule autonomous agents across knowledge bases",
  commands: [
    { name: "daemon", description: "Run continuously (poll every 60s)" },
    {
      name: "wake",
      args: "<agent>",
      description: "Wake a specific agent immediately",
    },
    {
      name: "init",
      args: "<path>",
      description: "Initialize a new knowledge base",
    },
    {
      name: "update",
      args: "[path]",
      description: "Update KB with latest CLAUDE.md, agents and skills",
    },
    {
      name: "stop",
      description: "Gracefully stop daemon and all running agents",
    },
    { name: "validate", description: "Validate agent definitions exist" },
    { name: "status", description: "Show agent status" },
  ],
  globalOptions: {
    help: { type: "boolean", short: "h", description: "Show this help" },
    version: { type: "boolean", description: "Show version" },
    json: { type: "boolean", description: "JSON output (with --help)" },
  },
  documentation: [
    {
      title: "Knowledge Systems Guide",
      url: "https://www.forwardimpact.team/docs/products/knowledge-systems/index.md",
      description:
        "Task-oriented guide to setting up and using Outpost for personal knowledge management.",
    },
  ],
};

// --- CLI entry point ---------------------------------------------------------

const cli = createCli(definition);
const parsed = cli.parse(process.argv.slice(2));
if (!parsed) process.exit(0);

const { positionals } = parsed;
const [command, ...args] = positionals;

mkdirSync(OUTPOST_HOME, { recursive: true });

const COMMANDS = {
  daemon,
  wake: async () => {
    if (!args[0]) {
      cli.usageError("missing required argument <agent>");
      process.exit(2);
    }
    const config = loadConfig();
    const state = stateManager.load();
    const agent = config.agents[args[0]];
    if (!agent) {
      cli.error(
        `agent "${args[0]}" not found. Available: ${Object.keys(config.agents).join(", ") || "(none)"}`,
      );
      process.exit(1);
    }
    await agentRunner.wake(args[0], agent, state);
  },
  init: () => {
    if (!args[0]) {
      cli.usageError("missing required argument <path>");
      process.exit(2);
    }
    kbManager.init(args[0], requireTemplateDir());
  },
  update: () => runUpdate(args),
  stop: async () => {
    const stopped = await requestShutdown(SOCKET_PATH);
    if (!stopped) process.exit(1);
  },
  validate,
  status: showStatus,
};

const handler = COMMANDS[command];
if (command && !handler) {
  cli.usageError(`unknown command "${command}"`);
  process.exit(2);
}

await (handler || (() => scheduler.wakeDueAgents()))();

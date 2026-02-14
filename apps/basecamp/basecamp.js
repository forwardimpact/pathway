#!/usr/bin/env node

// Basecamp — CLI and scheduler for personal knowledge bases.
//
// Usage:
//   node basecamp.js                     Run due tasks once and exit
//   node basecamp.js --daemon            Run continuously (poll every 60s)
//   node basecamp.js --run <task>        Run a specific task immediately
//   node basecamp.js --init <path>       Initialize a new knowledge base
//   node basecamp.js --install-launchd   Install macOS LaunchAgent
//   node basecamp.js --uninstall-launchd Remove macOS LaunchAgent
//   node basecamp.js --validate          Validate agents and skills exist
//   node basecamp.js --status            Show task status
//   node basecamp.js --help              Show this help

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  chmodSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { spawn } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";

const HOME = homedir();
const BASECAMP_HOME = join(HOME, ".fit", "basecamp");
const CONFIG_PATH = join(BASECAMP_HOME, "scheduler.json");
const STATE_PATH = join(BASECAMP_HOME, "state.json");
const LOG_DIR = join(BASECAMP_HOME, "logs");
const PLIST_NAME = "com.fit-basecamp.scheduler";
const PLIST_PATH = join(HOME, "Library", "LaunchAgents", `${PLIST_NAME}.plist`);
const __dirname =
  import.meta.dirname || dirname(fileURLToPath(import.meta.url));
const KB_TEMPLATE_DIR = join(__dirname, "template");
const SOCKET_PATH = join(BASECAMP_HOME, "basecamp.sock");
const IS_COMPILED =
  typeof Deno !== "undefined" &&
  Deno.execPath &&
  !Deno.execPath().endsWith("deno");

let daemonStartedAt = null;

// --- Helpers ----------------------------------------------------------------

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readJSON(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJSON(path, data) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

function expandPath(p) {
  return p.startsWith("~/") ? join(HOME, p.slice(2)) : resolve(p);
}

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    ensureDir(LOG_DIR);
    writeFileSync(
      join(LOG_DIR, `scheduler-${ts.slice(0, 10)}.log`),
      line + "\n",
      { flag: "a" },
    );
  } catch {
    /* best effort */
  }
}

function findClaude() {
  for (const c of [
    "claude",
    "/usr/local/bin/claude",
    join(HOME, ".claude", "bin", "claude"),
    join(HOME, ".local", "bin", "claude"),
  ]) {
    try {
      execSync(`which "${c}" 2>/dev/null || command -v "${c}" 2>/dev/null`, {
        encoding: "utf8",
      });
      return c;
    } catch {}
    if (existsSync(c)) return c;
  }
  return "claude";
}

function loadConfig() {
  return readJSON(CONFIG_PATH, { tasks: {} });
}
function loadState() {
  const raw = readJSON(STATE_PATH, null);
  if (!raw || typeof raw !== "object" || !raw.tasks) {
    const state = { tasks: {} };
    saveState(state);
    return state;
  }
  return raw;
}
function saveState(state) {
  writeJSON(STATE_PATH, state);
}

// --- Cron matching ----------------------------------------------------------

function matchField(field, value) {
  if (field === "*") return true;
  if (field.startsWith("*/")) return value % parseInt(field.slice(2)) === 0;
  return field.split(",").some((part) => {
    if (part.includes("-")) {
      const [lo, hi] = part.split("-").map(Number);
      return value >= lo && value <= hi;
    }
    return parseInt(part) === value;
  });
}

function cronMatches(expr, d) {
  const [min, hour, dom, month, dow] = expr.trim().split(/\s+/);
  return (
    matchField(min, d.getMinutes()) &&
    matchField(hour, d.getHours()) &&
    matchField(dom, d.getDate()) &&
    matchField(month, d.getMonth() + 1) &&
    matchField(dow, d.getDay())
  );
}

// --- Scheduling logic -------------------------------------------------------

function floorToMinute(d) {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
  ).getTime();
}

function shouldRun(task, taskState, now) {
  if (task.enabled === false) return false;
  if (taskState.status === "running") return false;
  const { schedule } = task;
  if (!schedule) return false;
  const lastRun = taskState.lastRunAt ? new Date(taskState.lastRunAt) : null;

  if (schedule.type === "cron") {
    if (lastRun && floorToMinute(lastRun) === floorToMinute(now)) return false;
    return cronMatches(schedule.expression, now);
  }
  if (schedule.type === "interval") {
    const ms = (schedule.minutes || 5) * 60_000;
    return !lastRun || now.getTime() - lastRun.getTime() >= ms;
  }
  if (schedule.type === "once") {
    return !taskState.lastRunAt && now >= new Date(schedule.runAt);
  }
  return false;
}

// --- Task execution ---------------------------------------------------------

function runTask(taskName, task, _config, state) {
  if (!task.kb) {
    log(`Task ${taskName}: no "kb" specified, skipping.`);
    return;
  }
  const kbPath = expandPath(task.kb);
  if (!existsSync(kbPath)) {
    log(`Task ${taskName}: path "${kbPath}" does not exist, skipping.`);
    return;
  }

  const claude = findClaude();
  const prompt = task.skill
    ? `Use the skill "${task.skill}" — ${task.prompt || `Run the ${taskName} task.`}`
    : task.prompt || `Run the ${taskName} task.`;

  log(
    `Running task: ${taskName} (kb: ${task.kb}${task.agent ? `, agent: ${task.agent}` : ""}${task.skill ? `, skill: ${task.skill}` : ""})`,
  );

  const ts = (state.tasks[taskName] ||= {});
  ts.status = "running";
  ts.startedAt = new Date().toISOString();
  saveState(state);

  const spawnArgs = ["--print"];
  if (task.agent) spawnArgs.push("--agent", task.agent);
  spawnArgs.push("-p", prompt);

  return new Promise((resolve) => {
    const child = spawn(claude, spawnArgs, {
      cwd: kbPath,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30 * 60_000,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));

    child.on("close", (code) => {
      if (code === 0) {
        log(`Task ${taskName} completed. Output: ${stdout.slice(0, 200)}...`);
        Object.assign(ts, {
          status: "finished",
          startedAt: null,
          lastRunAt: new Date().toISOString(),
          lastError: null,
          runCount: (ts.runCount || 0) + 1,
        });
      } else {
        const errMsg = stderr || stdout || `Exit code ${code}`;
        log(`Task ${taskName} failed: ${errMsg.slice(0, 300)}`);
        Object.assign(ts, {
          status: "failed",
          startedAt: null,
          lastRunAt: new Date().toISOString(),
          lastError: errMsg.slice(0, 500),
        });
      }
      saveState(state);
      resolve();
    });

    child.on("error", (err) => {
      log(`Task ${taskName} failed: ${err.message}`);
      Object.assign(ts, {
        status: "failed",
        startedAt: null,
        lastRunAt: new Date().toISOString(),
        lastError: err.message.slice(0, 500),
      });
      saveState(state);
      resolve();
    });
  });
}

async function runDueTasks() {
  const config = loadConfig(),
    state = loadState(),
    now = new Date();
  let ranAny = false;
  for (const [name, task] of Object.entries(config.tasks)) {
    if (shouldRun(task, state.tasks[name] || {}, now)) {
      await runTask(name, task, config, state);
      ranAny = true;
    }
  }
  if (!ranAny) log("No tasks due.");
}

// --- Next-run computation ---------------------------------------------------

/** @param {object} task @param {object} taskState @param {Date} now */
function computeNextRunAt(task, taskState, now) {
  if (task.enabled === false) return null;
  const { schedule } = task;
  if (!schedule) return null;

  if (schedule.type === "interval") {
    const ms = (schedule.minutes || 5) * 60_000;
    const lastRun = taskState.lastRunAt ? new Date(taskState.lastRunAt) : null;
    if (!lastRun) return now.toISOString();
    return new Date(lastRun.getTime() + ms).toISOString();
  }

  if (schedule.type === "cron") {
    const limit = 24 * 60;
    const start = new Date(floorToMinute(now) + 60_000);
    for (let i = 0; i < limit; i++) {
      const candidate = new Date(start.getTime() + i * 60_000);
      if (cronMatches(schedule.expression, candidate)) {
        return candidate.toISOString();
      }
    }
    return null;
  }

  if (schedule.type === "once") {
    if (taskState.lastRunAt) return null;
    return schedule.runAt;
  }

  return null;
}

// --- Socket server ----------------------------------------------------------

/** @param {import('node:net').Socket} socket @param {object} data */
function send(socket, data) {
  try {
    socket.write(JSON.stringify(data) + "\n");
  } catch {}
}

function handleStatusRequest(socket) {
  const config = loadConfig();
  const state = loadState();
  const now = new Date();
  const tasks = {};

  for (const [name, task] of Object.entries(config.tasks)) {
    const ts = state.tasks[name] || {};
    tasks[name] = {
      enabled: task.enabled !== false,
      status: ts.status || "never-run",
      lastRunAt: ts.lastRunAt || null,
      nextRunAt: computeNextRunAt(task, ts, now),
      runCount: ts.runCount || 0,
      lastError: ts.lastError || null,
    };
    if (ts.startedAt) tasks[name].startedAt = ts.startedAt;
  }

  send(socket, {
    type: "status",
    uptime: daemonStartedAt
      ? Math.floor((Date.now() - daemonStartedAt) / 1000)
      : 0,
    tasks,
  });
}

function handleRestartRequest(socket) {
  send(socket, { type: "ack", command: "restart" });
  const uid = execSync("id -u", { encoding: "utf8" }).trim();
  setTimeout(() => {
    try {
      execSync(`launchctl kickstart -k gui/${uid}/${PLIST_NAME}`);
    } catch {
      process.exit(0);
    }
  }, 100);
}

function handleRunRequest(socket, taskName) {
  if (!taskName) {
    send(socket, { type: "error", message: "Missing task name" });
    return;
  }
  const config = loadConfig();
  const task = config.tasks[taskName];
  if (!task) {
    send(socket, { type: "error", message: `Task not found: ${taskName}` });
    return;
  }
  send(socket, { type: "ack", command: "run", task: taskName });
  const state = loadState();
  runTask(taskName, task, config, state).catch((err) => {
    console.error(`[socket] runTask error for ${taskName}:`, err.message);
  });
}

function handleMessage(socket, line) {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    send(socket, { type: "error", message: "Invalid JSON" });
    return;
  }

  const handlers = {
    status: () => handleStatusRequest(socket),
    restart: () => handleRestartRequest(socket),
    run: () => handleRunRequest(socket, request.task),
  };

  const handler = handlers[request.type];
  if (handler) {
    handler();
  } else {
    send(socket, {
      type: "error",
      message: `Unknown request type: ${request.type}`,
    });
  }
}

function startSocketServer() {
  try {
    unlinkSync(SOCKET_PATH);
  } catch {}

  const server = createServer((socket) => {
    let buffer = "";
    socket.on("data", (data) => {
      buffer += data.toString();
      let idx;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line) handleMessage(socket, line);
      }
    });
    socket.on("error", () => {});
  });

  server.listen(SOCKET_PATH, () => {
    chmodSync(SOCKET_PATH, 0o600);
    log(`Socket server listening on ${SOCKET_PATH}`);
  });

  server.on("error", (err) => {
    log(`Socket server error: ${err.message}`);
  });

  const cleanup = () => {
    server.close();
    try {
      unlinkSync(SOCKET_PATH);
    } catch {}
    process.exit(0);
  };
  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);

  return server;
}

// --- Daemon -----------------------------------------------------------------

function daemon() {
  daemonStartedAt = Date.now();
  log("Scheduler daemon started. Polling every 60 seconds.");
  log(`Config: ${CONFIG_PATH}  State: ${STATE_PATH}`);
  startSocketServer();
  runDueTasks();
  setInterval(async () => {
    try {
      await runDueTasks();
    } catch (err) {
      log(`Error: ${err.message}`);
    }
  }, 60_000);
}

// --- Init knowledge base ----------------------------------------------------

function copyDirRecursive(src, dest) {
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name),
      d = join(dest, entry.name);
    if (entry.isDirectory()) {
      ensureDir(d);
      copyDirRecursive(s, d);
    } else if (!existsSync(d)) {
      writeFileSync(d, readFileSync(s));
    }
  }
}

function initKB(targetPath) {
  const dest = expandPath(targetPath);
  if (existsSync(join(dest, "CLAUDE.md"))) {
    console.error(`Knowledge base already exists at ${dest}`);
    process.exit(1);
  }

  ensureDir(dest);
  for (const d of [
    "knowledge/People",
    "knowledge/Organizations",
    "knowledge/Projects",
    "knowledge/Topics",
    ".claude/skills",
  ])
    ensureDir(join(dest, d));

  if (existsSync(KB_TEMPLATE_DIR)) copyDirRecursive(KB_TEMPLATE_DIR, dest);

  console.log(
    `Knowledge base initialized at ${dest}\n\nNext steps:\n  1. Edit ${dest}/USER.md with your name, email, and domain\n  2. cd ${dest} && claude`,
  );
}

// --- LaunchAgent ------------------------------------------------------------

function installLaunchd() {
  const execPath =
    typeof Deno !== "undefined" ? Deno.execPath() : process.execPath;
  const isCompiled = IS_COMPILED || !execPath.includes("node");
  const progArgs = isCompiled
    ? `    <string>${execPath}</string>\n    <string>--daemon</string>`
    : `    <string>${execPath}</string>\n    <string>${join(__dirname, "basecamp.js")}</string>\n    <string>--daemon</string>`;

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_NAME}</string>
  <key>ProgramArguments</key>
  <array>
${progArgs}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${join(LOG_DIR, "launchd-stdout.log")}</string>
  <key>StandardErrorPath</key>
  <string>${join(LOG_DIR, "launchd-stderr.log")}</string>
  <key>WorkingDirectory</key>
  <string>${BASECAMP_HOME}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:${join(HOME, ".local", "bin")}</string>
  </dict>
</dict>
</plist>`;

  ensureDir(dirname(PLIST_PATH));
  ensureDir(LOG_DIR);
  writeFileSync(PLIST_PATH, plist);

  try {
    execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null`, {
      stdio: "ignore",
    });
  } catch {}
  execSync(`launchctl load "${PLIST_PATH}"`);
  console.log(
    `LaunchAgent installed and loaded.\n  Plist:  ${PLIST_PATH}\n  Logs:   ${LOG_DIR}/\n  Config: ${CONFIG_PATH}`,
  );
}

function uninstallLaunchd() {
  try {
    execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null`);
  } catch {}
  try {
    execSync(`rm -f "${PLIST_PATH}"`);
  } catch {}
  console.log("LaunchAgent uninstalled.");
}

// --- Status -----------------------------------------------------------------

function showStatus() {
  const config = loadConfig(),
    state = loadState();
  console.log("\nBasecamp Scheduler\n==================\n");

  const tasks = Object.entries(config.tasks || {});
  if (tasks.length === 0) {
    console.log(
      `Tasks: (none configured)\n\nEdit ${CONFIG_PATH} to add tasks.`,
    );
    return;
  }

  console.log("Tasks:");
  for (const [name, task] of tasks) {
    const s = state.tasks[name] || {};
    const kbPath = task.kb ? expandPath(task.kb) : null;
    const kbStatus = kbPath ? (existsSync(kbPath) ? "" : " (not found)") : "";
    const lines = [
      `  ${task.enabled !== false ? "+" : "-"} ${name}`,
      `    KB: ${task.kb || "(none)"}${kbStatus}  Schedule: ${JSON.stringify(task.schedule)}`,
      `    Status: ${s.status || "never-run"}  Last run: ${s.lastRunAt ? new Date(s.lastRunAt).toLocaleString() : "never"}  Runs: ${s.runCount || 0}`,
    ];
    if (task.agent) lines.push(`    Agent: ${task.agent}`);
    if (task.skill) lines.push(`    Skill: ${task.skill}`);
    if (s.lastError) lines.push(`    Error: ${s.lastError.slice(0, 80)}`);
    console.log(lines.join("\n"));
  }

  try {
    execSync(`launchctl list 2>/dev/null | grep ${PLIST_NAME}`, {
      encoding: "utf8",
    });
    console.log("\nLaunchAgent: loaded");
  } catch {
    console.log("\nLaunchAgent: not loaded (run --install-launchd to start)");
  }
}

// --- Validate ---------------------------------------------------------------

function findInLocalOrGlobal(kbPath, subPath) {
  const local = join(kbPath, ".claude", subPath);
  const global = join(HOME, ".claude", subPath);
  if (existsSync(local)) return local;
  if (existsSync(global)) return global;
  return null;
}

function validate() {
  const config = loadConfig();
  const tasks = Object.entries(config.tasks || {});
  if (tasks.length === 0) {
    console.log("No tasks configured. Nothing to validate.");
    return;
  }

  console.log("\nValidating tasks...\n");
  let errors = 0;

  for (const [name, task] of tasks) {
    if (!task.kb) {
      console.log(`  [FAIL] ${name}: no "kb" path specified`);
      errors++;
      continue;
    }
    const kbPath = expandPath(task.kb);
    if (!existsSync(kbPath)) {
      console.log(`  [FAIL] ${name}: path does not exist: ${kbPath}`);
      errors++;
      continue;
    }

    for (const [kind, sub] of [
      ["agent", task.agent],
      ["skill", task.skill],
    ]) {
      if (!sub) continue;
      const relPath =
        kind === "agent"
          ? join("agents", sub.endsWith(".md") ? sub : sub + ".md")
          : join("skills", sub, "SKILL.md");
      const found = findInLocalOrGlobal(kbPath, relPath);
      if (found) {
        console.log(`  [OK]   ${name}: ${kind} "${sub}" found at ${found}`);
      } else {
        console.log(
          `  [FAIL] ${name}: ${kind} "${sub}" not found in ${join(kbPath, ".claude", relPath)} or ${join(HOME, ".claude", relPath)}`,
        );
        errors++;
      }
    }

    if (!task.agent && !task.skill)
      console.log(`  [OK]   ${name}: no agent or skill to validate`);
  }

  console.log(
    errors > 0
      ? `\nValidation failed: ${errors} error(s) found.`
      : "\nAll tasks validated successfully.",
  );
  if (errors > 0) process.exit(1);
}

// --- Help -------------------------------------------------------------------

function showHelp() {
  const bin = "fit-basecamp";
  console.log(`
Basecamp Scheduler — Run scheduled tasks across multiple knowledge bases.

Usage:
  ${bin}                     Run due tasks once and exit
  ${bin} --daemon            Run continuously (poll every 60s)
  ${bin} --run <task>        Run a specific task immediately
  ${bin} --init <path>       Initialize a new knowledge base
  ${bin} --install-launchd   Install macOS LaunchAgent for auto-start
  ${bin} --uninstall-launchd Remove macOS LaunchAgent
  ${bin} --validate          Validate agents and skills exist
  ${bin} --status            Show task status
  ${bin} --help              Show this help

Config:  ~/.fit/basecamp/scheduler.json
State:   ~/.fit/basecamp/state.json
Logs:    ~/.fit/basecamp/logs/

Config format:
  {
    "tasks": {
      "sync-mail": {
        "kb": "~/Documents/Personal",
        "schedule": { "type": "interval", "minutes": 5 },
        "prompt": "Sync Apple Mail.", "skill": "sync-apple-mail",
        "agent": null, "enabled": true
      }
    }
  }

Schedule types:
  interval: { "type": "interval", "minutes": 5 }
  cron:     { "type": "cron", "expression": "0 8 * * *" }
  once:     { "type": "once", "runAt": "2025-02-12T10:00:00Z" }
`);
}

// --- CLI entry point --------------------------------------------------------

const args = process.argv.slice(2);
const command = args[0];
ensureDir(BASECAMP_HOME);

const commands = {
  "--help": showHelp,
  "-h": showHelp,
  "--daemon": daemon,
  "--install-launchd": installLaunchd,
  "--uninstall-launchd": uninstallLaunchd,
  "--validate": validate,
  "--status": showStatus,
  "--init": () => {
    if (!args[1]) {
      console.error("Usage: node basecamp.js --init <path>");
      process.exit(1);
    }
    initKB(args[1]);
  },
  "--run": async () => {
    if (!args[1]) {
      console.error("Usage: node basecamp.js --run <task-name>");
      process.exit(1);
    }
    const config = loadConfig(),
      state = loadState(),
      task = config.tasks[args[1]];
    if (!task) {
      console.error(
        `Task "${args[1]}" not found. Available: ${Object.keys(config.tasks).join(", ") || "(none)"}`,
      );
      process.exit(1);
    }
    await runTask(args[1], task, config, state);
  },
};

await (commands[command] || runDueTasks)();

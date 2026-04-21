#!/usr/bin/env node
/**
 * fit-guide CLI — Claude Agent SDK harness
 *
 * Engineering framework knowledge agent reachable from three surfaces:
 * this CLI, Claude Code (MCP), and Claude Chat (Connector).
 */

import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCli,
  SummaryRenderer,
  formatHeader,
  formatSuccess,
  formatError,
  formatBullet,
} from "@forwardimpact/libcli";

const __dirname = dirname(fileURLToPath(import.meta.url));

const VERSION = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8"),
).version;

const definition = {
  name: "fit-guide",
  version: VERSION,
  description: "Engineering framework knowledge agent",
  commands: [
    { name: "login", description: "Authenticate with Anthropic" },
    { name: "logout", description: "Clear stored credentials" },
    { name: "resume", description: "Resume previous conversation" },
    { name: "init", description: "Initialize Guide configuration" },
    { name: "status", description: "Check system readiness" },
  ],
  globalOptions: {
    data: {
      type: "string",
      short: "d",
      description: "Path to framework data",
    },
    json: { type: "boolean", description: "Output as JSON" },
    help: { type: "boolean", short: "h", description: "Show help" },
    version: { type: "boolean", description: "Show version" },
  },
  examples: [
    "npx fit-guide status",
    "npx fit-guide login",
    'echo "What skills does a senior SE need?" | npx fit-guide',
  ],
};

const cli = createCli(definition);

// ---------------------------------------------------------------------------
// Init command
// ---------------------------------------------------------------------------

async function runInit() {
  const { generateSecret, updateEnvFile } =
    await import("@forwardimpact/libsecret");

  const mcpToken = generateSecret();

  await updateEnvFile("MCP_TOKEN", mcpToken);

  const serviceUrls = {
    SERVICE_TRACE_URL: "grpc://localhost:3001",
    SERVICE_VECTOR_URL: "grpc://localhost:3002",
    SERVICE_GRAPH_URL: "grpc://localhost:3003",
    SERVICE_PATHWAY_URL: "grpc://localhost:3004",
    SERVICE_MCP_URL: "http://localhost:3005",
    EMBEDDING_BASE_URL: "http://localhost:8080",
  };

  for (const [key, url] of Object.entries(serviceUrls)) {
    await updateEnvFile(key, url);
  }

  const summary = new SummaryRenderer({ process });
  summary.render({
    title: formatHeader("Environment (.env)"),
    items: [
      { label: "MCP_TOKEN", description: "generated" },
      { label: "Service URLs", description: "ports 3001–3005" },
      {
        label: "ANTHROPIC_API_KEY",
        description: "set manually or run fit-guide login",
      },
    ],
  });
  process.stdout.write("\n");

  // Copy starter config into ./config/ (config.json only)
  const starterDir = new URL("../starter", import.meta.url).pathname;
  const configDir = resolve("config");

  try {
    await fs.access(starterDir);
  } catch {
    process.stderr.write(
      formatError("Starter data not found in package.") + "\n",
    );
    process.exit(1);
  }

  try {
    await fs.access(configDir);
    process.stdout.write(
      formatBullet("config/ already exists, skipping starter copy.", 0) + "\n",
    );
  } catch {
    await fs.cp(starterDir, configDir, { recursive: true });
    process.stdout.write(
      formatSuccess("config/ created with starter configuration.") + "\n",
    );
  }
}

// ---------------------------------------------------------------------------
// Login command (OAuth PKCE)
// ---------------------------------------------------------------------------

async function runLogin() {
  const { login } = await import("../src/lib/login.js");
  const { createServiceConfig } = await import("@forwardimpact/libconfig");
  const config = await createServiceConfig("mcp");
  await login(config);
}

// ---------------------------------------------------------------------------
// Logout command
// ---------------------------------------------------------------------------

async function runLogout() {
  const { createServiceConfig } = await import("@forwardimpact/libconfig");
  const config = await createServiceConfig("mcp");
  await config.clearOAuthCredential();
  process.stdout.write("Logged out. Stored credential removed.\n");
}

// ---------------------------------------------------------------------------
// Status command
// ---------------------------------------------------------------------------

function printStatusSummary(summary, result) {
  summary.render({
    title: "Services",
    items: Object.entries(result.services).map(([name, info]) => ({
      label: name,
      description: `${info.status === "ok" ? "ok" : "unreachable"}  ${info.url}`,
    })),
  });

  process.stdout.write("\n");

  summary.render({
    title: "Data",
    items: [
      { label: "resources", description: String(result.data.resources) },
      { label: "triples", description: String(result.data.triples) },
    ],
  });

  process.stdout.write("\n");

  summary.render({
    title: "Credentials",
    items: [
      {
        label: "ANTHROPIC_API_KEY",
        description: result.credentials.ANTHROPIC_API_KEY,
      },
    ],
  });

  process.stdout.write("\n");

  process.stdout.write(`Status: ${result.verdict}\n`);
}

// ---------------------------------------------------------------------------
// Chat handler (default command) — Claude Agent SDK
// ---------------------------------------------------------------------------

async function fetchGuidePrompt(mcpUrl, mcpToken) {
  const res = await fetch(mcpUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${mcpToken}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "prompts/get",
      params: { name: "guide-default" },
    }),
  });
  if (!res.ok) return null;
  const body = await res.json();
  const text = body?.result?.messages?.[0]?.content?.text;
  return text || null;
}

async function handleChat(input) {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const { createServiceConfig } = await import("@forwardimpact/libconfig");
  const { createStorage } = await import("@forwardimpact/libstorage");

  const config = await createServiceConfig("mcp");

  // Set the Anthropic credential for the SDK
  process.env.ANTHROPIC_API_KEY = await config.anthropicToken();

  const mcpUrl = config.url; // SERVICE_MCP_URL
  const mcpToken = config.mcpToken();

  // Fetch guide-default prompt from the MCP endpoint
  const systemPrompt = await fetchGuidePrompt(mcpUrl, mcpToken);
  if (!systemPrompt) {
    process.stderr.write(
      "Could not fetch guide-default prompt from MCP endpoint.\n" +
        "Ensure the MCP service is running: npx fit-rc start\n",
    );
    process.exit(1);
  }

  const iterator = query({
    prompt: input,
    options: {
      model: process.env.GUIDE_MODEL || "claude-sonnet-4-6",
      systemPrompt,
      mcpServers: {
        guide: {
          url: mcpUrl,
          headers: { Authorization: `Bearer ${mcpToken}` },
        },
      },
    },
  });

  let sessionId = null;
  for await (const message of iterator) {
    if (message.type === "system" && message.subtype === "init") {
      sessionId = message.session_id;
    }
    if (message.type === "result") {
      process.stdout.write(message.result ?? "");
      process.stdout.write("\n");
    }
  }

  // Persist session ID for resume
  if (sessionId) {
    const storage = createStorage("cli");
    await storage.put("last-session-id", sessionId);
  }
}

// ---------------------------------------------------------------------------
// Resume handler
// ---------------------------------------------------------------------------

async function handleResume(input) {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const { createServiceConfig } = await import("@forwardimpact/libconfig");
  const { createStorage } = await import("@forwardimpact/libstorage");

  const config = await createServiceConfig("mcp");
  process.env.ANTHROPIC_API_KEY = await config.anthropicToken();

  const mcpUrl = config.url;
  const mcpToken = config.mcpToken();

  // Read last session ID from storage
  const storage = createStorage("cli");
  let sessionId;
  try {
    sessionId = await storage.get("last-session-id");
  } catch {
    process.stderr.write("No previous session found.\n");
    process.exit(1);
  }

  const iterator = query({
    prompt: input || "Continue where we left off.",
    options: {
      resume: sessionId,
      mcpServers: {
        guide: {
          url: mcpUrl,
          headers: { Authorization: `Bearer ${mcpToken}` },
        },
      },
    },
  });

  for await (const message of iterator) {
    if (message.type === "result") {
      process.stdout.write(message.result ?? "");
      process.stdout.write("\n");
    }
  }
}

// ---------------------------------------------------------------------------
// First-run UX
// ---------------------------------------------------------------------------

function checkFirstRun() {
  if (process.env.LLM_TOKEN && !process.env.ANTHROPIC_API_KEY) {
    process.stderr.write(
      "Guide has moved to Anthropic. LLM_TOKEN is no longer used.\n\n" +
        "  Run: fit-guide init    (regenerates .env)\n" +
        "  Then: fit-guide login  (or set ANTHROPIC_API_KEY)\n",
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const parsed = cli.parse(process.argv.slice(2));
if (!parsed) process.exit(0);

const { values, positionals } = parsed;
const command = positionals[0] || null;

if (command === "init") {
  await runInit();
  process.exit(0);
}

if (command === "login") {
  await runLogin();
  process.exit(0);
}

if (command === "logout") {
  await runLogout();
  process.exit(0);
}

if (command === "status") {
  const { runStatus } = await import("../src/lib/status.js");
  const { createServiceConfig } = await import("@forwardimpact/libconfig");
  const { healthDefinition } = await import("@forwardimpact/librpc");
  const grpcMod = (await import("@grpc/grpc-js")).default;
  const fsPromises = await import("fs/promises");

  const result = await runStatus({
    createServiceConfig,
    grpc: grpcMod,
    healthDefinition,
    fs: fsPromises,
  });

  if (values.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    const summary = new SummaryRenderer({ process });
    printStatusSummary(summary, result);
  }

  process.exit(result.verdict === "ready" ? 0 : 1);
}

if (command === "resume") {
  checkFirstRun();
  const input = positionals.slice(1).join(" ");
  await handleResume(input);
  process.exit(0);
}

// Default: interactive chat
checkFirstRun();

// Read input from stdin (piped) or positional args
let input;
if (!process.stdin.isTTY) {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  input = Buffer.concat(chunks).toString("utf8").trim();
} else if (positionals.length > 0) {
  input = positionals.join(" ");
} else {
  cli.error("Expected a question via pipe or as arguments.");
  process.exit(1);
}

await handleChat(input);

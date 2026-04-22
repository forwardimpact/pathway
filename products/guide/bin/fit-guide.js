#!/usr/bin/env node
/**
 * fit-guide CLI — Claude Agent SDK harness running inside librepl
 *
 * Engineering framework knowledge agent reachable from three surfaces:
 * this CLI, Claude Code (MCP), and Claude Chat (Connector).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { query } from "@anthropic-ai/claude-agent-sdk";
import { createServiceConfig } from "@forwardimpact/libconfig";
import { createAgentTraceFormatter } from "@forwardimpact/libformat";
import { Repl } from "@forwardimpact/librepl";
import { createStorage } from "@forwardimpact/libstorage";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8"),
).version;

// ---------------------------------------------------------------------------
// MCP helpers
// ---------------------------------------------------------------------------

async function mcpRequest(url, token, body, sessionId) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${token}`,
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    const raw = await res.text();
    for (const line of raw.split("\n")) {
      if (line.startsWith("data: ")) {
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed?.result) return parsed;
        } catch {
          // skip non-JSON data lines
        }
      }
    }
    return null;
  }
  return res.json();
}

async function fetchGuidePrompt(url, token) {
  const init = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "fit-guide-cli", version: VERSION },
      },
    }),
  });
  if (!init.ok) return null;
  const sessionId = init.headers.get("mcp-session-id");

  const body = await mcpRequest(
    url,
    token,
    {
      jsonrpc: "2.0",
      id: 1,
      method: "prompts/get",
      params: { name: "guide-default" },
    },
    sessionId,
  );
  return body?.result?.messages?.[0]?.content?.text || null;
}

// ---------------------------------------------------------------------------
// REPL
// ---------------------------------------------------------------------------

let mcpUrl = null;
let mcpToken = null;

const repl = new Repl({
  prompt: "❯ ",
  indent: "  ",
  usage:
    "**fit-guide** — Engineering framework knowledge agent.\n\n" +
    "Type a question about your engineering framework.",
  storage: createStorage("guide"),
  state: { sessionId: null },

  commands: {
    init: {
      usage: "Initialize Guide configuration",
      type: "boolean",
      handler: async () => {
        const { runInitCommand } = await import("../src/commands/init.js");
        await runInitCommand();
        return false;
      },
    },
    login: {
      usage: "Authenticate with Anthropic",
      type: "boolean",
      handler: async () => {
        const { login } = await import("../src/lib/login.js");
        const config = await createServiceConfig("mcp");
        await login(config);
        return false;
      },
    },
    logout: {
      usage: "Clear stored credentials",
      type: "boolean",
      handler: async () => {
        const config = await createServiceConfig("mcp");
        await config.clearOAuthCredential();
        process.stdout.write("Logged out. Stored credential removed.\n");
        return false;
      },
    },
    status: {
      usage: "Check system readiness",
      type: "boolean",
      handler: async () => {
        const { runStatusCommand } = await import("../src/commands/status.js");
        await runStatusCommand({ json: false });
        return false;
      },
    },
    version: {
      usage: "Show version",
      type: "boolean",
      handler: async () => {
        process.stdout.write(`fit-guide v${VERSION}\n`);
        return false;
      },
    },
  },

  setup: async () => {
    if (process.env.LLM_TOKEN && !process.env.ANTHROPIC_API_KEY) {
      process.stderr.write(
        "Guide has moved to Anthropic. LLM_TOKEN is no longer used.\n\n" +
          "  Run: fit-guide --init    (regenerates .env)\n" +
          "  Then: fit-guide --login  (or set ANTHROPIC_API_KEY)\n",
      );
      process.exit(1);
    }
    const config = await createServiceConfig("mcp");
    process.env.ANTHROPIC_API_KEY = await config.anthropicToken();
    mcpUrl = config.url;
    mcpToken = config.mcpToken();
  },

  onLine: async (line, state, output) => {
    const options = {
      mcpServers: {
        guide: {
          type: "http",
          url: mcpUrl,
          headers: { Authorization: `Bearer ${mcpToken}` },
        },
      },
      allowedTools: ["mcp__guide__*"],
    };

    if (state.sessionId) {
      options.resume = state.sessionId;
    } else {
      const systemPrompt = await fetchGuidePrompt(mcpUrl, mcpToken);
      if (!systemPrompt) {
        output.write(
          "Could not fetch guide-default prompt from MCP endpoint.\n" +
            "Ensure the MCP service is running: npx fit-rc start\n",
        );
        return;
      }
      options.model = process.env.GUIDE_MODEL || "claude-sonnet-4-6";
      options.systemPrompt = systemPrompt;
    }

    const trace = createAgentTraceFormatter(process.stderr, {
      indent: "  ",
      marker: "⏺ ",
    });

    process.stderr.write("\n");

    const iterator = query({ prompt: line, options });
    for await (const message of iterator) {
      if (message.type === "system" && message.subtype === "init") {
        state.sessionId = message.session_id;
      }

      if (message.type === "assistant") {
        trace.writeBlocks(message.message?.content);
      }

      if (message.type === "result" && message.result) {
        process.stdout.write(trace.marker);
        output.write(`${message.result}\n`);
      }
    }
  },
});

repl.start();

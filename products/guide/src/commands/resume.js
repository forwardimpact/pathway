import { query } from "@anthropic-ai/claude-agent-sdk";
import { createServiceConfig } from "@forwardimpact/libconfig";
import { Repl } from "@forwardimpact/librepl";
import { createStorage } from "@forwardimpact/libstorage";

async function mcpRequest(mcpUrl, mcpToken, body, sessionId) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${mcpToken}`,
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const res = await fetch(mcpUrl, {
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

async function fetchGuidePrompt(mcpUrl, mcpToken) {
  const init = await fetch(mcpUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${mcpToken}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "fit-guide-cli", version: "0.1.0" },
      },
    }),
  });
  if (!init.ok) return null;
  const sessionId = init.headers.get("mcp-session-id");

  const body = await mcpRequest(
    mcpUrl,
    mcpToken,
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

export async function runResumeCommand() {
  let mcpUrl = null;
  let mcpToken = null;

  const repl = new Repl({
    prompt: "> ",
    state: { sessionId: null },
    storage: createStorage("guide"),

    setup: async () => {
      const config = await createServiceConfig("mcp");
      process.env.ANTHROPIC_API_KEY = await config.anthropicToken();
      mcpUrl = config.url;
      mcpToken = config.mcpToken();
    },

    onLine: async (line, state, outputStream) => {
      const options = {
        mcpServers: {
          guide: {
            type: "http",
            url: mcpUrl,
            headers: { Authorization: `Bearer ${mcpToken}` },
          },
        },
      };

      if (state.sessionId) {
        options.resume = state.sessionId;
      } else {
        const systemPrompt = await fetchGuidePrompt(mcpUrl, mcpToken);
        if (!systemPrompt) {
          outputStream.write(
            "Could not fetch guide-default prompt from MCP endpoint.\n" +
              "Ensure the MCP service is running: npx fit-rc start\n",
          );
          return;
        }
        options.model = process.env.GUIDE_MODEL || "claude-sonnet-4-6";
        options.systemPrompt = systemPrompt;
        options.allowedTools = ["mcp__guide__*"];
      }

      const iterator = query({ prompt: line, options });
      for await (const message of iterator) {
        if (message.type === "system" && message.subtype === "init") {
          state.sessionId = message.session_id;
        }
        if (message.type === "result" && message.result) {
          outputStream.write(`${message.result}\n`);
        }
      }
    },
  });

  await repl.start();
}

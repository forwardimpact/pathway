/**
 * Sends a JSON-RPC request to the MCP endpoint and parses the SSE response.
 * @returns {object|null} Parsed JSON-RPC result, or null on failure
 */
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
  // Initialize a session (required by MCP Streamable HTTP transport)
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

  // Fetch the guide-default prompt
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

export async function runChatCommand(input) {
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
      allowedTools: ["mcp__guide__*"],
      mcpServers: {
        guide: {
          type: "http",
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

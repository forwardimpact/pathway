export async function runResumeCommand(input) {
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
          type: "http",
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

import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { registerTools } from "./tools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Creates a Guide MCP service instance.
 *
 * @param {{ config: object, logger: object, graphClient: object, vectorClient: object, pathwayClient: object }} deps
 * @returns {{ start: () => Promise<void> }}
 */
export function createMcpService({
  config,
  logger,
  graphClient,
  vectorClient,
  pathwayClient,
}) {
  const mcpServer = new McpServer({
    name: "guide",
    version: "0.1.0",
  });

  // Register all 10 retained tools
  registerTools(mcpServer, { graphClient, vectorClient, pathwayClient });

  // Register the guide-default prompt
  const promptPath = path.join(__dirname, "prompts", "guide-default.md");
  mcpServer.prompt(
    "guide-default",
    "Single-agent system prompt for Guide — engineering framework knowledge agent.",
    async () => {
      const text = await readFile(promptPath, "utf8");
      return { messages: [{ role: "user", content: { type: "text", text } }] };
    },
  );

  async function start() {
    const host = config.host || "0.0.0.0";
    const port = config.port || 3009;
    const expectedToken = config.mcpToken();

    // Create transport once — stateless mode (no session ID).
    // connect() binds the McpServer to this single transport.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await mcpServer.connect(transport);

    const httpServer = createServer(async (req, res) => {
      // Health endpoint — no auth required
      if (req.url === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      // Auth check on all other requests
      const auth = req.headers.authorization;
      if (!auth || auth !== `Bearer ${expectedToken}`) {
        res.writeHead(401);
        res.end("Unauthorized");
        return;
      }

      await transport.handleRequest(req, res);
    });

    httpServer.listen(port, host, () => {
      logger.info(`MCP server listening on ${host}:${port}`);
    });

    const shutdown = () => {
      logger.info("Shutting down MCP server");
      httpServer.close();
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }

  return { start, mcpServer };
}

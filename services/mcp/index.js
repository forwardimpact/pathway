import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { registerToolsFromConfig } from "@forwardimpact/libmcp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Creates a Guide MCP service instance.
 *
 * Each client session gets its own McpServer + transport pair, because the
 * MCP SDK's Protocol only supports one transport at a time. The CLI fetches
 * the prompt in one session, then the Agent SDK opens a second session for
 * tool use.
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
  const promptPath = path.join(__dirname, "prompts", "guide-default.md");

  /** Creates a fully wired McpServer instance. */
  function createSessionServer() {
    const server = new McpServer({ name: "guide", version: "0.1.0" });
    registerToolsFromConfig(server, config, {
      graph: graphClient,
      vector: vectorClient,
      pathway: pathwayClient,
    });
    server.prompt(
      "guide-default",
      "Single-agent system prompt for Guide — engineering framework knowledge agent.",
      async () => {
        const text = await readFile(promptPath, "utf8");
        return {
          messages: [{ role: "user", content: { type: "text", text } }],
        };
      },
    );
    return server;
  }

  async function start() {
    const host = config.host || "0.0.0.0";
    const port = config.port || 3005;
    const expectedToken = config.mcpToken();

    // sessionId → { transport, server }
    const sessions = new Map();

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

      // Route to existing session or create a new one on initialize
      const sessionId = req.headers["mcp-session-id"];

      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId);
        try {
          await session.transport.handleRequest(req, res);
        } catch (err) {
          logger.error(`Request handling failed: ${err.message}`);
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                error: { code: -32603, message: "Internal server error" },
                id: null,
              }),
            );
          }
        }
        return;
      }

      // New session: create transport + server, let the transport handle
      // the initialize request and assign a session ID.
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
      });
      const server = createSessionServer();

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && sessions.has(sid)) {
          sessions.delete(sid);
        }
      };

      await server.connect(transport);

      try {
        await transport.handleRequest(req, res);
      } catch (err) {
        logger.error(`Request handling failed: ${err.message}`);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32603, message: "Internal server error" },
              id: null,
            }),
          );
        }
        return;
      }

      // After the initialize is handled, the transport has a session ID
      const newSessionId = transport.sessionId;
      if (newSessionId) {
        sessions.set(newSessionId, { transport, server });
      }
    });

    httpServer.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        logger.error(`Port ${port} is already in use`);
      } else {
        logger.error(`HTTP server error: ${err.message}`);
      }
      process.exit(1);
    });

    httpServer.listen(port, host, () => {
      logger.info(`MCP server listening on ${host}:${port}`);
    });

    const shutdown = () => {
      logger.info("Shutting down MCP server");
      for (const session of sessions.values()) {
        session.server.close();
      }
      sessions.clear();
      httpServer.close();
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }

  return { start };
}

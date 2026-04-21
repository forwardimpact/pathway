import { Hono } from "hono";

import {
  createCorsMiddleware,
  createAuthMiddleware,
} from "@forwardimpact/libweb";

/**
 * Creates a web service with configurable dependencies
 * @param {import("@forwardimpact/libconfig").Config} config - Service configuration
 * @param {(namespace: string) => import("@forwardimpact/libtelemetry").Logger} [logger] - Optional logger
 * @returns {Promise<Hono>} Configured Hono application
 */
export async function createWebService(config, logger = null) {
  const app = new Hono();

  logger?.debug("Config", "Auth configuration", {
    auth_enabled: config.auth_enabled,
  });

  const corsMiddleware = createCorsMiddleware(config);

  const authMiddleware = config.auth_enabled
    ? createAuthMiddleware(config)
    : null;

  app.use(
    "/web/api/*",
    corsMiddleware.create({
      origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
      allowMethods: ["GET", "POST"],
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  );

  if (authMiddleware) {
    app.use("/web/api/chat", authMiddleware.create());
  }

  // Health check endpoint
  app.get("/web/health", (c) => {
    return c.json({ status: "ok" });
  });

  // Chat endpoint — replaced by MCP + Claude Agent SDK surfaces.
  // Returns a pointer to the new interfaces.
  app.post("/web/api/chat", async (c) => {
    return c.json(
      {
        message:
          "The chat endpoint has moved. Use fit-guide CLI, Claude Code, or Claude Chat with the Guide MCP endpoint.",
      },
      410,
    );
  });

  return app;
}

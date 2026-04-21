/* global Request */
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";

import { createWebService } from "../index.js";
import {
  createMockServiceConfig,
  createSilentLogger,
} from "@forwardimpact/libharness";

describe("web service", () => {
  let mockConfig;
  let logger;

  beforeEach(() => {
    mockConfig = createMockServiceConfig("web", {
      auth_enabled: false,
    });

    logger = createSilentLogger();
  });

  describe("createWebService", () => {
    test("returns a Hono app", async () => {
      const app = await createWebService(mockConfig, logger);
      assert.ok(app);
      assert.strictEqual(typeof app.fetch, "function");
    });

    test("works without logger", async () => {
      const app = await createWebService(mockConfig);
      assert.ok(app);
    });
  });

  describe("health endpoint", () => {
    test("GET /web/health returns ok status", async () => {
      const app = await createWebService(mockConfig, logger);

      const req = new Request("http://localhost/web/health", {
        method: "GET",
      });
      const res = await app.fetch(req);

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.deepStrictEqual(body, { status: "ok" });
    });
  });

  describe("chat endpoint", () => {
    test("POST /web/api/chat returns 410 gone", async () => {
      const app = await createWebService(mockConfig, logger);

      const req = new Request("http://localhost/web/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      });
      const res = await app.fetch(req);

      assert.strictEqual(res.status, 410);
      const body = await res.json();
      assert.ok(body.message.includes("moved"));
    });
  });

  describe("auth", () => {
    test("creates app with auth disabled (default)", async () => {
      const app = await createWebService(mockConfig, logger);
      assert.ok(app);
      assert.strictEqual(typeof app.fetch, "function");
    });
  });
});

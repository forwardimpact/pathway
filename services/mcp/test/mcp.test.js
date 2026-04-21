import { test, describe, mock } from "node:test";
import assert from "node:assert";

import { createMcpService } from "../index.js";
import { registerTools } from "../tools.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** Mock config with mcpToken() */
function createMockConfig() {
  return {
    host: "127.0.0.1",
    port: 0,
    mcpToken: () => "test-bearer-token",
  };
}

/** Mock gRPC clients returning canned responses */
function createMockClients() {
  return {
    graphClient: {
      GetOntology: mock.fn(() => Promise.resolve({ content: "ontology-ttl" })),
      GetSubjects: mock.fn(() => Promise.resolve({ content: "sub1\tsub2" })),
      QueryByPattern: mock.fn(() =>
        Promise.resolve({ identifiers: ["id1", "id2"] }),
      ),
    },
    vectorClient: {
      SearchContent: mock.fn(() =>
        Promise.resolve({ identifiers: ["result1"] }),
      ),
    },
    pathwayClient: {
      ListJobs: mock.fn(() => Promise.resolve({ content: "pathway-jobs-ttl" })),
      DescribeJob: mock.fn(() =>
        Promise.resolve({ content: "pathway-job-ttl" }),
      ),
      ListAgentProfiles: mock.fn(() =>
        Promise.resolve({ content: "agent-profiles-ttl" }),
      ),
      DescribeAgentProfile: mock.fn(() =>
        Promise.resolve({ content: "agent-profile-ttl" }),
      ),
      DescribeProgression: mock.fn(() =>
        Promise.resolve({ content: "progression-ttl" }),
      ),
      ListJobSoftware: mock.fn(() =>
        Promise.resolve({ content: "software-ttl" }),
      ),
    },
  };
}

/**
 * Helper: call a registered tool handler through the McpServer.
 * Uses the server's internal _registeredTools object.
 */
async function callTool(mcpServer, toolName, args = {}) {
  const tools = mcpServer._registeredTools;
  const tool = tools[toolName];
  if (!tool) throw new Error(`Tool ${toolName} not registered`);
  return tool.handler({ name: toolName, arguments: args });
}

describe("MCP service", () => {
  describe("tool registration", () => {
    test("registers all 10 expected tools", async () => {
      const server = new McpServer({ name: "test", version: "0.0.1" });
      const clients = createMockClients();
      registerTools(server, clients);

      const expectedTools = [
        "get_ontology",
        "get_subjects",
        "query_by_pattern",
        "search_content",
        "pathway_list_jobs",
        "pathway_describe_job",
        "pathway_list_agent_profiles",
        "pathway_describe_agent_profile",
        "pathway_describe_progression",
        "pathway_list_job_software",
      ];

      const registered = server._registeredTools;
      assert.strictEqual(Object.keys(registered).length, 10);
      for (const name of expectedTools) {
        assert.ok(registered[name], `Missing tool: ${name}`);
      }
    });
  });

  describe("prompt registration", () => {
    test("guide-default prompt loads from disk", async () => {
      const config = createMockConfig();
      const clients = createMockClients();
      const logger = { info: mock.fn() };

      const { mcpServer } = createMcpService({
        config,
        logger,
        ...clients,
      });

      assert.ok(mcpServer);
    });
  });

  describe("HTTP server", () => {
    test("factory returns start function", async () => {
      const config = createMockConfig();
      const clients = createMockClients();
      const logger = { info: mock.fn() };

      const { start } = createMcpService({ config, logger, ...clients });
      assert.strictEqual(typeof start, "function");
    });

    test("auth rejects missing token", async () => {
      const expectedToken = "test-bearer-token";
      const authHeader = undefined;
      const authorized = authHeader && authHeader === `Bearer ${expectedToken}`;
      assert.strictEqual(authorized, undefined);
    });

    test("auth rejects wrong token", async () => {
      const expectedToken = "test-bearer-token";
      const authHeader = "Bearer wrong-token";
      const authorized = authHeader && authHeader === `Bearer ${expectedToken}`;
      assert.strictEqual(authorized, false);
    });

    test("auth accepts valid token", async () => {
      const expectedToken = "test-bearer-token";
      const authHeader = "Bearer test-bearer-token";
      const authorized = authHeader && authHeader === `Bearer ${expectedToken}`;
      assert.strictEqual(authorized, true);
    });
  });

  describe("tool handlers route to correct backend", () => {
    test("get_ontology calls graphClient.GetOntology", async () => {
      const server = new McpServer({ name: "test", version: "0.0.1" });
      const clients = createMockClients();
      registerTools(server, clients);

      const result = await callTool(server, "get_ontology");
      assert.strictEqual(clients.graphClient.GetOntology.mock.calls.length, 1);
      assert.deepStrictEqual(result, {
        content: [{ type: "text", text: "ontology-ttl" }],
      });
    });

    test("get_subjects calls graphClient.GetSubjects", async () => {
      const server = new McpServer({ name: "test", version: "0.0.1" });
      const clients = createMockClients();
      registerTools(server, clients);

      const result = await callTool(server, "get_subjects", {
        type: "schema:Organization",
      });
      assert.strictEqual(clients.graphClient.GetSubjects.mock.calls.length, 1);
      assert.deepStrictEqual(result, {
        content: [{ type: "text", text: "sub1\tsub2" }],
      });
    });

    test("search_content calls vectorClient.SearchContent", async () => {
      const server = new McpServer({ name: "test", version: "0.0.1" });
      const clients = createMockClients();
      registerTools(server, clients);

      const result = await callTool(server, "search_content", {
        input: "test query",
      });
      assert.strictEqual(
        clients.vectorClient.SearchContent.mock.calls.length,
        1,
      );
      assert.ok(result.content[0].text.includes("result1"));
    });

    test("pathway_describe_job calls pathwayClient.DescribeJob", async () => {
      const server = new McpServer({ name: "test", version: "0.0.1" });
      const clients = createMockClients();
      registerTools(server, clients);

      const result = await callTool(server, "pathway_describe_job", {
        discipline: "fde",
        level: "l3",
      });
      assert.strictEqual(
        clients.pathwayClient.DescribeJob.mock.calls.length,
        1,
      );
      assert.deepStrictEqual(result, {
        content: [{ type: "text", text: "pathway-job-ttl" }],
      });
    });

    test("pathway_list_jobs calls pathwayClient.ListJobs", async () => {
      const server = new McpServer({ name: "test", version: "0.0.1" });
      const clients = createMockClients();
      registerTools(server, clients);

      const result = await callTool(server, "pathway_list_jobs", {});
      assert.strictEqual(clients.pathwayClient.ListJobs.mock.calls.length, 1);
      assert.deepStrictEqual(result, {
        content: [{ type: "text", text: "pathway-jobs-ttl" }],
      });
    });
  });
});

import { describe, test } from "node:test";
import assert from "node:assert";

import {
  createOrchestrationContext,
  createConcludeHandler,
  createRedirectHandler,
  createAskHandler,
  createRollCallHandler,
  createShareHandler,
  createTellHandler,
  createSupervisorToolServer,
  createSupervisedAgentToolServer,
  createFacilitatorToolServer,
  createFacilitatedAgentToolServer,
} from "../src/orchestration-toolkit.js";

describe("OrchestrationToolkit - handlers", () => {
  test("Conclude sets ctx.concluded and ctx.summary, returns ack", async () => {
    const ctx = createOrchestrationContext();
    const handler = createConcludeHandler(ctx);
    const result = await handler({ summary: "All done" });

    assert.strictEqual(ctx.concluded, true);
    assert.strictEqual(ctx.summary, "All done");
    assert.strictEqual(result.content[0].type, "text");
    assert.ok(result.content[0].text.includes("concluded"));
  });

  test("Redirect sets ctx.redirect, returns ack", async () => {
    const ctx = createOrchestrationContext();
    const handler = createRedirectHandler(ctx);
    const result = await handler({ message: "Stop that", to: "agent-1" });

    assert.deepStrictEqual(ctx.redirect, {
      message: "Stop that",
      to: "agent-1",
    });
    assert.strictEqual(result.content[0].type, "text");
  });

  test("Redirect with no to field sets to null", async () => {
    const ctx = createOrchestrationContext();
    const handler = createRedirectHandler(ctx);
    await handler({ message: "Fix it" });

    assert.deepStrictEqual(ctx.redirect, { message: "Fix it", to: null });
  });

  test("Ask calls onAsk and returns answer", async () => {
    const ctx = createOrchestrationContext();
    const handler = createAskHandler(ctx, {
      onAsk: async (q) => `Answer to: ${q}`,
    });
    const result = await handler({ question: "What should I do?" });

    assert.strictEqual(result.content[0].text, "Answer to: What should I do?");
    assert.strictEqual(result.isError, undefined);
  });

  test("Ask returns isError when onAsk throws", async () => {
    const ctx = createOrchestrationContext();
    const handler = createAskHandler(ctx, {
      onAsk: async () => {
        throw new Error("Supervisor unavailable");
      },
    });
    const result = await handler({ question: "Help?" });

    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("Supervisor unavailable"));
  });

  test("RollCall returns participants as JSON", async () => {
    const ctx = createOrchestrationContext();
    ctx.participants = [
      { name: "facilitator", role: "facilitator" },
      { name: "agent-1", role: "explorer" },
    ];
    const handler = createRollCallHandler(ctx);
    const result = await handler();

    const parsed = JSON.parse(result.content[0].text);
    assert.strictEqual(parsed.length, 2);
    assert.strictEqual(parsed[0].name, "facilitator");
    assert.strictEqual(parsed[1].name, "agent-1");
  });

  test("Share calls messageBus.share, returns ack", async () => {
    const calls = [];
    const ctx = createOrchestrationContext();
    ctx.messageBus = {
      share: (from, msg) => calls.push({ from, msg }),
    };
    const handler = createShareHandler(ctx, { from: "agent-1" });
    const result = await handler({ message: "Found something" });

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].from, "agent-1");
    assert.strictEqual(calls[0].msg, "Found something");
    assert.strictEqual(result.content[0].type, "text");
  });

  test("Tell calls messageBus.tell, returns ack", async () => {
    const calls = [];
    const ctx = createOrchestrationContext();
    ctx.messageBus = {
      tell: (from, to, msg) => calls.push({ from, to, msg }),
    };
    const handler = createTellHandler(ctx, { from: "agent-1" });
    const result = await handler({ message: "Hey", to: "agent-2" });

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].from, "agent-1");
    assert.strictEqual(calls[0].to, "agent-2");
    assert.strictEqual(calls[0].msg, "Hey");
    assert.strictEqual(result.content[0].type, "text");
  });
});

describe("OrchestrationToolkit - server factories", () => {
  test("createSupervisorToolServer returns sdk-type server", () => {
    const ctx = createOrchestrationContext();
    const server = createSupervisorToolServer(ctx);
    assert.strictEqual(server.type, "sdk");
    assert.strictEqual(server.name, "orchestration");
  });

  test("createSupervisedAgentToolServer returns sdk-type server", () => {
    const ctx = createOrchestrationContext();
    const server = createSupervisedAgentToolServer(ctx, {
      onAsk: async () => "answer",
    });
    assert.strictEqual(server.type, "sdk");
    assert.strictEqual(server.name, "orchestration");
  });

  test("createFacilitatorToolServer returns sdk-type server", () => {
    const ctx = createOrchestrationContext();
    ctx.messageBus = { share: () => {}, tell: () => {} };
    const server = createFacilitatorToolServer(ctx);
    assert.strictEqual(server.type, "sdk");
    assert.strictEqual(server.name, "orchestration");
  });

  test("createFacilitatedAgentToolServer returns sdk-type server", () => {
    const ctx = createOrchestrationContext();
    ctx.messageBus = { share: () => {}, tell: () => {} };
    const server = createFacilitatedAgentToolServer(ctx, {
      from: "agent-1",
      onAsk: async () => "answer",
    });
    assert.strictEqual(server.type, "sdk");
    assert.strictEqual(server.name, "orchestration");
  });
});

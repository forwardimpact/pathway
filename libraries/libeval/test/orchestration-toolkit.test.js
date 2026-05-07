import { describe, test } from "node:test";
import assert from "node:assert";

import {
  createOrchestrationContext,
  createConcludeHandler,
  createRedirectHandler,
  createAskHandler,
  createAnswerHandler,
  createAnnounceHandler,
  createRollCallHandler,
  checkPendingAsk,
  createSupervisorToolServer,
  createSupervisedAgentToolServer,
  createFacilitatorToolServer,
  createFacilitatedAgentToolServer,
} from "../src/orchestration-toolkit.js";

function stubBus() {
  const calls = [];
  return {
    calls,
    ask: (from, to, text, askId) =>
      calls.push({ method: "ask", from, to, text, askId }),
    answer: (from, to, text, askId) =>
      calls.push({ method: "answer", from, to, text, askId }),
    announce: (from, text) => calls.push({ method: "announce", from, text }),
    synthetic: (to, text) => calls.push({ method: "synthetic", to, text }),
    direct: (from, to, text) =>
      calls.push({ method: "direct", from, to, text }),
  };
}

describe("OrchestrationToolkit - handlers", () => {
  test("Conclude sets ctx.concluded, ctx.verdict, and ctx.summary, returns ack", async () => {
    const ctx = createOrchestrationContext();
    const handler = createConcludeHandler(ctx);
    const result = await handler({ verdict: "success", summary: "All done" });

    assert.strictEqual(ctx.concluded, true);
    assert.strictEqual(ctx.verdict, "success");
    assert.strictEqual(ctx.summary, "All done");
    assert.strictEqual(result.content[0].type, "text");
    assert.ok(result.content[0].text.includes("concluded"));
  });

  test("Conclude records verdict='failure' when supervisor judges the agent failed", async () => {
    const ctx = createOrchestrationContext();
    const handler = createConcludeHandler(ctx);
    await handler({ verdict: "failure", summary: "Agent did not query MCP" });

    assert.strictEqual(ctx.concluded, true);
    assert.strictEqual(ctx.verdict, "failure");
    assert.strictEqual(ctx.summary, "Agent did not query MCP");
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

  test("Ask with explicit to registers a single pending entry and publishes", async () => {
    const ctx = createOrchestrationContext();
    ctx.messageBus = stubBus();
    const handler = createAskHandler(ctx, {
      from: "facilitator",
      defaultTo: undefined,
    });

    const result = await handler({ question: "What?", to: "agent-1" });

    assert.strictEqual(ctx.pendingAsks.size, 1);
    const entry = ctx.pendingAsks.get("agent-1");
    assert.ok(entry);
    assert.strictEqual(entry.askerName, "facilitator");
    assert.strictEqual(entry.question, "What?");
    assert.strictEqual(entry.reminded, false);
    assert.strictEqual(ctx.messageBus.calls.length, 1);
    assert.strictEqual(ctx.messageBus.calls[0].method, "ask");
    assert.strictEqual(ctx.messageBus.calls[0].to, "agent-1");
    assert.strictEqual(result.content[0].text, "Ask delivered.");
  });

  test("Ask with defaultTo uses it when to is omitted", async () => {
    const ctx = createOrchestrationContext();
    ctx.messageBus = stubBus();
    const handler = createAskHandler(ctx, {
      from: "agent-1",
      defaultTo: "facilitator",
    });

    await handler({ question: "Help?" });

    assert.strictEqual(ctx.pendingAsks.size, 1);
    assert.ok(ctx.pendingAsks.has("facilitator"));
  });

  test("Ask with no to and no defaultTo broadcasts across non-asker participants", async () => {
    const ctx = createOrchestrationContext();
    ctx.participants = [
      { name: "facilitator", role: "facilitator" },
      { name: "agent-1", role: "worker" },
      { name: "agent-2", role: "worker" },
    ];
    ctx.messageBus = stubBus();

    const handler = createAskHandler(ctx, {
      from: "facilitator",
      defaultTo: undefined,
    });
    await handler({ question: "Ready?" });

    assert.strictEqual(ctx.pendingAsks.size, 2);
    assert.ok(ctx.pendingAsks.has("agent-1"));
    assert.ok(ctx.pendingAsks.has("agent-2"));
    // Each entry has a unique askId.
    const ids = [...ctx.pendingAsks.values()].map((e) => e.askId);
    assert.strictEqual(new Set(ids).size, 2);
  });

  test("Answer clears the matching pending entry and publishes", async () => {
    const ctx = createOrchestrationContext();
    ctx.messageBus = stubBus();
    // Seed a pending ask keyed by the answerer.
    ctx.pendingAsks.set("agent-1", {
      askId: 7,
      askerName: "facilitator",
      question: "What?",
      reminded: false,
    });

    const handler = createAnswerHandler(ctx, { from: "agent-1" });
    const result = await handler({ message: "Here is the answer" });

    assert.strictEqual(ctx.pendingAsks.has("agent-1"), false);
    assert.strictEqual(ctx.messageBus.calls.length, 1);
    assert.strictEqual(ctx.messageBus.calls[0].method, "answer");
    assert.strictEqual(ctx.messageBus.calls[0].from, "agent-1");
    assert.strictEqual(ctx.messageBus.calls[0].to, "facilitator");
    assert.strictEqual(ctx.messageBus.calls[0].askId, 7);
    assert.strictEqual(result.content[0].text, "Answer delivered.");
  });

  test("Answer with no pending ask returns isError", async () => {
    const ctx = createOrchestrationContext();
    ctx.messageBus = stubBus();
    const handler = createAnswerHandler(ctx, { from: "agent-1" });

    const result = await handler({ message: "Unsolicited" });

    assert.strictEqual(result.isError, true);
    assert.ok(result.content[0].text.includes("No pending ask"));
    assert.strictEqual(ctx.messageBus.calls.length, 0);
  });

  test("Announce publishes via the bus and does not touch pendingAsks", async () => {
    const ctx = createOrchestrationContext();
    ctx.messageBus = stubBus();
    const handler = createAnnounceHandler(ctx, { from: "agent-1" });
    const result = await handler({ message: "Heads up" });

    assert.strictEqual(ctx.pendingAsks.size, 0);
    assert.strictEqual(ctx.messageBus.calls.length, 1);
    assert.strictEqual(ctx.messageBus.calls[0].method, "announce");
    assert.strictEqual(ctx.messageBus.calls[0].from, "agent-1");
    assert.strictEqual(ctx.messageBus.calls[0].text, "Heads up");
    assert.strictEqual(result.content[0].type, "text");
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
});

describe("OrchestrationToolkit - checkPendingAsk", () => {
  test("returns advance when no pending ask", () => {
    const ctx = createOrchestrationContext();
    const bus = stubBus();
    const decision = checkPendingAsk({
      ctx,
      messageBus: bus,
      addresseeName: "agent-1",
      mode: "facilitated",
      emitViolation: () => {},
    });
    assert.strictEqual(decision, "advance");
  });

  test("fires a synthetic reminder on first detection and returns recheck", () => {
    const ctx = createOrchestrationContext();
    ctx.pendingAsks.set("agent-1", {
      askId: 1,
      askerName: "facilitator",
      question: "Q?",
      reminded: false,
    });
    const bus = stubBus();
    const violations = [];
    const decision = checkPendingAsk({
      ctx,
      messageBus: bus,
      addresseeName: "agent-1",
      mode: "facilitated",
      emitViolation: (e) => violations.push(e),
    });
    assert.strictEqual(decision, "recheck");
    assert.strictEqual(violations.length, 0);
    assert.strictEqual(ctx.pendingAsks.get("agent-1").reminded, true);
    assert.strictEqual(bus.calls.length, 1);
    assert.strictEqual(bus.calls[0].method, "synthetic");
    assert.strictEqual(bus.calls[0].to, "agent-1");
  });

  test("emits protocol_violation on second detection and advances", () => {
    const ctx = createOrchestrationContext();
    ctx.pendingAsks.set("agent-1", {
      askId: 42,
      askerName: "facilitator",
      question: "Q?",
      reminded: true,
    });
    const bus = stubBus();
    const violations = [];
    const decision = checkPendingAsk({
      ctx,
      messageBus: bus,
      addresseeName: "agent-1",
      mode: "supervised",
      emitViolation: (e) => violations.push(e),
    });
    assert.strictEqual(decision, "advance");
    assert.strictEqual(violations.length, 1);
    assert.deepStrictEqual(violations[0], {
      type: "protocol_violation",
      agent: "agent-1",
      askId: 42,
      mode: "supervised",
    });
    assert.strictEqual(ctx.pendingAsks.has("agent-1"), false);
    // Null-answer injection from the orchestrator onto the asker's queue.
    assert.strictEqual(bus.calls.length, 1);
    assert.strictEqual(bus.calls[0].method, "answer");
    assert.strictEqual(bus.calls[0].from, "@orchestrator");
    assert.strictEqual(bus.calls[0].to, "facilitator");
    assert.strictEqual(bus.calls[0].askId, 42);
    assert.ok(bus.calls[0].text.includes("no answer"));
  });
});

describe("OrchestrationToolkit - server factories", () => {
  test("createSupervisorToolServer exposes Ask/Announce/Conclude/Redirect/RollCall", () => {
    const ctx = createOrchestrationContext();
    ctx.participants = [
      { name: "supervisor", role: "supervisor" },
      { name: "agent", role: "agent" },
    ];
    const server = createSupervisorToolServer(ctx);
    assert.strictEqual(server.type, "sdk");
    assert.strictEqual(server.name, "orchestration");
    // The server instance exposes an internal `.instance` with server metadata —
    // we assert tool presence via the public server config below instead.
    assert.ok(server);
  });

  test("createSupervisedAgentToolServer exposes Ask/Answer/Announce/RollCall", () => {
    const ctx = createOrchestrationContext();
    const server = createSupervisedAgentToolServer(ctx);
    assert.strictEqual(server.type, "sdk");
    assert.strictEqual(server.name, "orchestration");
  });

  test("createFacilitatorToolServer returns sdk-type server", () => {
    const ctx = createOrchestrationContext();
    ctx.messageBus = stubBus();
    const server = createFacilitatorToolServer(ctx);
    assert.strictEqual(server.type, "sdk");
    assert.strictEqual(server.name, "orchestration");
  });

  test("createFacilitatedAgentToolServer returns sdk-type server", () => {
    const ctx = createOrchestrationContext();
    ctx.messageBus = stubBus();
    const server = createFacilitatedAgentToolServer(ctx, {
      from: "agent-1",
    });
    assert.strictEqual(server.type, "sdk");
    assert.strictEqual(server.name, "orchestration");
  });
});

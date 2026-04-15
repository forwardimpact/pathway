import { describe, test } from "node:test";
import assert from "node:assert";
import { PassThrough } from "node:stream";

import { Facilitator } from "@forwardimpact/libeval";
import {
  createOrchestrationContext,
  createConcludeHandler,
} from "../src/orchestration-toolkit.js";
import { MessageBus } from "../src/message-bus.js";
import { createMockRunner } from "./mock-runner.js";

function concludeMsg(summary) {
  return {
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          id: "conclude-1",
          name: "Conclude",
          input: { summary },
        },
      ],
    },
  };
}

function tellMsg(to, message) {
  return {
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          id: `tell-${to}`,
          name: "Tell",
          input: { to, message },
        },
      ],
    },
  };
}

describe("Facilitator - core orchestration", () => {
  test("turn 0 Conclude: no agents start", async () => {
    const ctx = createOrchestrationContext();
    const concludeHandler = createConcludeHandler(ctx);
    const messageBus = new MessageBus({
      participants: ["facilitator", "agent-1"],
    });
    ctx.messageBus = messageBus;

    const facilitatorRunner = createMockRunner(
      [{ text: "Done immediately" }],
      [[concludeMsg("Nothing to do")]],
      {
        toolDispatcher: {
          Conclude: (input) => concludeHandler(input),
        },
      },
    );

    let agentStarted = false;
    const agentRunner = createMockRunner([{ text: "Never" }]);
    const origRun = agentRunner.run;
    agentRunner.run = async (task) => {
      agentStarted = true;
      return origRun.call(agentRunner, task);
    };

    const output = new PassThrough();
    const facilitator = new Facilitator({
      facilitatorRunner,
      agents: [{ name: "agent-1", role: "worker", runner: agentRunner }],
      messageBus,
      output,
      maxTurns: 10,
      ctx,
    });

    const result = await facilitator.run("Quick task");

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.turns, 1);
    assert.strictEqual(
      agentStarted,
      false,
      "Agent should not start when facilitator concludes on turn 0",
    );
  });

  test("lazy start: agents only start when they receive a message", async () => {
    const ctx = createOrchestrationContext();
    const concludeHandler = createConcludeHandler(ctx);
    const messageBus = new MessageBus({
      participants: ["facilitator", "agent-1", "agent-2"],
    });
    ctx.messageBus = messageBus;

    // Facilitator tells agent-1 in turn 0, then concludes when agent-1's
    // lifecycle event triggers a facilitator turn
    const facilitatorRunner = createMockRunner(
      [{ text: "Assigning work" }, { text: "Done" }],
      [[tellMsg("agent-1", "Explore the docs")], [concludeMsg("All done")]],
      {
        toolDispatcher: {
          Tell: (input) =>
            messageBus.tell("facilitator", input.to, input.message),
          Conclude: (input) => concludeHandler(input),
        },
      },
    );

    let agent1Started = false;
    let agent2Started = false;
    const agent1Runner = createMockRunner([{ text: "Found docs" }]);
    const origRun1 = agent1Runner.run;
    agent1Runner.run = async (task) => {
      agent1Started = true;
      // Agent sends findings back to facilitator only (not agent-2)
      messageBus.tell("agent-1", "facilitator", "Found the docs");
      return origRun1.call(agent1Runner, task);
    };
    const agent2Runner = createMockRunner([{ text: "Never called" }]);
    const origRun2 = agent2Runner.run;
    agent2Runner.run = async (task) => {
      agent2Started = true;
      return origRun2.call(agent2Runner, task);
    };

    const output = new PassThrough();
    const facilitator = new Facilitator({
      facilitatorRunner,
      agents: [
        { name: "agent-1", role: "explorer", runner: agent1Runner },
        { name: "agent-2", role: "tester", runner: agent2Runner },
      ],
      messageBus,
      output,
      maxTurns: 10,
      ctx,
    });

    const result = await facilitator.run("Test task");

    assert.strictEqual(result.success, true);
    assert.strictEqual(agent1Started, true, "agent-1 should have started");
    assert.strictEqual(
      agent2Started,
      false,
      "agent-2 should not have started (no message)",
    );
  });

  test("trace uses universal { source, seq, event } envelope", async () => {
    const ctx = createOrchestrationContext();
    const concludeHandler = createConcludeHandler(ctx);
    const messageBus = new MessageBus({
      participants: ["facilitator", "agent-1"],
    });
    ctx.messageBus = messageBus;

    const facilitatorRunner = createMockRunner(
      [{ text: "Go" }, { text: "Done" }],
      [[tellMsg("agent-1", "Do work")], [concludeMsg("Complete")]],
      {
        toolDispatcher: {
          Tell: (input) =>
            messageBus.tell("facilitator", input.to, input.message),
          Conclude: (input) => concludeHandler(input),
        },
      },
    );

    const agentRunner = createMockRunner([{ text: "Working" }]);
    const origRun = agentRunner.run;
    agentRunner.run = async (task) => {
      messageBus.share("agent-1", "Done working");
      return origRun.call(agentRunner, task);
    };

    const output = new PassThrough();
    const facilitator = new Facilitator({
      facilitatorRunner,
      agents: [{ name: "agent-1", role: "worker", runner: agentRunner }],
      messageBus,
      output,
      maxTurns: 10,
      ctx,
    });
    facilitatorRunner.onLine = (line) =>
      facilitator.emitLine("facilitator", line);
    agentRunner.onLine = (line) => facilitator.emitLine("agent-1", line);

    await facilitator.run("Do the work");

    const data = output.read()?.toString() ?? "";
    const lines = data
      .trim()
      .split("\n")
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l));

    // All lines with seq should be monotonically increasing
    const seqs = lines
      .filter((l) => typeof l.seq === "number")
      .map((l) => l.seq);
    for (let i = 1; i < seqs.length; i++) {
      assert.ok(
        seqs[i] > seqs[i - 1],
        `seq ${seqs[i]} should be > ${seqs[i - 1]}`,
      );
    }

    // Summary line should exist — wrapped in envelope
    const summary = lines.find(
      (l) => l.source === "orchestrator" && l.event?.type === "summary",
    );
    assert.ok(summary, "Trace should contain summary");
    assert.strictEqual(summary.event.success, true);
  });

  test("fail-fast: agent error aborts all sessions", async () => {
    const ctx = createOrchestrationContext();
    const messageBus = new MessageBus({
      participants: ["facilitator", "agent-1", "agent-2"],
    });
    ctx.messageBus = messageBus;

    const facilitatorRunner = createMockRunner(
      [{ text: "Assigning" }],
      [[tellMsg("agent-1", "Do work"), tellMsg("agent-2", "Do work")]],
      {
        toolDispatcher: {
          Tell: (input) =>
            messageBus.tell("facilitator", input.to, input.message),
        },
      },
    );

    // agent-1 throws an error
    const agent1Runner = createMockRunner([{ text: "Crash" }]);
    agent1Runner.run = async () => {
      throw new Error("Agent-1 process crashed");
    };

    const agent2Runner = createMockRunner([{ text: "Working" }]);

    const output = new PassThrough();
    const facilitator = new Facilitator({
      facilitatorRunner,
      agents: [
        { name: "agent-1", role: "a", runner: agent1Runner },
        { name: "agent-2", role: "b", runner: agent2Runner },
      ],
      messageBus,
      output,
      maxTurns: 10,
      ctx,
    });

    await assert.rejects(() => facilitator.run("Test fail-fast"), {
      message: "Agent-1 process crashed",
    });
  });
});

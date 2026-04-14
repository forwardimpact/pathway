import { describe, test } from "node:test";
import assert from "node:assert";
import { PassThrough } from "node:stream";

import { Facilitator } from "@forwardimpact/libeval";
import {
  createOrchestrationContext,
  createConcludeHandler,
  createRollCallHandler,
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

function shareMsg(message) {
  return {
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          id: "share-1",
          name: "Share",
          input: { message },
        },
      ],
    },
  };
}

describe("Facilitator - messaging", () => {
  test("Tell delivers message to specific agent", async () => {
    const ctx = createOrchestrationContext();
    const concludeHandler = createConcludeHandler(ctx);
    const messageBus = new MessageBus({
      participants: ["facilitator", "agent-1", "agent-2"],
    });
    ctx.messageBus = messageBus;

    // Facilitator tells both agents in turn 0, then concludes when lifecycle triggers
    const facilitatorRunner = createMockRunner(
      [{ text: "Assigning" }, { text: "Done" }],
      [
        [tellMsg("agent-1", "Do task A"), tellMsg("agent-2", "Do task B")],
        [concludeMsg("Complete")],
      ],
      {
        toolDispatcher: {
          Tell: (input) =>
            messageBus.tell("facilitator", input.to, input.message),
          Conclude: (input) => concludeHandler(input),
        },
      },
    );

    let agent1Task = null;
    let agent2Task = null;
    const agent1Runner = createMockRunner([{ text: "Did A" }]);
    const origRun1 = agent1Runner.run;
    agent1Runner.run = async (task) => {
      agent1Task = task;
      messageBus.share("agent-1", "A done");
      return origRun1.call(agent1Runner, task);
    };
    const agent2Runner = createMockRunner([{ text: "Did B" }]);
    const origRun2 = agent2Runner.run;
    agent2Runner.run = async (task) => {
      agent2Task = task;
      return origRun2.call(agent2Runner, task);
    };

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

    await facilitator.run("Coordinate");

    assert.ok(agent1Task && agent1Task.includes("Do task A"));
    assert.ok(agent2Task && agent2Task.includes("Do task B"));
  });

  test("Share delivers to all participants except sender", async () => {
    const ctx = createOrchestrationContext();
    const concludeHandler = createConcludeHandler(ctx);
    const messageBus = new MessageBus({
      participants: ["facilitator", "agent-1", "agent-2"],
    });
    ctx.messageBus = messageBus;

    // Facilitator broadcasts in turn 0, then concludes when lifecycle triggers
    const facilitatorRunner = createMockRunner(
      [{ text: "Broadcasting" }, { text: "Done" }],
      [[shareMsg("Everyone listen")], [concludeMsg("Complete")]],
      {
        toolDispatcher: {
          Share: (input) => messageBus.share("facilitator", input.message),
          Conclude: (input) => concludeHandler(input),
        },
      },
    );

    let agent1Task = null;
    let agent2Task = null;
    const agent1Runner = createMockRunner([{ text: "Heard" }]);
    const origRun1 = agent1Runner.run;
    agent1Runner.run = async (task) => {
      agent1Task = task;
      messageBus.share("agent-1", "Acknowledged");
      return origRun1.call(agent1Runner, task);
    };
    const agent2Runner = createMockRunner([{ text: "Heard" }]);
    const origRun2 = agent2Runner.run;
    agent2Runner.run = async (task) => {
      agent2Task = task;
      return origRun2.call(agent2Runner, task);
    };

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

    await facilitator.run("Broadcast test");

    assert.ok(
      agent1Task && agent1Task.includes("Everyone listen"),
      "agent-1 should receive the broadcast",
    );
    assert.ok(
      agent2Task && agent2Task.includes("Everyone listen"),
      "agent-2 should receive the broadcast",
    );
  });

  test("RollCall returns participant list", async () => {
    const ctx = createOrchestrationContext();
    ctx.participants = [
      { name: "facilitator", role: "facilitator" },
      { name: "agent-1", role: "explorer" },
    ];
    const rollCallHandler = createRollCallHandler(ctx);

    const result = await rollCallHandler();
    const parsed = JSON.parse(result.content[0].text);
    assert.strictEqual(parsed.length, 2);
    assert.strictEqual(parsed[0].name, "facilitator");
    assert.strictEqual(parsed[1].name, "agent-1");
  });
});

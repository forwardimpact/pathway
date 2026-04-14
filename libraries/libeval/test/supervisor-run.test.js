import { describe, test } from "node:test";
import assert from "node:assert";
import { PassThrough } from "node:stream";

import { Supervisor } from "@forwardimpact/libeval";
import {
  createOrchestrationContext,
  createConcludeHandler,
  createAskHandler,
} from "../src/orchestration-toolkit.js";
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

describe("Supervisor - run and turns", () => {
  test("constructor throws on missing agentRunner", () => {
    assert.throws(
      () =>
        new Supervisor({
          supervisorRunner: createMockRunner([]),
          output: new PassThrough(),
        }),
      /agentRunner is required/,
    );
  });

  test("constructor throws on missing supervisorRunner", () => {
    assert.throws(
      () =>
        new Supervisor({
          agentRunner: createMockRunner([]),
          output: new PassThrough(),
        }),
      /supervisorRunner is required/,
    );
  });

  test("constructor throws on missing output", () => {
    assert.throws(
      () =>
        new Supervisor({
          agentRunner: createMockRunner([]),
          supervisorRunner: createMockRunner([]),
        }),
      /output is required/,
    );
  });

  test("completes on Conclude tool call from supervisor at turn 0", async () => {
    const ctx = createOrchestrationContext();
    const concludeHandler = createConcludeHandler(ctx);

    const agentRunner = createMockRunner([]);

    const supervisorRunner = createMockRunner(
      [{ text: "Done" }],
      [[concludeMsg("All tasks complete")]],
      {
        toolDispatcher: {
          Conclude: (input) => concludeHandler(input),
        },
      },
    );

    const output = new PassThrough();
    const supervisor = new Supervisor({
      agentRunner,
      supervisorRunner,
      output,
      maxTurns: 10,
      ctx,
    });

    const result = await supervisor.run("Install stuff");

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.turns, 0);
    assert.strictEqual(ctx.summary, "All tasks complete");
  });

  test("completes after one agent turn", async () => {
    const ctx = createOrchestrationContext();
    const concludeHandler = createConcludeHandler(ctx);

    const agentRunner = createMockRunner([
      { text: "I installed the packages." },
    ]);

    const supervisorRunner = createMockRunner(
      [
        { text: "Welcome! Please install the packages." },
        { text: "Good work." },
      ],
      [undefined, [concludeMsg("Agent completed the task")]],
      {
        toolDispatcher: {
          Conclude: (input) => concludeHandler(input),
        },
      },
    );

    const output = new PassThrough();
    const supervisor = new Supervisor({
      agentRunner,
      supervisorRunner,
      output,
      maxTurns: 10,
      ctx,
    });

    const result = await supervisor.run("Install stuff");

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.turns, 1);
  });

  test("relays only the last assistant text block to the agent", async () => {
    const ctx = createOrchestrationContext();
    const concludeHandler = createConcludeHandler(ctx);

    const supervisorMessages = [
      [
        {
          type: "assistant",
          message: {
            content: [
              { type: "text", text: "Let me research the product first." },
            ],
          },
        },
        {
          type: "assistant",
          message: {
            content: [
              {
                type: "text",
                text: "Hello! Here is your task: install the packages.",
              },
            ],
          },
        },
      ],
      [concludeMsg("Done")],
    ];

    let capturedAgentPrompt = null;
    const agentRunner = createMockRunner([
      { text: "I installed the packages." },
    ]);
    const origRun = agentRunner.run;
    agentRunner.run = async (task) => {
      capturedAgentPrompt = task;
      return origRun.call(agentRunner, task);
    };

    const supervisorRunner = createMockRunner(
      [
        { text: "Hello! Here is your task: install the packages." },
        { text: "Done" },
      ],
      supervisorMessages,
      {
        toolDispatcher: {
          Conclude: (input) => concludeHandler(input),
        },
      },
    );

    const output = new PassThrough();
    const supervisor = new Supervisor({
      agentRunner,
      supervisorRunner,
      output,
      maxTurns: 10,
      ctx,
    });

    await supervisor.run("Evaluate the product");

    assert.strictEqual(
      capturedAgentPrompt,
      "Hello! Here is your task: install the packages.",
    );
    assert.ok(
      !capturedAgentPrompt.includes("research"),
      "Reasoning text should not leak to agent",
    );
  });

  test("runs multiple turns before completion", async () => {
    const ctx = createOrchestrationContext();
    const concludeHandler = createConcludeHandler(ctx);

    const agentRunner = createMockRunner([
      { text: "Started working." },
      { text: "Made progress." },
      { text: "Finished everything." },
    ]);

    const supervisorRunner = createMockRunner(
      [
        { text: "Here is your task. Do the work." },
        { text: "Keep going, you need to do more." },
        { text: "Almost there, continue." },
        { text: "Done" },
      ],
      [undefined, undefined, undefined, [concludeMsg("Complete")]],
      {
        toolDispatcher: {
          Conclude: (input) => concludeHandler(input),
        },
      },
    );

    const output = new PassThrough();
    const supervisor = new Supervisor({
      agentRunner,
      supervisorRunner,
      output,
      maxTurns: 10,
      ctx,
    });

    const result = await supervisor.run("Do the work");

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.turns, 3);
  });

  test("enforces maxTurns limit", async () => {
    const agentRunner = createMockRunner([
      { text: "Turn 1" },
      { text: "Turn 2" },
    ]);

    const supervisorRunner = createMockRunner([
      { text: "Start working." },
      { text: "Continue." },
      { text: "Continue." },
    ]);

    const output = new PassThrough();
    const supervisor = new Supervisor({
      agentRunner,
      supervisorRunner,
      output,
      maxTurns: 2,
    });

    const result = await supervisor.run("Endless task");

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.turns, 2);
  });

  test("agent Ask tool blocks until supervisor answers", async () => {
    const ctx = createOrchestrationContext();
    const concludeHandler = createConcludeHandler(ctx);

    // The agent calls Ask on its first turn. The onAsk callback runs
    // the supervisor inline and returns the answer.
    let askAnswer = null;
    const askHandler = createAskHandler(ctx, {
      onAsk: async (question) => {
        // Simulate supervisor answering the question
        return `The answer to "${question}" is: use npm install.`;
      },
    });

    // Agent messages: first message has a text block (triggers onBatch),
    // followed by an Ask tool_use. The Ask handler runs synchronously
    // from the agent's perspective.
    const agentMessages = [
      [
        {
          type: "assistant",
          message: {
            content: [
              {
                type: "tool_use",
                id: "ask-1",
                name: "Ask",
                input: { question: "Should I use npm or yarn?" },
              },
            ],
          },
        },
      ],
    ];

    const agentRunner = createMockRunner([{ text: "Done" }], agentMessages, {
      toolDispatcher: {
        Ask: async (input) => {
          const result = await askHandler(input);
          askAnswer = result.content[0].text;
        },
      },
    });

    const supervisorRunner = createMockRunner(
      [{ text: "Install the packages." }, { text: "Good" }],
      [undefined, [concludeMsg("Complete")]],
      {
        toolDispatcher: {
          Conclude: (input) => concludeHandler(input),
        },
      },
    );

    const output = new PassThrough();
    const supervisor = new Supervisor({
      agentRunner,
      supervisorRunner,
      output,
      maxTurns: 10,
      ctx,
    });

    const result = await supervisor.run("Install task");

    assert.strictEqual(result.success, true);
    assert.ok(askAnswer, "Ask handler should have been called");
    assert.ok(
      askAnswer.includes("npm install"),
      "Answer should contain the supervisor's response",
    );
  });
});

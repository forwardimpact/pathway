import { describe, test } from "node:test";
import assert from "node:assert";
import { PassThrough } from "node:stream";

import { Facilitator } from "@forwardimpact/libeval";
import {
  createOrchestrationContext,
  createConcludeHandler,
  createRedirectHandler,
  createAskHandler,
  createAnswerHandler,
} from "../src/orchestration-toolkit.js";
import { MessageBus } from "../src/message-bus.js";
import { createMockRunner } from "./mock-runner.js";
import { createToolUseMsg } from "@forwardimpact/libharness";

const concludeMsg = (summary) => createToolUseMsg("Conclude", { summary });
const askMsg = (to, question) =>
  createToolUseMsg("Ask", { to, question }, { id: `ask-${to}` });
const answerMsg = (message) =>
  createToolUseMsg("Answer", { message }, { id: "answer-1" });
const redirectMsg = (to, message) =>
  createToolUseMsg("Redirect", { to, message }, { id: "redirect-1" });

function seedCtx(participants) {
  const ctx = createOrchestrationContext();
  const messageBus = new MessageBus({ participants });
  ctx.messageBus = messageBus;
  ctx.participants = participants.map((name) => ({ name, role: name }));
  return { ctx, messageBus };
}

describe("Facilitator - redirect creates pending ask", () => {
  test("agent can Answer after being redirected", async () => {
    const { ctx, messageBus } = seedCtx(["facilitator", "agent-1"]);
    const concludeHandler = createConcludeHandler(ctx);
    const askHandler = createAskHandler(ctx, {
      from: "facilitator",
      defaultTo: undefined,
    });
    const redirectHandler = createRedirectHandler(ctx);

    // Turn 0: Ask agent-1
    // Turn 1 (after premature answer): Redirect agent-1
    // Turn 2 (after correct answer): Conclude
    const facilitatorRunner = createMockRunner(
      [{ text: "Asking" }, { text: "Redirecting" }, { text: "Done" }],
      [
        [askMsg("agent-1", "What is 2+2?")],
        [redirectMsg("agent-1", "Actually, what is 3+3?")],
        [concludeMsg("Complete")],
      ],
      {
        toolDispatcher: {
          Ask: (input) => askHandler(input),
          Redirect: (input) => redirectHandler(input),
          Conclude: (input) => concludeHandler(input),
        },
      },
    );

    const agent1AnswerHandler = createAnswerHandler(ctx, { from: "agent-1" });
    // Run 0: premature answer consuming the Ask slot
    // Resume (after redirect): correct answer — should succeed
    const agent1Runner = createMockRunner(
      [{ text: "Ready" }, { text: "Six" }],
      [[answerMsg("Ready")], [answerMsg("6")]],
      { toolDispatcher: { Answer: (i) => agent1AnswerHandler(i) } },
    );

    const output = new PassThrough();
    const facilitator = new Facilitator({
      facilitatorRunner,
      agents: [{ name: "agent-1", role: "worker", runner: agent1Runner }],
      messageBus,
      output,
      maxTurns: 10,
      ctx,
    });

    const result = await facilitator.run("Test redirect creates ask");

    assert.strictEqual(result.success, true);
    assert.ok(
      !ctx.pendingAsks.has("agent-1"),
      "pending ask should be cleared after agent answered the redirect",
    );
  });
});

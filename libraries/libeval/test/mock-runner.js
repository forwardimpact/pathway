/**
 * Test-only mock factory for AgentRunner. Yields pre-scripted responses,
 * and (when an `onBatch` callback is set) fires it at the same boundaries
 * the real AgentRunner would: every `runner.batchSize` assistant messages
 * with a text block, and the terminal `result` message. Tool-only
 * assistant messages accumulate into the pending batch without counting
 * toward the threshold. If the callback calls `abort()`, the mock stops
 * iterating that response's messages and reports `aborted: true` — any
 * lines that never made it through a flush boundary then ship in a
 * terminal batch, mirroring the real runner's finally-flush.
 *
 * Intentionally a regular module (not a test file) so describe/test blocks
 * here would not run. Lives under test/ to make its scope explicit.
 */

import { PassThrough } from "node:stream";
import { AgentRunner } from "@forwardimpact/libeval";
import { hasTextBlock } from "../src/agent-runner.js";

async function processMessage(runner, message, toolDispatcher, state) {
  recordLine(runner, message, state.pendingBatch);
  await dispatchTools(toolDispatcher, message);
  if (hasTextBlock(message)) state.assistantTextCount++;

  if (shouldFlushBatch(runner, message, state.assistantTextCount)) {
    state.assistantTextCount = 0;
    state.aborted = await flushBatch(runner, state.pendingBatch);
  }
}

function recordLine(runner, message, pendingBatch) {
  const line = JSON.stringify(message);
  runner.buffer.push(line);
  if (runner.onLine) runner.onLine(line);
  if (runner.onBatch) pendingBatch.push(line);
}

function shouldFlushBatch(runner, message, assistantTextCount) {
  return (
    runner.onBatch &&
    (message.type === "result" || assistantTextCount >= runner.batchSize)
  );
}

async function flushBatch(runner, pendingBatch) {
  let aborted = false;
  const batchLines = pendingBatch.splice(0);
  await runner.onBatch(batchLines, {
    abort: () => {
      aborted = true;
    },
  });
  return aborted;
}

async function dispatchTools(toolDispatcher, message) {
  if (!toolDispatcher || message.type !== "assistant") return;
  const content = message.message?.content ?? message.content ?? [];
  if (!Array.isArray(content)) return;
  for (const block of content) {
    if (block.type === "tool_use" && toolDispatcher[block.name]) {
      await toolDispatcher[block.name](block.input);
    }
  }
}

/**
 * Create a mock AgentRunner that yields pre-scripted responses. Each call
 * to `run()` or `resume()` pops the next response from the array.
 * @param {object[]} responses - Array of {text, success} objects
 * @param {object[]} [messages] - Messages to buffer per response
 * @param {object} [opts]
 * @param {Record<string, function>} [opts.toolDispatcher] - Map of tool name → async handler for orchestration tool calls
 * @returns {AgentRunner}
 */
export function createMockRunner(responses, messages, { toolDispatcher } = {}) {
  const output = new PassThrough();
  let callIndex = 0;

  const runner = new AgentRunner({
    cwd: "/tmp",
    query: async function* () {},
    output,
  });

  const consume = async (msgs) => {
    const state = { aborted: false, pendingBatch: [], assistantTextCount: 0 };

    for (const m of msgs) {
      await processMessage(runner, m, toolDispatcher, state);
      if (state.aborted) break;
    }

    // Terminal flush: mirror the real AgentRunner's abnormal-end path —
    // an aborted scripted run delivers any pending tail so the supervisor
    // sees the partial state.
    if (state.aborted && runner.onBatch && state.pendingBatch.length > 0) {
      await flushBatch(runner, state.pendingBatch);
    }
    return state.aborted;
  };

  runner.run = async (_task) => {
    const resp = responses[callIndex++];
    const msgs = messages?.[callIndex - 1] ?? [
      { type: "assistant", content: resp.text },
    ];
    const aborted = await consume(msgs);
    runner.sessionId = "mock-session";
    return {
      success: resp.success ?? true,
      text: resp.text,
      sessionId: "mock-session",
      aborted,
      error: null,
    };
  };

  runner.resume = async (_prompt) => {
    const resp = responses[callIndex++];
    const msgs = messages?.[callIndex - 1] ?? [
      { type: "assistant", content: resp.text },
    ];
    const aborted = await consume(msgs);
    return {
      success: resp.success ?? true,
      text: resp.text,
      sessionId: runner.sessionId,
      aborted,
      error: null,
    };
  };

  return runner;
}

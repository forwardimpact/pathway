/**
 * Shared helpers for Facilitator and Supervisor orchestrators:
 * - `createAsyncQueue`  — simple promise-based queue used by the facilitator
 *                         event loop.
 * - `formatMessages`    — render a drained message batch as tagged lines.
 * - `isSessionNotFound` — detect the SDK's session-expired error.
 *
 * Callers handle session-loss recovery inline with `isSessionNotFound`
 * rather than via a wrapper helper. The recovery pattern is:
 *
 *     const result = await runner.resume(prompt);
 *     if (result.error && isSessionNotFound(result.error)) {
 *       runner.sessionId = null;
 *       return runner.run(freshPrompt);
 *     }
 *
 * Inlining is deliberate: a Promise-returning wrapper introduces an extra
 * microtask cycle around every resume(), which reorders concurrent
 * `Facilitator` loops in tests that depend on the original timing.
 */

/** Create a promise-based async queue for serializing event delivery to the facilitator loop. */
export function createAsyncQueue() {
  const items = [];
  let waiter = null;
  let closed = false;
  return {
    enqueue(item) {
      items.push(item);
      if (waiter) {
        waiter();
        waiter = null;
      }
    },
    async dequeue() {
      if (items.length > 0) return items.shift();
      if (closed) return null;
      await new Promise((resolve) => {
        waiter = resolve;
      });
      return items.length > 0 ? items.shift() : null;
    },
    close() {
      closed = true;
      if (waiter) {
        waiter();
        waiter = null;
      }
    },
  };
}

/**
 * Render a drained batch of bus messages as tagged text lines.
 * @param {Array<{from: string, text: string, kind?: string, direct?: boolean}>} messages
 * @returns {string}
 */
export function formatMessages(messages) {
  return messages.map(formatMessage).join("\n");
}

function formatMessage(m) {
  return `${tagFor(m)} ${m.from}: ${m.text}`;
}

function tagFor(m) {
  if (m.kind === "ask") return "[ask]";
  if (m.kind === "answer") return "[answer]";
  if (m.kind === "announce") return "[shared]";
  if (m.kind === "synthetic") return "[system]";
  if (m.kind === "direct") return "[direct]";
  return m.direct ? "[direct]" : "[shared]";
}

// Match by message-substring is deliberate: the Agent SDK does not expose a
// structured error code for "session expired between resumes", and the string
// is stable across SDK versions seen in CI traces.
/**
 * Whether an error is the SDK's "No conversation found with session ID" error
 * raised when `resume()` is called against a session the SDK has GC'd.
 * @param {Error|string|null|undefined} error
 * @returns {boolean}
 */
export function isSessionNotFound(error) {
  const msg = error?.message ?? String(error);
  return msg.includes("No conversation found with session ID");
}

import { describe, test } from "node:test";
import assert from "node:assert";

import { isSessionNotFound } from "../src/orchestrator-helpers.js";

describe("isSessionNotFound", () => {
  test("matches the canonical SDK error string", () => {
    const err = new Error(
      "Claude Code returned an error result: No conversation found with session ID: abc-123",
    );
    assert.strictEqual(isSessionNotFound(err), true);
  });

  test("matches plain Error with the substring", () => {
    assert.strictEqual(
      isSessionNotFound(new Error("No conversation found with session ID: x")),
      true,
    );
  });

  test("rejects unrelated errors", () => {
    assert.strictEqual(isSessionNotFound(new Error("rate limited")), false);
    assert.strictEqual(isSessionNotFound(new Error("timeout")), false);
  });

  test("does not throw on null / undefined / string inputs", () => {
    assert.strictEqual(isSessionNotFound(null), false);
    assert.strictEqual(isSessionNotFound(undefined), false);
    assert.strictEqual(
      isSessionNotFound("No conversation found with session ID: y"),
      true,
    );
  });
});

import { describe, test } from "node:test";
import assert from "node:assert";

import { MessageBus, createMessageBus } from "../src/message-bus.js";

describe("MessageBus", () => {
  test("share delivers to all others, not sender", () => {
    const bus = new MessageBus({ participants: ["a", "b", "c"] });
    bus.share("a", "hello");

    assert.deepStrictEqual(bus.drain("a"), []);
    assert.deepStrictEqual(bus.drain("b"), [
      { from: "a", text: "hello", direct: false },
    ]);
    assert.deepStrictEqual(bus.drain("c"), [
      { from: "a", text: "hello", direct: false },
    ]);
  });

  test("tell delivers to named recipient only", () => {
    const bus = new MessageBus({ participants: ["a", "b", "c"] });
    bus.tell("a", "b", "secret");

    assert.deepStrictEqual(bus.drain("a"), []);
    assert.deepStrictEqual(bus.drain("b"), [
      { from: "a", text: "secret", direct: true },
    ]);
    assert.deepStrictEqual(bus.drain("c"), []);
  });

  test("drain returns and clears messages", () => {
    const bus = new MessageBus({ participants: ["a", "b"] });
    bus.share("a", "msg1");
    bus.share("a", "msg2");

    const messages = bus.drain("b");
    assert.strictEqual(messages.length, 2);
    assert.deepStrictEqual(bus.drain("b"), []);
  });

  test("drain on empty queue returns []", () => {
    const bus = new MessageBus({ participants: ["a"] });
    assert.deepStrictEqual(bus.drain("a"), []);
  });

  test("waitForMessages resolves when message arrives", async () => {
    const bus = new MessageBus({ participants: ["a", "b"] });

    let resolved = false;
    const promise = bus.waitForMessages("b").then(() => {
      resolved = true;
    });

    assert.strictEqual(resolved, false);
    bus.share("a", "wake up");
    await promise;
    assert.strictEqual(resolved, true);
  });

  test("waitForMessages resolves immediately if messages pending", async () => {
    const bus = new MessageBus({ participants: ["a", "b"] });
    bus.share("a", "already here");

    await bus.waitForMessages("b");
    const messages = bus.drain("b");
    assert.strictEqual(messages.length, 1);
  });

  test("message shape includes from, text, direct", () => {
    const bus = new MessageBus({ participants: ["a", "b"] });
    bus.share("a", "broadcast");
    bus.tell("a", "b", "direct msg");

    const messages = bus.drain("b");
    assert.strictEqual(messages.length, 2);
    assert.strictEqual(messages[0].from, "a");
    assert.strictEqual(messages[0].text, "broadcast");
    assert.strictEqual(messages[0].direct, false);
    assert.strictEqual(messages[1].from, "a");
    assert.strictEqual(messages[1].text, "direct msg");
    assert.strictEqual(messages[1].direct, true);
  });

  test("unknown participant name throws", () => {
    const bus = new MessageBus({ participants: ["a"] });
    assert.throws(() => bus.share("unknown", "msg"), /Unknown participant/);
    assert.throws(() => bus.tell("a", "unknown", "msg"), /Unknown participant/);
    assert.throws(() => bus.drain("unknown"), /Unknown participant/);
    assert.throws(() => bus.waitForMessages("unknown"), /Unknown participant/);
  });

  test("createMessageBus factory returns instance", () => {
    const bus = createMessageBus({ participants: ["x", "y"] });
    assert.ok(bus instanceof MessageBus);
  });
});

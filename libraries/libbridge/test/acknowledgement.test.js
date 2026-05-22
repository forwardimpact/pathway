import { describe, expect, test } from "bun:test";

import { Acknowledgement } from "../src/acknowledgement.js";
import { ProgressTicker } from "../src/progress-ticker.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function makeReactionAdapter({ addImpl, removeImpl } = {}) {
  const adds = [];
  const removes = [];
  return {
    adds,
    removes,
    add: async (target) => {
      adds.push(target);
      return addImpl ? addImpl(target) : "reaction-id-1";
    },
    remove: async (reactionId, target) => {
      removes.push({ reactionId, target });
      if (removeImpl) await removeImpl(reactionId, target);
    },
  };
}

function makeTickerAdapter({ tickImpl } = {}) {
  const ticks = [];
  return {
    ticks,
    tick: async (target, n) => {
      ticks.push({ target, n });
      if (tickImpl) await tickImpl(target, n);
    },
  };
}

describe("Acknowledgement", () => {
  test("rejects construction without a reaction adapter", () => {
    expect(() => new Acknowledgement({})).toThrow();
    expect(() => new Acknowledgement({ reactionAdapter: {} })).toThrow();
  });

  test("rejects a ticker adapter that lacks tick()", () => {
    expect(
      () =>
        new Acknowledgement({
          reactionAdapter: makeReactionAdapter(),
          tickerAdapter: {},
        }),
    ).toThrow();
  });

  test("start adds the reaction immediately and finish removes it", async () => {
    const reactions = makeReactionAdapter();
    const ack = new Acknowledgement({ reactionAdapter: reactions });
    await ack.start("tok-1", { subjectId: "S_1" });
    expect(reactions.adds).toEqual([{ subjectId: "S_1" }]);
    expect(ack.pending("tok-1")).toBe(true);
    await ack.finish("tok-1");
    expect(reactions.removes).toHaveLength(1);
    expect(reactions.removes[0]).toEqual({
      reactionId: "reaction-id-1",
      target: { subjectId: "S_1" },
    });
    expect(ack.pending("tok-1")).toBe(false);
  });

  test("reaction-only mode never invokes a ticker", async () => {
    const reactions = makeReactionAdapter();
    const ticker = new ProgressTicker({ intervalMs: 10 });
    const ack = new Acknowledgement({
      reactionAdapter: reactions,
      progressTicker: ticker,
    });
    await ack.start("tok-2", { id: "x" });
    await wait(35);
    await ack.finish("tok-2");
    expect(ticker.size).toBe(0);
  });

  test("when a ticker adapter is supplied, tick() runs on each interval", async () => {
    const reactions = makeReactionAdapter();
    const ticks = makeTickerAdapter();
    const ack = new Acknowledgement({
      reactionAdapter: reactions,
      tickerAdapter: ticks,
      progressTicker: new ProgressTicker({ intervalMs: 10 }),
    });
    await ack.start("tok-3", { ref: "abc" });
    await wait(55);
    await ack.finish("tok-3");
    expect(ticks.ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks.ticks[0]).toEqual({ target: { ref: "abc" }, n: 1 });
    expect(ticks.ticks[1].n).toBe(2);
  });

  test("add() errors are swallowed and the lifecycle still proceeds", async () => {
    const reactions = {
      add: async () => {
        throw new Error("network");
      },
      remove: async () => {},
    };
    const ack = new Acknowledgement({ reactionAdapter: reactions });
    await expect(ack.start("tok-4", null)).resolves.toBeUndefined();
    expect(ack.pending("tok-4")).toBe(true);
    await ack.finish("tok-4");
    expect(ack.pending("tok-4")).toBe(false);
  });

  test("remove() errors are swallowed so the host's reply path is not blocked", async () => {
    const reactions = makeReactionAdapter({
      removeImpl: () => {
        throw new Error("offline");
      },
    });
    const ack = new Acknowledgement({ reactionAdapter: reactions });
    await ack.start("tok-5", "T");
    await expect(ack.finish("tok-5")).resolves.toBeUndefined();
  });

  test("tick() errors auto-stop the ticker without blocking finish()", async () => {
    const reactions = makeReactionAdapter();
    const ticks = makeTickerAdapter({
      tickImpl: () => {
        throw new Error("post failed");
      },
    });
    const ticker = new ProgressTicker({ intervalMs: 10 });
    const ack = new Acknowledgement({
      reactionAdapter: reactions,
      tickerAdapter: ticks,
      progressTicker: ticker,
    });
    await ack.start("tok-6", "T");
    await wait(30);
    expect(ticker.size).toBe(0);
    await ack.finish("tok-6");
    expect(reactions.removes).toHaveLength(1);
  });

  test("finish without start is a no-op", async () => {
    const reactions = makeReactionAdapter();
    const ack = new Acknowledgement({ reactionAdapter: reactions });
    await ack.finish("never-started");
    expect(reactions.removes).toHaveLength(0);
  });

  test("double start on the same token is idempotent", async () => {
    const reactions = makeReactionAdapter();
    const ack = new Acknowledgement({ reactionAdapter: reactions });
    await ack.start("tok-7", "A");
    await ack.start("tok-7", "B");
    expect(reactions.adds).toEqual(["A"]);
  });
});

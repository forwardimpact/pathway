import { test, describe } from "node:test";
import assert from "node:assert";

import { classify } from "../src/classify.js";

const empty = { xRule1: [], xRule2: [], xRule3: [], mrRule1: [] };

describe("classify", () => {
  test("insufficient_data → insufficient", () => {
    assert.strictEqual(
      classify({ status: "insufficient_data", n: 5 }),
      "insufficient",
    );
  });

  test("no signals → stable", () => {
    assert.strictEqual(classify({ signals: empty }), "stable");
  });

  test("any X rule → signals", () => {
    assert.strictEqual(
      classify({ signals: { ...empty, xRule1: [{ slots: [3] }] } }),
      "signals",
    );
    assert.strictEqual(
      classify({
        signals: { ...empty, xRule2: [{ slots: [1, 2, 3, 4, 5, 6, 7, 8] }] },
      }),
      "signals",
    );
    assert.strictEqual(
      classify({ signals: { ...empty, xRule3: [{ slots: [1, 2, 3] }] } }),
      "signals",
    );
  });

  test("mR Rule 1 → chaos (overrides X rules)", () => {
    assert.strictEqual(
      classify({
        signals: {
          ...empty,
          xRule1: [{ slots: [3] }],
          mrRule1: [{ slots: [5] }],
        },
      }),
      "chaos",
    );
  });

  test("missing signals object → stable", () => {
    assert.strictEqual(classify({}), "stable");
  });
});

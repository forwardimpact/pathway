import { test, describe } from "node:test";
import assert from "node:assert";

import { analyze } from "../src/analyze.js";

function makeCSV(metric, values, { unit = "count" } = {}) {
  const header = "date,metric,value,unit,run,note";
  const rows = values.map((v, i) => {
    const day = String((i % 28) + 1).padStart(2, "0");
    const month = String(Math.floor(i / 28) + 1).padStart(2, "0");
    return `2026-${month}-${day},${metric},${v},${unit},,`;
  });
  return [header, ...rows].join("\n");
}

describe("analyze", () => {
  test("returns insufficient_data for fewer than 15 points", () => {
    const csv = makeCSV("bugs", [1, 2, 3, 4, 5]);
    const result = analyze(csv);
    assert.strictEqual(result.metrics[0].status, "insufficient_data");
    assert.strictEqual(result.metrics[0].classification, "insufficient");
    assert.strictEqual(result.metrics[0].n, 5);
  });

  test("returns predictable for stable data with no signals", () => {
    const values = Array.from({ length: 20 }, (_, i) => 10 + (i % 2));
    const csv = makeCSV("stable", values);
    const result = analyze(csv);
    assert.strictEqual(result.metrics[0].status, "predictable");
    assert.strictEqual(result.metrics[0].classification, "stable");
  });

  test("groups multiple metrics independently", () => {
    const rows = [
      "date,metric,value,unit,run,note",
      "2026-01-01,a,1,count,r,",
      "2026-01-01,b,2,count,r,",
      "2026-01-02,a,3,count,r,",
    ];
    const result = analyze(rows.join("\n"));
    assert.strictEqual(result.metrics.length, 2);
    assert.strictEqual(result.metrics[0].metric, "a");
    assert.strictEqual(result.metrics[1].metric, "b");
  });

  test("includes latest observation with mr", () => {
    const values = Array.from({ length: 20 }, (_, i) => 10 + (i % 3));
    const csv = makeCSV("m", values);
    const result = analyze(csv);
    const m = result.metrics[0];
    assert.ok(m.latest);
    assert.strictEqual(m.latest.value, values[values.length - 1]);
    assert.strictEqual(typeof m.latest.mr, "number");
  });

  test("Wheeler §10 example resolves to signals classification", () => {
    const csv = makeCSV("ex", [5, 6, 7, 5, 6, 4, 7, 8, 6, 13, 5, 6, 7, 6, 5]);
    const m = analyze(csv).metrics[0];
    assert.strictEqual(m.status, "signals_present");
    assert.strictEqual(m.classification, "chaos");
    assert.strictEqual(m.signals.xRule1.length, 1);
    assert.strictEqual(m.signals.mrRule1.length, 1);
  });

  test("exposes raw stats and full series for chart rendering", () => {
    const csv = makeCSV(
      "ex",
      Array.from({ length: 20 }, (_, i) => 10 + (i % 2)),
    );
    const m = analyze(csv).metrics[0];
    assert.ok(m.stats);
    assert.strictEqual(typeof m.stats.mu, "number");
    assert.strictEqual(typeof m.stats.UPL, "number");
    assert.strictEqual(typeof m.stats.LPL, "number");
    assert.strictEqual(typeof m.stats.URL, "number");
    assert.strictEqual(typeof m.stats.zoneUpper, "number");
    assert.ok(Array.isArray(m.values));
    assert.ok(Array.isArray(m.dates));
    assert.strictEqual(m.values.length, m.n);
  });
});

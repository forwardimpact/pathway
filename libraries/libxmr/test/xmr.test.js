import { test, describe } from "node:test";
import assert from "node:assert";

import {
  parseCSV,
  computeXmR,
  detectSignals,
  analyze,
  classify,
  validateCSV,
  listMetrics,
  sparkline,
} from "../src/xmr.js";

// Helper: generate N rows for a metric with given values.
function makeCSV(metric, values, { unit = "count" } = {}) {
  const header = "date,metric,value,unit,run,note";
  const rows = values.map((v, i) => {
    const day = String(i + 1).padStart(2, "0");
    const month = String(Math.floor(i / 28) + 1).padStart(2, "0");
    const d =
      i < 28
        ? `2026-01-${day}`
        : `2026-${month}-${String((i % 28) + 1).padStart(2, "0")}`;
    return `${d},${metric},${v},${unit},https://example.com/run/${i},`;
  });
  return [header, ...rows].join("\n");
}

describe("parseCSV", () => {
  test("parses a simple CSV", () => {
    const text = [
      "date,metric,value,unit,run,note",
      "2026-01-01,bugs,3,count,https://example.com,",
      '2026-01-02,bugs,5,count,https://example.com,"has, comma"',
    ].join("\n");

    const rows = parseCSV(text);
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].metric, "bugs");
    assert.strictEqual(rows[0].value, 3);
    assert.strictEqual(rows[0].note, "");
    assert.strictEqual(rows[1].note, "has, comma");
  });

  test("returns empty array for header-only CSV", () => {
    assert.deepStrictEqual(parseCSV("date,metric,value,unit,run,note"), []);
  });

  test("returns empty array for empty text", () => {
    assert.deepStrictEqual(parseCSV(""), []);
  });
});

describe("computeXmR", () => {
  test("computes correct statistics for known values", () => {
    const values = [10, 12, 11, 13, 10, 12, 11, 10, 13, 12];
    const stats = computeXmR(values);

    assert.strictEqual(stats.xBar, 11.4);
    assert.ok(stats.mrBar > 0);
    assert.ok(stats.unpl > stats.xBar);
    assert.ok(stats.lnpl < stats.xBar);
    assert.ok(stats.url > 0);
    assert.strictEqual(stats.mrs.length, 9);
  });

  test("handles single value", () => {
    const stats = computeXmR([5]);
    assert.strictEqual(stats.xBar, 5);
    assert.strictEqual(stats.mrBar, 0);
    assert.strictEqual(stats.mrs.length, 0);
  });

  test("LNPL floors at zero", () => {
    // Large variation relative to mean — should floor at 0
    const values = [1, 10, 1, 10, 1, 10];
    const stats = computeXmR(values);
    assert.strictEqual(stats.lnpl, 0);
  });
});

describe("detectSignals", () => {
  test("detects run above x-bar", () => {
    // 8 values above mean, then 2 below
    const values = [20, 21, 22, 20, 21, 20, 22, 21, 5, 5];
    const dates = values.map(
      (_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`,
    );
    const stats = computeXmR(values);
    const signals = detectSignals(dates, values, stats.mrs, stats);

    const runSignal = signals.find((s) => s.rule === "run_above");
    assert.ok(runSignal, "expected a run_above signal");
    assert.strictEqual(runSignal.length, 8);
  });

  test("detects trend down", () => {
    // 7 consecutive decreases
    const values = [10, 9, 8, 7, 6, 5, 4, 3, 10, 10, 10, 10, 10, 10, 10, 10];
    const dates = values.map(
      (_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`,
    );
    const stats = computeXmR(values);
    const signals = detectSignals(dates, values, stats.mrs, stats);

    const trend = signals.find((s) => s.rule === "trend_down");
    assert.ok(trend, "expected a trend_down signal");
    assert.ok(trend.moves >= 6);
  });

  test("returns empty signals for stable process", () => {
    // 15 points of low-variation data
    const values = [10, 10, 11, 10, 10, 11, 10, 11, 10, 10, 11, 10, 10, 11, 10];
    const dates = values.map(
      (_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`,
    );
    const stats = computeXmR(values);
    const signals = detectSignals(dates, values, stats.mrs, stats);

    const pointSignals = signals.filter(
      (s) => s.rule === "point_above_unpl" || s.rule === "point_below_lnpl",
    );
    assert.strictEqual(pointSignals.length, 0);
  });
});

describe("analyze", () => {
  test("returns insufficient_data for fewer than 15 points", () => {
    const csv = makeCSV("bugs", [1, 2, 3, 4, 5]);
    const result = analyze(csv);

    assert.strictEqual(result.metrics.length, 1);
    assert.strictEqual(result.metrics[0].status, "insufficient_data");
    assert.strictEqual(result.metrics[0].n, 5);
  });

  test("returns predictable for stable data", () => {
    // Small alternating variation avoids run signals from constant values
    const values = Array.from({ length: 20 }, (_, i) => 10 + (i % 2));
    const csv = makeCSV("stable", values);
    const result = analyze(csv);

    assert.strictEqual(result.metrics[0].status, "predictable");
    assert.strictEqual(result.metrics[0].signals.length, 0);
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

  test("includes latest observation", () => {
    const values = Array.from({ length: 20 }, (_, i) => 10 + (i % 3));
    const csv = makeCSV("m", values);
    const result = analyze(csv);
    const m = result.metrics[0];

    assert.ok(m.latest);
    assert.strictEqual(m.latest.value, values[values.length - 1]);
    assert.strictEqual(typeof m.latest.mr, "number");
  });
});

describe("classify", () => {
  test("returns insufficient for insufficient_data", () => {
    assert.strictEqual(
      classify({ status: "insufficient_data", n: 5 }),
      "insufficient",
    );
  });

  test("returns stable for predictable", () => {
    assert.strictEqual(
      classify({ status: "predictable", signals: [] }),
      "stable",
    );
  });

  test("returns signals for signals_present without mr_above_url", () => {
    assert.strictEqual(
      classify({
        status: "signals_present",
        signals: [{ rule: "run_above" }, { rule: "point_above_unpl" }],
      }),
      "signals",
    );
  });

  test("returns chaos when mr_above_url is among signals", () => {
    assert.strictEqual(
      classify({
        status: "signals_present",
        signals: [{ rule: "run_above" }, { rule: "mr_above_url" }],
      }),
      "chaos",
    );
  });
});

describe("validateCSV", () => {
  test("accepts valid CSV", () => {
    const csv = [
      "date,metric,value,unit,run,note",
      "2026-01-01,bugs,3,count,https://example.com,",
    ].join("\n");
    const result = validateCSV(csv);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.rows, 1);
    assert.strictEqual(result.errors.length, 0);
  });

  test("rejects wrong header", () => {
    const csv = "wrong,header\n1,2";
    const result = validateCSV(csv);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors[0].message.includes("expected header"));
  });

  test("rejects non-numeric value", () => {
    const csv = [
      "date,metric,value,unit,run,note",
      "2026-01-01,bugs,abc,count,https://example.com,",
    ].join("\n");
    const result = validateCSV(csv);
    assert.strictEqual(result.valid, false);
    const valueError = result.errors.find((e) => e.field === "value");
    assert.ok(valueError);
  });

  test("rejects invalid date", () => {
    const csv = [
      "date,metric,value,unit,run,note",
      "not-a-date,bugs,3,count,https://example.com,",
    ].join("\n");
    const result = validateCSV(csv);
    assert.strictEqual(result.valid, false);
    const dateError = result.errors.find((e) => e.field === "date");
    assert.ok(dateError);
  });

  test("rejects missing header", () => {
    const result = validateCSV("");
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors[0].message.includes("expected header"));
  });
});

describe("sparkline", () => {
  test("produces 12 characters", () => {
    const values = [10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11];
    const result = sparkline(values);
    assert.strictEqual(result.length, 12);
  });

  test("pads short input with spaces on the left", () => {
    const values = [5, 10];
    const result = sparkline(values);
    assert.strictEqual(result.length, 12);
    assert.strictEqual(result.slice(0, 10), "          ");
    assert.strictEqual(result[10], "▁");
    assert.strictEqual(result[11], "█");
  });

  test("maps min to lowest bar, max to highest bar", () => {
    const values = [0, 100];
    const result = sparkline(values);
    assert.strictEqual(result[10], "▁");
    assert.strictEqual(result[11], "█");
  });

  test("uses middle bar when all values are equal", () => {
    const values = Array.from({ length: 12 }, () => 10);
    const result = sparkline(values);
    for (const ch of result) {
      assert.strictEqual(ch, "▄");
    }
  });

  test("returns 12 spaces for empty input", () => {
    const result = sparkline([]);
    assert.strictEqual(result, "            ");
    assert.strictEqual(result.length, 12);
  });

  test("scales linearly across 8 bar levels", () => {
    // 8 evenly spaced values should produce all 8 bar characters
    const values = [0, 1, 2, 3, 4, 5, 6, 7];
    const result = sparkline(values);
    assert.strictEqual(result.slice(4), "▁▂▃▄▅▆▇█");
  });
});

describe("listMetrics", () => {
  test("returns metric inventory", () => {
    const csv = [
      "date,metric,value,unit,run,note",
      "2026-01-01,a,1,count,r,",
      "2026-01-02,a,2,count,r,",
      "2026-01-01,b,5,days,r,",
    ].join("\n");
    const metrics = listMetrics(csv);

    assert.strictEqual(metrics.length, 2);
    assert.strictEqual(metrics[0].metric, "a");
    assert.strictEqual(metrics[0].n, 2);
    assert.strictEqual(metrics[0].from, "2026-01-01");
    assert.strictEqual(metrics[0].to, "2026-01-02");
    assert.strictEqual(metrics[1].metric, "b");
    assert.strictEqual(metrics[1].unit, "days");
  });
});

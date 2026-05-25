import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { renderBlock, BlockRenderError } from "../src/block-renderer.js";
import { GENERATED_NOTICE } from "../src/issue-list-renderer.js";
import { analyze, renderChart } from "@forwardimpact/libxmr";

const HEADER = "date,metric,value,unit,run,note";

function makeCSV(metric, values) {
  const rows = values.map(
    (v, i) =>
      `2026-01-${String(i + 1).padStart(2, "0")},${metric},${v},count,,`,
  );
  return [HEADER, ...rows].join("\n");
}

describe("renderBlock", () => {
  test("predictable metric renders Latest, chart, and Signals", () => {
    const dir = mkdtempSync(join(tmpdir(), "block-"));
    const values = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    writeFileSync(join(dir, "test.csv"), makeCSV("findings", values));

    const lines = renderBlock({
      metric: "findings",
      csvPath: "test.csv",
      projectRoot: dir,
    });

    assert.equal(lines[0], GENERATED_NOTICE);
    assert.ok(lines[1].startsWith("**Latest:** 10"));
    assert.ok(lines[1].includes("**Status:** predictable"));
    assert.equal(lines[2], "");
    assert.equal(lines[3], "```");

    const report = analyze(makeCSV("findings", values));
    const m = report.metrics[0];
    const expectedChart = renderChart(m.values, m.stats, m.signals);
    const chartContent = lines.slice(4, lines.indexOf("```", 4)).join("\n");
    assert.equal(chartContent, expectedChart);

    const lastLine = lines[lines.length - 1];
    assert.ok(lastLine.startsWith("**Signals:**"));
    assert.ok(lastLine.includes("—"));
  });

  test("signals_present metric lists fired rules", () => {
    const dir = mkdtempSync(join(tmpdir(), "block-"));
    const values = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 50];
    writeFileSync(join(dir, "test.csv"), makeCSV("outlier", values));

    const lines = renderBlock({
      metric: "outlier",
      csvPath: "test.csv",
      projectRoot: dir,
    });

    assert.equal(lines[0], GENERATED_NOTICE);
    assert.ok(lines[1].includes("**Status:** signals_present"));
    const signalLine = lines[lines.length - 1];
    assert.ok(signalLine.includes("xRule1") || signalLine.includes("mrRule1"));
  });

  test("insufficient_data metric shows insufficient message", () => {
    const dir = mkdtempSync(join(tmpdir(), "block-"));
    const values = [10, 20, 30, 40, 50];
    writeFileSync(join(dir, "test.csv"), makeCSV("few", values));

    const lines = renderBlock({
      metric: "few",
      csvPath: "test.csv",
      projectRoot: dir,
    });

    assert.equal(lines[0], GENERATED_NOTICE);
    assert.ok(lines[1].includes("**Latest:** 50"));
    assert.ok(lines[1].includes("**Status:** insufficient_data"));

    const chartLine = lines[4];
    assert.ok(chartLine.includes("Insufficient data"));
    assert.ok(chartLine.includes("5 points"));
  });

  test("throws BlockRenderError for missing metric", () => {
    const dir = mkdtempSync(join(tmpdir(), "block-"));
    writeFileSync(join(dir, "test.csv"), makeCSV("exists", [10, 20, 30]));

    assert.throws(
      () =>
        renderBlock({
          metric: "nonexistent",
          csvPath: "test.csv",
          projectRoot: dir,
        }),
      BlockRenderError,
    );
  });
});

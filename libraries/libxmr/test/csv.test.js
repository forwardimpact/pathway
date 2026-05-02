import { test, describe } from "node:test";
import assert from "node:assert";

import { parseCSV, parseLine, validateCSV, listMetrics } from "../src/csv.js";

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

describe("parseLine", () => {
  test("parses a simple line", () => {
    const row = parseLine("2026-01-01,bugs,3,count,https://example.com,");
    assert.strictEqual(row.date, "2026-01-01");
    assert.strictEqual(row.metric, "bugs");
    assert.strictEqual(row.value, 3);
    assert.strictEqual(row.unit, "count");
  });

  test("respects quoted fields containing commas", () => {
    const row = parseLine(
      '2026-01-01,bugs,3,count,https://example.com,"has, comma"',
    );
    assert.strictEqual(row.note, "has, comma");
  });

  test("exposes raw fields for callers that need lossless access", () => {
    const row = parseLine("2026-01-01,bugs,abc,count,,");
    assert.strictEqual(Number.isNaN(row.value), true);
    assert.strictEqual(row.raw.fields[2], "abc");
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
    assert.ok(result.errors.find((e) => e.field === "value"));
  });

  test("rejects invalid date", () => {
    const csv = [
      "date,metric,value,unit,run,note",
      "not-a-date,bugs,3,count,https://example.com,",
    ].join("\n");
    const result = validateCSV(csv);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.find((e) => e.field === "date"));
  });

  test("rejects empty file with a clear message", () => {
    const result = validateCSV("");
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors[0].message.includes("empty"));
  });

  test("rejects missing header on a non-empty file", () => {
    const result = validateCSV("not a header line");
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors[0].message.includes("expected header"));
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
    assert.strictEqual(metrics[1].unit, "days");
  });
});

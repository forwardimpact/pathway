import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { scanMarkers } from "../src/marker-scanner.js";

describe("scanMarkers", () => {
  test("returns [] for text with no markers", () => {
    const text = "# Storyboard\n\nSome prose here.\n";
    assert.deepEqual(scanMarkers(text), []);
  });

  test("finds one marker pair", () => {
    const text = [
      "#### findings_count",
      "<!-- xmr:findings_count:wiki/metrics/kata-spec/2026.csv -->",
      "**Latest:** 3 · **Status:** predictable",
      "<!-- /xmr -->",
      "some prose",
    ].join("\n");

    const pairs = scanMarkers(text);
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0].metric, "findings_count");
    assert.equal(pairs[0].csvPath, "wiki/metrics/kata-spec/2026.csv");
    assert.equal(pairs[0].openLine, 1);
    assert.equal(pairs[0].closeLine, 3);
  });

  test("finds two marker pairs separated by prose", () => {
    const text = [
      "<!-- xmr:alpha:a.csv -->",
      "content a",
      "<!-- /xmr -->",
      "prose between",
      "<!-- xmr:beta:b.csv -->",
      "content b",
      "<!-- /xmr -->",
    ].join("\n");

    const pairs = scanMarkers(text);
    assert.equal(pairs.length, 2);
    assert.equal(pairs[0].metric, "alpha");
    assert.equal(pairs[1].metric, "beta");
  });

  test("skips dangling open marker", () => {
    const text = ["<!-- xmr:orphan:o.csv -->", "never closed"].join("\n");

    const pairs = scanMarkers(text);
    assert.equal(pairs.length, 0);
  });

  test("malformed close marker is not recognized", () => {
    const text = [
      "<!-- xmr:metric:path.csv -->",
      "content",
      "<!-- xmr -->",
    ].join("\n");

    const pairs = scanMarkers(text);
    assert.equal(pairs.length, 0);
  });

  test("second open before close resets to new marker", () => {
    const text = [
      "<!-- xmr:first:a.csv -->",
      "content",
      "<!-- xmr:second:b.csv -->",
      "replaced content",
      "<!-- /xmr -->",
    ].join("\n");

    const pairs = scanMarkers(text);
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0].metric, "second");
    assert.equal(pairs[0].csvPath, "b.csv");
    assert.equal(pairs[0].openLine, 2);
    assert.equal(pairs[0].closeLine, 4);
  });

  test("close without open is ignored", () => {
    const text = ["<!-- /xmr -->", "stray close"].join("\n");

    const pairs = scanMarkers(text);
    assert.equal(pairs.length, 0);
  });
});

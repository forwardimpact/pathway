import { test, describe } from "node:test";
import assert from "node:assert";

import { SummaryRenderer } from "../src/summary.js";

function createStream() {
  return {
    output: "",
    write(data) {
      this.output += data;
    },
  };
}

function makeProc(env = {}) {
  return { stdout: { write() {} }, env };
}

describe("SummaryRenderer", () => {
  test("writes title and aligned items", () => {
    const stream = createStream();
    const renderer = new SummaryRenderer({ process: makeProc() });
    renderer.render(
      {
        title: "Generated 38 files",
        ok: true,
        items: [
          { label: "definitions/", description: "Service definitions" },
          { label: "proto/", description: "Proto source files" },
        ],
      },
      stream,
    );
    assert.ok(stream.output.includes("Generated 38 files\n"));
    assert.ok(stream.output.includes("definitions/"));
    assert.ok(stream.output.includes("proto/"));
    const lines = stream.output.split("\n").filter((l) => l.startsWith("  "));
    const firstDash = lines[0].indexOf("—");
    const secondDash = lines[1].indexOf("—");
    assert.strictEqual(firstDash, secondDash);
  });

  test("writes only title when items is empty", () => {
    const stream = createStream();
    const renderer = new SummaryRenderer({ process: makeProc() });
    renderer.render({ title: "Done", ok: true, items: [] }, stream);
    assert.strictEqual(stream.output, "Done\n");
  });

  test("right-pads labels to the longest label width", () => {
    const stream = createStream();
    const renderer = new SummaryRenderer({ process: makeProc() });
    renderer.render(
      {
        title: "Title",
        ok: true,
        items: [
          { label: "ab", description: "short" },
          { label: "abcdef", description: "long" },
        ],
      },
      stream,
    );
    const lines = stream.output.split("\n").filter((l) => l.startsWith("  "));
    assert.ok(lines[0].includes("ab    "));
  });

  test("suppresses successful summary when LOG_LEVEL=error", () => {
    const stream = createStream();
    const renderer = new SummaryRenderer({
      process: makeProc({ LOG_LEVEL: "error" }),
    });
    renderer.render(
      { title: "Done", ok: true, items: [{ label: "a", description: "b" }] },
      stream,
    );
    assert.strictEqual(stream.output, "");
  });

  test("prints failed summary even when LOG_LEVEL=error", () => {
    const stream = createStream();
    const renderer = new SummaryRenderer({
      process: makeProc({ LOG_LEVEL: "error" }),
    });
    renderer.render(
      { title: "Failed", ok: false, items: [{ label: "a", description: "b" }] },
      stream,
    );
    assert.ok(stream.output.includes("Failed"));
    assert.ok(stream.output.includes("a"));
  });

  test("prints successful summary at default LOG_LEVEL", () => {
    const stream = createStream();
    const renderer = new SummaryRenderer({ process: makeProc() });
    renderer.render({ title: "Done", ok: true, items: [] }, stream);
    assert.strictEqual(stream.output, "Done\n");
  });

  test("throws when ok is missing", () => {
    const renderer = new SummaryRenderer({ process: makeProc() });
    assert.throws(
      () => renderer.render({ title: "x", items: [] }, createStream()),
      /requires an explicit `ok` boolean/,
    );
  });
});

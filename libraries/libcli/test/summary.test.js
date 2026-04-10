import { test, describe } from "node:test";
import assert from "node:assert";

import { SummaryRenderer } from "../summary.js";

function createStream() {
  return {
    output: "",
    write(data) {
      this.output += data;
    },
  };
}

const proc = { stdout: { write() {} } };

describe("SummaryRenderer", () => {
  test("writes title and aligned items", () => {
    const stream = createStream();
    const renderer = new SummaryRenderer({ process: proc });
    renderer.render(
      {
        title: "Generated 38 files",
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
    // Labels should be aligned
    const lines = stream.output.split("\n").filter((l) => l.startsWith("  "));
    const firstDash = lines[0].indexOf("\u2014");
    const secondDash = lines[1].indexOf("\u2014");
    assert.strictEqual(firstDash, secondDash);
  });

  test("writes only title when items is empty", () => {
    const stream = createStream();
    const renderer = new SummaryRenderer({ process: proc });
    renderer.render({ title: "Done", items: [] }, stream);
    assert.strictEqual(stream.output, "Done\n");
  });

  test("right-pads labels to the longest label width", () => {
    const stream = createStream();
    const renderer = new SummaryRenderer({ process: proc });
    renderer.render(
      {
        title: "Title",
        items: [
          { label: "ab", description: "short" },
          { label: "abcdef", description: "long" },
        ],
      },
      stream,
    );
    const lines = stream.output.split("\n").filter((l) => l.startsWith("  "));
    // "ab" should be padded to 6 chars to match "abcdef"
    assert.ok(lines[0].includes("ab    "));
  });
});

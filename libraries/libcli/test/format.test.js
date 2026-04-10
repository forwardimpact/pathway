import { test, describe } from "node:test";
import assert from "node:assert";

import {
  formatTable,
  formatHeader,
  formatError,
  indent,
  horizontalRule,
} from "../format.js";
import { colors } from "../color.js";

const noColor = { env: {}, stdout: { isTTY: false } };
const withColor = { env: { FORCE_COLOR: "1" }, stdout: { isTTY: true } };

describe("formatTable", () => {
  test("aligns columns correctly", () => {
    const result = formatTable(
      ["Name", "Value"],
      [
        ["short", "1"],
        ["longer name", "2"],
      ],
      {},
      noColor,
    );
    const lines = result.split("\n");
    assert.strictEqual(lines.length, 4); // header, separator, 2 rows
    assert.ok(lines[0].startsWith("Name"));
    assert.ok(lines[2].startsWith("short"));
    assert.ok(lines[3].startsWith("longer name"));
  });

  test("compact option omits separator", () => {
    const result = formatTable(
      ["A", "B"],
      [["1", "2"]],
      { compact: true },
      noColor,
    );
    const lines = result.split("\n");
    assert.strictEqual(lines.length, 2); // header + 1 row, no separator
  });
});

describe("formatHeader", () => {
  test("returns bold+cyan text when color supported", () => {
    const result = formatHeader("Title", withColor);
    assert.ok(result.includes(colors.bold));
    assert.ok(result.includes(colors.cyan));
    assert.ok(result.includes("Title"));
  });

  test("returns plain text when color not supported", () => {
    const result = formatHeader("Title", noColor);
    assert.strictEqual(result, "Title");
  });
});

describe("formatError", () => {
  test("returns red Error text when color supported", () => {
    const result = formatError("bad thing", withColor);
    assert.ok(result.includes(colors.red));
    assert.ok(result.includes("Error: bad thing"));
  });

  test("returns plain text when color not supported", () => {
    const result = formatError("bad thing", noColor);
    assert.strictEqual(result, "Error: bad thing");
  });
});

describe("indent", () => {
  test("adds correct padding to all lines", () => {
    const result = indent("line1\nline2", 4);
    assert.strictEqual(result, "    line1\n    line2");
  });

  test("defaults to 2 spaces", () => {
    const result = indent("a\nb");
    assert.strictEqual(result, "  a\n  b");
  });
});

describe("horizontalRule", () => {
  test("returns correct-width dashed line", () => {
    const result = horizontalRule(10, noColor);
    assert.strictEqual(result, "\u2500".repeat(10));
  });
});

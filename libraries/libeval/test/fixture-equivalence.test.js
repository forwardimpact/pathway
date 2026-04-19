/**
 * Fixture-anchored equivalence test — spec 540 criterion #6.
 *
 * The live `TeeWriter` stream and the offline `TraceCollector.toText()`
 * replay share one rendering path. If anyone changes a renderer without
 * updating both, this test catches it by comparing ANSI-stripped output
 * for a scripted multi-agent session.
 */

import { describe, test } from "node:test";
import assert from "node:assert";
import { PassThrough } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TeeWriter, TraceCollector } from "@forwardimpact/libeval";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {PassThrough} stream
 * @returns {string}
 */
function collect(stream) {
  const data = stream.read();
  return data ? data.toString() : "";
}

/**
 * @param {string} s
 */
function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex -- ANSI SGR detection is intentional.
  return s.replace(/\u001b\[[0-9;]*m/g, "");
}

describe("spec 540 fixture equivalence", () => {
  test("live TeeWriter text equals offline toText() replay", async () => {
    const fixturePath = path.join(__dirname, "fixtures", "multi-agent.ndjson");
    const lines = fs.readFileSync(fixturePath, "utf8").trim().split("\n");

    // Live path: stream every line through a supervised TeeWriter.
    const fileStream = new PassThrough();
    const textStream = new PassThrough();
    const writer = new TeeWriter({
      fileStream,
      textStream,
      mode: "supervised",
    });
    for (const line of lines) writer.write(line + "\n");
    await new Promise((resolve) => writer.end(resolve));
    const liveText = collect(textStream);

    // Offline path: same lines into a TraceCollector, render toText().
    const collector = new TraceCollector();
    for (const line of lines) collector.addLine(line);
    const offlineText = collector.toText();

    // Strip ANSI for the equivalence comparison, trim trailing whitespace
    // so footer newline differences between the two paths don't matter.
    // Both paths must agree on every visible character.
    assert.strictEqual(
      stripAnsi(liveText).trim(),
      stripAnsi(offlineText).trim(),
    );
  });
});

import { describe, test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runSplitCommand } from "../src/commands/trace.js";

/**
 * Create a temp directory and write combined NDJSON lines to a trace file.
 * @param {object[]} envelopes - Array of envelope objects { source, seq, event }
 * @returns {{ dir: string, file: string }}
 */
function setupTrace(envelopes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-split-"));
  const file = path.join(dir, "trace.ndjson");
  const content = envelopes.map((e) => JSON.stringify(e)).join("\n") + "\n";
  fs.writeFileSync(file, content);
  return { dir, file };
}

/**
 * Read an NDJSON output file and return parsed lines.
 * @param {string} filePath
 * @returns {object[]}
 */
function readNdjson(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

describe("fit-trace split", () => {
  describe("supervise mode", () => {
    test("produces trace-agent.ndjson and trace-supervisor.ndjson with unwrapped events", () => {
      const agentEvent = {
        type: "assistant",
        message: { content: [{ type: "text", text: "hello" }] },
      };
      const supervisorEvent = {
        type: "assistant",
        message: { content: [{ type: "text", text: "looks good" }] },
      };

      const { dir, file } = setupTrace([
        { source: "agent", seq: 0, event: agentEvent },
        { source: "supervisor", seq: 1, event: supervisorEvent },
      ]);

      runSplitCommand({ mode: "supervise" }, [file]);

      const agentLines = readNdjson(path.join(dir, "trace-agent.ndjson"));
      assert.strictEqual(agentLines.length, 1);
      assert.deepStrictEqual(agentLines[0], agentEvent);

      const supervisorLines = readNdjson(
        path.join(dir, "trace-supervisor.ndjson"),
      );
      assert.strictEqual(supervisorLines.length, 1);
      assert.deepStrictEqual(supervisorLines[0], supervisorEvent);
    });
  });

  describe("facilitate mode", () => {
    test("produces trace-facilitator.ndjson, trace-agent.ndjson, and per-agent files", () => {
      const facEvent = {
        type: "assistant",
        message: { content: [{ type: "text", text: "facilitating" }] },
      };
      const eng1Event = {
        type: "assistant",
        message: { content: [{ type: "text", text: "engineer 1 work" }] },
      };
      const eng2Event = {
        type: "assistant",
        message: { content: [{ type: "text", text: "engineer 2 work" }] },
      };

      const { dir, file } = setupTrace([
        { source: "facilitator", seq: 0, event: facEvent },
        { source: "staff-engineer", seq: 1, event: eng1Event },
        { source: "security-engineer", seq: 2, event: eng2Event },
      ]);

      runSplitCommand({ mode: "facilitate" }, [file]);

      // Facilitator trace
      const facLines = readNdjson(path.join(dir, "trace-facilitator.ndjson"));
      assert.strictEqual(facLines.length, 1);
      assert.deepStrictEqual(facLines[0], facEvent);

      // Per-agent traces
      const eng1Lines = readNdjson(
        path.join(dir, "trace-staff-engineer.ndjson"),
      );
      assert.strictEqual(eng1Lines.length, 1);
      assert.deepStrictEqual(eng1Lines[0], eng1Event);

      const eng2Lines = readNdjson(
        path.join(dir, "trace-security-engineer.ndjson"),
      );
      assert.strictEqual(eng2Lines.length, 1);
      assert.deepStrictEqual(eng2Lines[0], eng2Event);

      // Combined agent trace
      const combinedLines = readNdjson(path.join(dir, "trace-agent.ndjson"));
      assert.strictEqual(combinedLines.length, 2);
      assert.deepStrictEqual(combinedLines[0], eng1Event);
      assert.deepStrictEqual(combinedLines[1], eng2Event);
    });
  });

  describe("run mode", () => {
    test("produces no output files (no-op)", () => {
      const { dir, file } = setupTrace([
        {
          source: "agent",
          seq: 0,
          event: {
            type: "assistant",
            message: { content: [{ type: "text", text: "hi" }] },
          },
        },
      ]);

      runSplitCommand({ mode: "run" }, [file]);

      // Only the original trace.ndjson should exist
      const files = fs.readdirSync(dir);
      assert.deepStrictEqual(files, ["trace.ndjson"]);
    });
  });

  describe("invalid agent names filtered", () => {
    test("sources not matching [a-z][a-z0-9-]* are skipped in facilitate mode", () => {
      const validEvent = {
        type: "assistant",
        message: { content: [{ type: "text", text: "valid" }] },
      };
      const invalidEvent = {
        type: "assistant",
        message: { content: [{ type: "text", text: "invalid" }] },
      };

      const { dir, file } = setupTrace([
        { source: "facilitator", seq: 0, event: validEvent },
        { source: "valid-agent", seq: 1, event: validEvent },
        { source: "123-bad-name", seq: 2, event: invalidEvent },
        { source: "UPPER_CASE", seq: 3, event: invalidEvent },
        { source: "-starts-hyphen", seq: 4, event: invalidEvent },
      ]);

      runSplitCommand({ mode: "facilitate" }, [file]);

      // Only valid-agent should get its own trace file
      assert.ok(fs.existsSync(path.join(dir, "trace-valid-agent.ndjson")));
      assert.ok(!fs.existsSync(path.join(dir, "trace-123-bad-name.ndjson")));
      assert.ok(!fs.existsSync(path.join(dir, "trace-UPPER_CASE.ndjson")));
      assert.ok(!fs.existsSync(path.join(dir, "trace--starts-hyphen.ndjson")));

      // Combined agent trace only has valid-agent events
      const combinedLines = readNdjson(path.join(dir, "trace-agent.ndjson"));
      assert.strictEqual(combinedLines.length, 1);
      assert.deepStrictEqual(combinedLines[0], validEvent);
    });
  });

  describe("resilience", () => {
    test("empty lines and parse errors are skipped gracefully", () => {
      const event = {
        type: "assistant",
        message: { content: [{ type: "text", text: "hello" }] },
      };

      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-split-"));
      const file = path.join(dir, "trace.ndjson");
      const content = [
        "",
        "   ",
        "not valid json {{{",
        JSON.stringify({ source: "agent", seq: 0, event }),
        "",
        "also bad",
        JSON.stringify({ source: "supervisor", seq: 1, event }),
      ].join("\n");
      fs.writeFileSync(file, content);

      runSplitCommand({ mode: "supervise" }, [file]);

      const agentLines = readNdjson(path.join(dir, "trace-agent.ndjson"));
      assert.strictEqual(agentLines.length, 1);
      assert.deepStrictEqual(agentLines[0], event);

      const supervisorLines = readNdjson(
        path.join(dir, "trace-supervisor.ndjson"),
      );
      assert.strictEqual(supervisorLines.length, 1);
    });

    test("lines without envelope format are skipped", () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-split-"));
      const file = path.join(dir, "trace.ndjson");
      // Raw events without the { source, event } envelope
      const content = [
        JSON.stringify({ type: "assistant", message: { content: [] } }),
        JSON.stringify({
          source: "agent",
          seq: 0,
          event: { type: "assistant", message: { content: [] } },
        }),
      ].join("\n");
      fs.writeFileSync(file, content);

      runSplitCommand({ mode: "supervise" }, [file]);

      const agentLines = readNdjson(path.join(dir, "trace-agent.ndjson"));
      assert.strictEqual(agentLines.length, 1);
    });
  });

  describe("orchestrator events skipped", () => {
    test("source=orchestrator lines are excluded from output", () => {
      const agentEvent = {
        type: "assistant",
        message: { content: [{ type: "text", text: "work" }] },
      };
      const orchEvent = { type: "summary", success: true };

      const { dir, file } = setupTrace([
        { source: "agent", seq: 0, event: agentEvent },
        { source: "orchestrator", seq: 1, event: orchEvent },
        { source: "supervisor", seq: 2, event: agentEvent },
      ]);

      runSplitCommand({ mode: "supervise" }, [file]);

      // No orchestrator file should exist
      assert.ok(!fs.existsSync(path.join(dir, "trace-orchestrator.ndjson")));

      const agentLines = readNdjson(path.join(dir, "trace-agent.ndjson"));
      assert.strictEqual(agentLines.length, 1);
    });
  });

  describe("output-dir option", () => {
    test("writes files to specified directory instead of input directory", () => {
      const { file } = setupTrace([
        {
          source: "agent",
          seq: 0,
          event: {
            type: "assistant",
            message: { content: [{ type: "text", text: "hi" }] },
          },
        },
        {
          source: "supervisor",
          seq: 1,
          event: {
            type: "assistant",
            message: { content: [{ type: "text", text: "ok" }] },
          },
        },
      ]);

      const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-out-"));

      runSplitCommand({ mode: "supervise", "output-dir": outDir }, [file]);

      assert.ok(fs.existsSync(path.join(outDir, "trace-agent.ndjson")));
      assert.ok(fs.existsSync(path.join(outDir, "trace-supervisor.ndjson")));
    });

    test("creates output directory if it does not exist", () => {
      const { file } = setupTrace([
        {
          source: "agent",
          seq: 0,
          event: {
            type: "assistant",
            message: { content: [{ type: "text", text: "hi" }] },
          },
        },
      ]);

      const outDir = path.join(
        os.tmpdir(),
        `trace-nonexistent-${Date.now()}`,
        "nested",
      );

      runSplitCommand({ mode: "supervise", "output-dir": outDir }, [file]);

      assert.ok(fs.existsSync(path.join(outDir, "trace-agent.ndjson")));
    });
  });
});

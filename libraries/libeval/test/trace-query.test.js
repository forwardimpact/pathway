import { describe, test } from "node:test";
import assert from "node:assert";

import { TraceQuery, createTraceQuery } from "@forwardimpact/libeval";

/**
 * Build a minimal structured trace for testing.
 * @param {object} [overrides]
 * @returns {object}
 */
function buildTrace(overrides = {}) {
  return {
    version: "1.0.0",
    metadata: {
      timestamp: "2026-01-01T00:00:00Z",
      sessionId: "test-session",
      model: "claude-opus-4-6",
      claudeCodeVersion: "2.1.87",
      tools: ["Bash", "Read", "Edit"],
      permissionMode: "default",
      ...overrides.metadata,
    },
    turns: overrides.turns ?? [
      {
        index: 0,
        role: "assistant",
        content: [{ type: "text", text: "Let me check the files." }],
        usage: {
          inputTokens: 100,
          outputTokens: 15,
          cacheReadInputTokens: 200,
          cacheCreationInputTokens: 50,
        },
      },
      {
        index: 1,
        role: "assistant",
        content: [
          {
            type: "tool_use",
            toolUseId: "toolu_01",
            name: "Bash",
            input: { command: "ls -la" },
          },
        ],
        usage: {
          inputTokens: 120,
          outputTokens: 20,
          cacheReadInputTokens: 300,
          cacheCreationInputTokens: 0,
        },
      },
      {
        index: 2,
        role: "tool_result",
        toolUseId: "toolu_01",
        content: "total 42\ndrwxr-xr-x  5 user user 4096 Jan 01 12:00 .",
        isError: false,
      },
      {
        index: 3,
        role: "assistant",
        content: [
          { type: "text", text: "Now reading the config file." },
          {
            type: "tool_use",
            toolUseId: "toolu_02",
            name: "Read",
            input: { file_path: "/app/config.json" },
          },
        ],
        usage: {
          inputTokens: 150,
          outputTokens: 25,
          cacheReadInputTokens: 400,
          cacheCreationInputTokens: 0,
        },
      },
      {
        index: 4,
        role: "tool_result",
        toolUseId: "toolu_02",
        content: '{"port": 3000, "debug": true}',
        isError: false,
      },
      {
        index: 5,
        role: "assistant",
        content: [
          {
            type: "tool_use",
            toolUseId: "toolu_03",
            name: "Edit",
            input: {
              file_path: "/app/config.json",
              old_string: '"debug": true',
              new_string: '"debug": false',
            },
          },
        ],
        usage: {
          inputTokens: 160,
          outputTokens: 18,
          cacheReadInputTokens: 500,
          cacheCreationInputTokens: 0,
        },
      },
      {
        index: 6,
        role: "tool_result",
        toolUseId: "toolu_03",
        content: "File updated successfully.",
        isError: false,
      },
      {
        index: 7,
        role: "assistant",
        content: [
          {
            type: "tool_use",
            toolUseId: "toolu_04",
            name: "Bash",
            input: { command: "npm test" },
          },
        ],
        usage: {
          inputTokens: 170,
          outputTokens: 12,
          cacheReadInputTokens: 600,
          cacheCreationInputTokens: 0,
        },
      },
      {
        index: 8,
        role: "tool_result",
        toolUseId: "toolu_04",
        content: "Error: test suite failed\n  at runTests (test.js:42)",
        isError: true,
      },
      {
        index: 9,
        role: "assistant",
        content: [
          { type: "text", text: "The tests failed. Let me fix the issue." },
        ],
        usage: {
          inputTokens: 180,
          outputTokens: 10,
          cacheReadInputTokens: 700,
          cacheCreationInputTokens: 0,
        },
      },
    ],
    summary: {
      result: "success",
      isError: false,
      totalCostUsd: 0.0523,
      durationMs: 5200,
      numTurns: 5,
      tokenUsage: null,
      modelUsage: null,
      ...overrides.summary,
    },
  };
}

describe("TraceQuery", () => {
  describe("overview", () => {
    test("returns metadata, summary, turnCount, and tools", () => {
      const q = new TraceQuery(buildTrace());
      const ov = q.overview();

      assert.strictEqual(ov.metadata.model, "claude-opus-4-6");
      assert.strictEqual(ov.turnCount, 10);
      assert.strictEqual(ov.summary.totalCostUsd, 0.0523);
      assert.ok(ov.tools.length > 0);
      assert.strictEqual(ov.tools[0].tool, "Bash");
      assert.strictEqual(ov.tools[0].count, 2);
    });
  });

  describe("count", () => {
    test("returns number of turns", () => {
      const q = new TraceQuery(buildTrace());
      assert.strictEqual(q.count(), 10);
    });

    test("returns 0 for empty trace", () => {
      const q = new TraceQuery(buildTrace({ turns: [] }));
      assert.strictEqual(q.count(), 0);
    });
  });

  describe("batch", () => {
    test("returns turns in range [from, to)", () => {
      const q = new TraceQuery(buildTrace());
      const batch = q.batch(2, 5);

      assert.strictEqual(batch.length, 3);
      assert.strictEqual(batch[0].index, 2);
      assert.strictEqual(batch[2].index, 4);
    });

    test("clamps to available range", () => {
      const q = new TraceQuery(buildTrace());
      const batch = q.batch(8, 20);
      assert.strictEqual(batch.length, 2);
    });
  });

  describe("head", () => {
    test("returns first N turns (default 10)", () => {
      const q = new TraceQuery(buildTrace());
      const h = q.head();
      assert.strictEqual(h.length, 10);
      assert.strictEqual(h[0].index, 0);
    });

    test("returns first N turns with custom count", () => {
      const q = new TraceQuery(buildTrace());
      const h = q.head(3);
      assert.strictEqual(h.length, 3);
    });
  });

  describe("tail", () => {
    test("returns last N turns", () => {
      const q = new TraceQuery(buildTrace());
      const t = q.tail(3);
      assert.strictEqual(t.length, 3);
      assert.strictEqual(t[0].index, 7);
      assert.strictEqual(t[2].index, 9);
    });
  });

  describe("search", () => {
    test("finds text in assistant reasoning", () => {
      const q = new TraceQuery(buildTrace());
      const results = q.search("config file");

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].turn.index, 3);
      assert.ok(results[0].matches[0].startsWith("text:"));
    });

    test("finds text in tool result content", () => {
      const q = new TraceQuery(buildTrace());
      const results = q.search("test suite failed");

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].turn.index, 8);
      assert.ok(results[0].matches[0].startsWith("result:"));
    });

    test("finds tool name matches", () => {
      const q = new TraceQuery(buildTrace());
      const results = q.search("^Edit$");

      assert.ok(results.length >= 1);
      const hasToolNameMatch = results.some((r) =>
        r.matches.some((m) => m.startsWith("tool_name:")),
      );
      assert.ok(hasToolNameMatch);
    });

    test("finds text in tool input", () => {
      const q = new TraceQuery(buildTrace());
      const results = q.search("npm test");

      assert.ok(results.length >= 1);
      assert.ok(results[0].matches[0].includes("tool_input"));
    });

    test("respects limit option", () => {
      const q = new TraceQuery(buildTrace());
      const results = q.search(".", { limit: 2 });
      assert.strictEqual(results.length, 2);
    });

    test("includes context turns when requested", () => {
      const q = new TraceQuery(buildTrace());
      const results = q.search("test suite failed", { context: 1 });

      assert.strictEqual(results.length, 1);
      assert.ok(results[0].context.length > 0);
      // Context should include adjacent turns (index 7 and 9)
      const contextIndexes = results[0].context.map((t) => t.index);
      assert.ok(contextIndexes.includes(7));
      assert.ok(contextIndexes.includes(9));
    });

    test("returns empty array for no matches", () => {
      const q = new TraceQuery(buildTrace());
      const results = q.search("nonexistent_xyz_pattern");
      assert.strictEqual(results.length, 0);
    });
  });

  describe("toolFrequency", () => {
    test("returns tools sorted by count descending", () => {
      const q = new TraceQuery(buildTrace());
      const freq = q.toolFrequency();

      assert.strictEqual(freq[0].tool, "Bash");
      assert.strictEqual(freq[0].count, 2);
      assert.strictEqual(freq[1].count, 1);
      assert.strictEqual(freq[2].count, 1);
    });
  });

  describe("tool", () => {
    test("returns tool_use and matching tool_result turns", () => {
      const q = new TraceQuery(buildTrace());
      const turns = q.tool("Bash");

      // Should include both Bash tool_use turns and their results
      assert.strictEqual(turns.length, 4);
      assert.strictEqual(turns[0].role, "assistant");
      assert.strictEqual(turns[1].role, "tool_result");
      assert.strictEqual(turns[1].toolUseId, "toolu_01");
      assert.strictEqual(turns[2].role, "assistant");
      assert.strictEqual(turns[3].role, "tool_result");
      assert.strictEqual(turns[3].toolUseId, "toolu_04");
    });

    test("returns empty array for unknown tool", () => {
      const q = new TraceQuery(buildTrace());
      assert.strictEqual(q.tool("NonexistentTool").length, 0);
    });
  });

  describe("errors", () => {
    test("returns only error tool results", () => {
      const q = new TraceQuery(buildTrace());
      const errs = q.errors();

      assert.strictEqual(errs.length, 1);
      assert.strictEqual(errs[0].index, 8);
      assert.ok(errs[0].content.includes("test suite failed"));
    });

    test("returns empty array when no errors", () => {
      const trace = buildTrace();
      trace.turns = trace.turns.filter((t) => !t.isError);
      const q = new TraceQuery(trace);
      assert.strictEqual(q.errors().length, 0);
    });
  });

  describe("reasoning", () => {
    test("extracts text from assistant turns", () => {
      const q = new TraceQuery(buildTrace());
      const r = q.reasoning();

      assert.strictEqual(r.length, 3);
      assert.strictEqual(r[0].index, 0);
      assert.ok(r[0].text.includes("check the files"));
      assert.strictEqual(r[1].index, 3);
      assert.ok(r[1].text.includes("config file"));
      assert.strictEqual(r[2].index, 9);
    });

    test("respects from/to range", () => {
      const q = new TraceQuery(buildTrace());
      const r = q.reasoning({ from: 3, to: 8 });

      assert.strictEqual(r.length, 1);
      assert.strictEqual(r[0].index, 3);
    });
  });

  describe("timeline", () => {
    test("produces one line per non-thinking assistant turn", () => {
      const q = new TraceQuery(buildTrace());
      const lines = q.timeline();

      // 6 assistant turns (indexes 0,1,3,5,7,9), all visible
      assert.strictEqual(lines.length, 6);
    });

    test("shows tool names in output", () => {
      const q = new TraceQuery(buildTrace());
      const lines = q.timeline();

      assert.ok(lines[1].includes("Bash"));
      assert.ok(lines[2].includes("Read"));
    });

    test("shows (text only) for turns without tools", () => {
      const q = new TraceQuery(buildTrace());
      const lines = q.timeline();

      assert.ok(lines[0].includes("(text only)"));
    });

    test("includes token counts", () => {
      const q = new TraceQuery(buildTrace());
      const lines = q.timeline();

      assert.ok(lines[0].includes("in:"));
      assert.ok(lines[0].includes("out:"));
    });

    test("skips thinking-only assistant turns", () => {
      const trace = buildTrace({
        turns: [
          {
            index: 0,
            role: "assistant",
            content: [{ type: "thinking", thinking: "internal reasoning..." }],
            usage: { inputTokens: 10, outputTokens: 5 },
          },
          {
            index: 1,
            role: "assistant",
            content: [{ type: "text", text: "Visible output" }],
            usage: { inputTokens: 20, outputTokens: 10 },
          },
        ],
      });
      const q = new TraceQuery(trace);
      const lines = q.timeline();

      assert.strictEqual(lines.length, 1);
      assert.ok(lines[0].includes("Visible output"));
    });
  });

  describe("stats", () => {
    test("aggregates token totals", () => {
      const q = new TraceQuery(buildTrace());
      const s = q.stats();

      assert.ok(s.totals.inputTokens > 0);
      assert.ok(s.totals.outputTokens > 0);
      assert.ok(s.totals.cacheReadInputTokens > 0);
      assert.strictEqual(s.totals.totalCostUsd, 0.0523);
    });

    test("includes per-turn breakdown", () => {
      const q = new TraceQuery(buildTrace());
      const s = q.stats();

      // 6 assistant turns have usage (indexes 0,1,3,5,7,9)
      assert.strictEqual(s.perTurn.length, 6);
      assert.strictEqual(s.perTurn[0].index, 0);
      assert.strictEqual(s.perTurn[0].inputTokens, 100);
    });
  });

  describe("createTraceQuery", () => {
    test("accepts JSON string and plain object, returns TraceQuery", () => {
      for (const input of [JSON.stringify(buildTrace()), buildTrace()]) {
        const q = createTraceQuery(input);
        assert.ok(q instanceof TraceQuery);
        assert.strictEqual(q.count(), 10);
      }
    });
  });
});

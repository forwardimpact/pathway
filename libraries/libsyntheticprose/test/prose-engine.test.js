import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ProseEngine } from "../src/engine/prose.js";

function makeLogger() {
  return {
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: () => {},
  };
}

function makePromptLoader() {
  return {
    load: () => "system prompt",
    render: () => "rendered prompt",
  };
}

function makeLlmApi(response = "test response") {
  return {
    createCompletions: async () => ({
      choices: [{ message: { content: response } }],
    }),
  };
}

describe("ProseEngine", () => {
  test("returns null in no-prose mode", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "prose-test-"));
    try {
      const engine = new ProseEngine({
        cachePath: join(tmpDir, "cache.json"),
        mode: "no-prose",
        promptLoader: makePromptLoader(),
        logger: makeLogger(),
      });
      const result = await engine.generateProse("test-key", { topic: "test" });
      assert.strictEqual(result, null);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  test("returns cached result on cache hit", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "prose-test-"));
    try {
      const cacheData = {};
      // Pre-populate cache with a known hash
      const cachePath = join(tmpDir, "cache.json");
      writeFileSync(cachePath, JSON.stringify(cacheData));

      const engine = new ProseEngine({
        cachePath,
        mode: "generate",
        llmApi: makeLlmApi("fresh response"),
        promptLoader: makePromptLoader(),
        logger: makeLogger(),
      });

      // Generate first
      const r1 = await engine.generateProse("key1", { topic: "test" });
      assert.strictEqual(r1, "fresh response");
      assert.strictEqual(engine.stats.generated, 1);

      // Save and reload
      engine.saveCache();

      const engine2 = new ProseEngine({
        cachePath,
        mode: "cached",
        promptLoader: makePromptLoader(),
        logger: makeLogger(),
      });

      const r2 = await engine2.generateProse("key1", { topic: "test" });
      assert.strictEqual(r2, "fresh response");
      assert.strictEqual(engine2.stats.hits, 1);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  test("generateStructured respects maxTokens option", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "prose-test-"));
    let capturedMaxTokens = null;
    try {
      const engine = new ProseEngine({
        cachePath: join(tmpDir, "cache.json"),
        mode: "generate",
        llmApi: {
          createCompletions: async (opts) => {
            capturedMaxTokens = opts.max_tokens;
            return {
              choices: [{ message: { content: '{"test": true}' } }],
            };
          },
        },
        promptLoader: makePromptLoader(),
        logger: makeLogger(),
      });

      await engine.generateStructured(
        "test-key",
        [{ role: "user", content: "test" }],
        { maxTokens: 2000 },
      );
      assert.strictEqual(capturedMaxTokens, 2000);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  test("generateJson strips markdown fences", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "prose-test-"));
    try {
      const engine = new ProseEngine({
        cachePath: join(tmpDir, "cache.json"),
        mode: "generate",
        llmApi: makeLlmApi('```json\n{"key": "value"}\n```'),
        promptLoader: makePromptLoader(),
        logger: makeLogger(),
      });

      const result = await engine.generateJson("test-key", [
        { role: "user", content: "test" },
      ]);
      assert.deepStrictEqual(result, { key: "value" });
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  test("generateJson returns null in no-prose mode", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "prose-test-"));
    try {
      const engine = new ProseEngine({
        cachePath: join(tmpDir, "cache.json"),
        mode: "no-prose",
        promptLoader: makePromptLoader(),
        logger: makeLogger(),
      });

      const result = await engine.generateJson("test-key", [
        { role: "user", content: "test" },
      ]);
      assert.strictEqual(result, null);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ProseCache } from "../src/engine/cache.js";
import { ProseGenerator } from "../src/engine/generator.js";

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

function makeFixture(overrides = {}) {
  const tmpDir = mkdtempSync(join(tmpdir(), "prose-gen-"));
  const cache = new ProseCache({
    cachePath: join(tmpDir, "cache.json"),
    logger: makeLogger(),
  });
  const generator = new ProseGenerator({
    cache,
    mode: "generate",
    llmApi: makeLlmApi(),
    promptLoader: makePromptLoader(),
    logger: makeLogger(),
    ...overrides,
  });
  return { tmpDir, cache, generator };
}

describe("ProseGenerator", () => {
  test("generate returns null in no-prose mode", async () => {
    const { tmpDir, generator } = makeFixture({ mode: "no-prose" });
    try {
      const result = await generator.generate("test-key", { topic: "test" });
      assert.strictEqual(result, null);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  test("generate writes through to cache and bumps generated count", async () => {
    const { tmpDir, cache, generator } = makeFixture({
      llmApi: makeLlmApi("fresh response"),
    });
    try {
      const r1 = await generator.generate("key1", { topic: "test" });
      assert.strictEqual(r1, "fresh response");
      assert.strictEqual(generator.stats.generated, 1);
      assert.strictEqual([...cache.keys()].length, 1);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  test("generate returns cached value without calling LLM", async () => {
    const { tmpDir, cache, generator } = makeFixture({
      llmApi: makeLlmApi("first"),
    });
    try {
      await generator.generate("key1", { topic: "test" });
      cache.save();

      // New generator over same cache file, in cached mode (no LLM).
      const cache2 = new ProseCache({
        cachePath: cache.cachePath,
        logger: makeLogger(),
      });
      const generator2 = new ProseGenerator({
        cache: cache2,
        mode: "cached",
        promptLoader: makePromptLoader(),
        logger: makeLogger(),
      });
      const r2 = await generator2.generate("key1", { topic: "test" });
      assert.strictEqual(r2, "first");
      assert.strictEqual(cache2.stats.hits, 1);
      assert.strictEqual(generator2.stats.generated, 0);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  test("generate throws on cache miss when strict + cached", async () => {
    const { tmpDir, generator } = makeFixture({
      mode: "cached",
      strict: true,
    });
    try {
      await assert.rejects(
        () => generator.generate("missing", { topic: "x" }),
        /Cache miss/,
      );
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  test("generate returns null on cache miss when cached + non-strict", async () => {
    const { tmpDir, generator } = makeFixture({ mode: "cached" });
    try {
      const result = await generator.generate("missing", { topic: "x" });
      assert.strictEqual(result, null);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  test("generateStructured respects maxTokens option", async () => {
    let capturedMaxTokens = null;
    const { tmpDir, generator } = makeFixture({
      llmApi: {
        createCompletions: async (opts) => {
          capturedMaxTokens = opts.max_tokens;
          return {
            choices: [{ message: { content: '{"test": true}' } }],
          };
        },
      },
    });
    try {
      await generator.generateStructured(
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
    const { tmpDir, generator } = makeFixture({
      llmApi: makeLlmApi('```json\n{"key": "value"}\n```'),
    });
    try {
      const result = await generator.generateJson("test-key", [
        { role: "user", content: "test" },
      ]);
      assert.deepStrictEqual(result, { key: "value" });
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  test("generateJson returns null in no-prose mode", async () => {
    const { tmpDir, generator } = makeFixture({ mode: "no-prose" });
    try {
      const result = await generator.generateJson("test-key", [
        { role: "user", content: "test" },
      ]);
      assert.strictEqual(result, null);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});

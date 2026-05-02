import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ProseCache } from "../src/engine/cache.js";

function makeLogger() {
  return {
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: () => {},
  };
}

describe("ProseCache", () => {
  test("get returns undefined and bumps misses on absent key", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "prose-cache-"));
    try {
      const cache = new ProseCache({
        cachePath: join(tmpDir, "cache.json"),
        logger: makeLogger(),
      });
      assert.strictEqual(cache.get("nope"), undefined);
      assert.strictEqual(cache.stats.misses, 1);
      assert.strictEqual(cache.stats.hits, 0);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  test("set then get returns value and bumps hits", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "prose-cache-"));
    try {
      const cache = new ProseCache({
        cachePath: join(tmpDir, "cache.json"),
        logger: makeLogger(),
      });
      cache.set("k", "v");
      assert.strictEqual(cache.get("k"), "v");
      assert.strictEqual(cache.stats.hits, 1);
      assert.strictEqual(cache.has("k"), true);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  test("save writes dirty cache; reload restores entries", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "prose-cache-"));
    try {
      const cachePath = join(tmpDir, "cache.json");
      const cache = new ProseCache({ cachePath, logger: makeLogger() });
      cache.set("a", "1");
      cache.set("b", "2");
      cache.save();

      const onDisk = JSON.parse(readFileSync(cachePath, "utf-8"));
      assert.deepStrictEqual(onDisk, { _schema: 1, a: "1", b: "2" });

      const reloaded = new ProseCache({ cachePath, logger: makeLogger() });
      assert.strictEqual(reloaded.get("a"), "1");
      assert.strictEqual(reloaded.get("b"), "2");
      assert.deepStrictEqual([...reloaded.keys()], ["a", "b"]);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  test("save is a no-op when cache is not dirty", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "prose-cache-"));
    try {
      const cachePath = join(tmpDir, "cache.json");
      writeFileSync(cachePath, JSON.stringify({ pre: "loaded" }));
      const cache = new ProseCache({ cachePath, logger: makeLogger() });
      // No mutation — save should not rewrite the file.
      const before = readFileSync(cachePath, "utf-8");
      cache.save();
      const after = readFileSync(cachePath, "utf-8");
      assert.strictEqual(before, after);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  test("schema-mismatched cache file is discarded", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "prose-cache-"));
    try {
      const cachePath = join(tmpDir, "cache.json");
      writeFileSync(
        cachePath,
        JSON.stringify({ _schema: 99, leftover: "x" }),
      );
      const cache = new ProseCache({ cachePath, logger: makeLogger() });
      assert.strictEqual(cache.has("leftover"), false);
      assert.deepStrictEqual([...cache.keys()], []);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  test("corrupt cache file falls back to empty map", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "prose-cache-"));
    try {
      const cachePath = join(tmpDir, "cache.json");
      writeFileSync(cachePath, "{not json");
      const cache = new ProseCache({ cachePath, logger: makeLogger() });
      assert.strictEqual(cache.has("anything"), false);
      assert.deepStrictEqual([...cache.keys()], []);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});

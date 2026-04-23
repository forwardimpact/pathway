import { test, describe } from "node:test";
import assert from "node:assert";

import { createConfig } from "../src/index.js";
import { createMockStorage, spy } from "@forwardimpact/libharness";

describe("libconfig - Config getters", () => {
  const mockStorageFn = () =>
    createMockStorage({
      get: spy(() => Promise.resolve("")),
    });

  test("init returns init config from file data", async () => {
    const mockStorage = createMockStorage({
      get: spy(() =>
        Promise.resolve({
          init: {
            log_dir: "data/logs",
            shutdown_timeout: 5000,
            services: [{ name: "api", command: "bun start" }],
          },
        }),
      ),
    });

    const mockProcess = {
      cwd: spy(() => "/test/dir"),
      env: {},
    };

    const config = await createConfig(
      "test",
      "myservice",
      {},
      mockProcess,
      () => mockStorage,
    );

    assert.ok(config.init);
    assert.strictEqual(config.init.log_dir, "data/logs");
    assert.strictEqual(config.init.shutdown_timeout, 5000);
  });

  test("init returns null when not present in file", async () => {
    const mockStorage = createMockStorage({
      get: spy(() => Promise.resolve({})),
    });

    const mockProcess = {
      cwd: spy(() => "/test/dir"),
      env: {},
    };

    const config = await createConfig(
      "test",
      "myservice",
      {},
      mockProcess,
      () => mockStorage,
    );

    assert.strictEqual(config.init, null);
  });

  test("rootDir returns parent of config directory", async () => {
    const mockStorage = createMockStorage({
      get: spy(() => Promise.resolve({})),
      path: spy(() => "/project/root/config"),
    });

    const mockProcess = {
      cwd: spy(() => "/test/dir"),
      env: {},
    };

    const config = await createConfig(
      "test",
      "myservice",
      {},
      mockProcess,
      () => mockStorage,
    );

    assert.strictEqual(config.rootDir, "/project/root");
  });

  test("ghToken throws when not set in environment", async () => {
    const mockProcess = {
      cwd: spy(() => "/test/dir"),
      env: {},
    };

    const config = await createConfig(
      "test",
      "myservice",
      {},
      mockProcess,
      mockStorageFn,
    );
    assert.throws(() => config.ghToken(), {
      message: "GITHUB_TOKEN not found in environment",
    });
  });

  test("ghToken returns from environment", async () => {
    const mockProcess = {
      cwd: spy(() => "/test/dir"),
      env: { GITHUB_TOKEN: "gh-token-xyz" },
    };

    const config = await createConfig(
      "test",
      "myservice",
      {},
      mockProcess,
      mockStorageFn,
    );
    assert.strictEqual(config.ghToken(), "gh-token-xyz");
  });

  test("ghToken falls back to GH_TOKEN when GITHUB_TOKEN is unset", async () => {
    const mockProcess = {
      cwd: spy(() => "/test/dir"),
      env: { GH_TOKEN: "gh-cli-token" },
    };

    const config = await createConfig(
      "test",
      "myservice",
      {},
      mockProcess,
      mockStorageFn,
    );
    assert.strictEqual(config.ghToken(), "gh-cli-token");
  });

  test("ghToken prefers GITHUB_TOKEN when both are set", async () => {
    const mockProcess = {
      cwd: spy(() => "/test/dir"),
      env: { GITHUB_TOKEN: "github-token", GH_TOKEN: "gh-token" },
    };

    const config = await createConfig(
      "test",
      "myservice",
      {},
      mockProcess,
      mockStorageFn,
    );
    assert.strictEqual(config.ghToken(), "github-token");
  });

  test("llmToken throws when not set in environment", async () => {
    const mockProcess = {
      cwd: spy(() => "/test/dir"),
      env: {},
    };

    const config = await createConfig(
      "test",
      "myservice",
      {},
      mockProcess,
      mockStorageFn,
    );
    await assert.rejects(() => config.llmToken(), {
      message: "LLM_TOKEN not found in environment",
    });
  });

  test("llmBaseUrl returns custom URL from environment", async () => {
    const mockProcess = {
      cwd: spy(() => "/test/dir"),
      env: { LLM_BASE_URL: "https://custom.api.com" },
    };

    const config = await createConfig(
      "test",
      "myservice",
      {},
      mockProcess,
      mockStorageFn,
    );
    assert.strictEqual(config.llmBaseUrl(), "https://custom.api.com");
  });
});

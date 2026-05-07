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

  test("ghToken throws when not set in environment and gh cli fails", async () => {
    const mockProcess = {
      cwd: spy(() => "/test/dir"),
      env: {},
    };
    const mockExecSync = spy(() => {
      throw new Error("gh: command not found");
    });

    const config = await createConfig(
      "test",
      "myservice",
      {},
      mockProcess,
      mockStorageFn,
      mockExecSync,
    );
    assert.throws(() => config.ghToken(), /GH_TOKEN not found in environment/);
  });

  test("ghToken returns from environment", async () => {
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

  test("ghToken falls back to GITHUB_TOKEN when GH_TOKEN is unset", async () => {
    const mockProcess = {
      cwd: spy(() => "/test/dir"),
      env: { GITHUB_TOKEN: "actions-token" },
    };

    const config = await createConfig(
      "test",
      "myservice",
      {},
      mockProcess,
      mockStorageFn,
    );
    assert.strictEqual(config.ghToken(), "actions-token");
  });

  test("ghToken prefers GH_TOKEN when both are set", async () => {
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
    assert.strictEqual(config.ghToken(), "gh-token");
  });

  test("ghToken falls back to gh auth token when env vars are unset", async () => {
    const mockProcess = {
      cwd: spy(() => "/test/dir"),
      env: {},
    };
    const mockExecSync = spy(() => "fake-gh-cli-token\n");

    const config = await createConfig(
      "test",
      "myservice",
      {},
      mockProcess,
      mockStorageFn,
      mockExecSync,
    );
    assert.strictEqual(config.ghToken(), "fake-gh-cli-token");
    assert.strictEqual(mockExecSync.mock.callCount(), 1);
    assert.strictEqual(
      mockExecSync.mock.calls[0].arguments[0],
      "gh auth token",
    );
  });

  test("ghToken caches gh auth token result", async () => {
    const mockProcess = {
      cwd: spy(() => "/test/dir"),
      env: {},
    };
    const mockExecSync = spy(() => "fake-gh-cli-token");

    const config = await createConfig(
      "test",
      "myservice",
      {},
      mockProcess,
      mockStorageFn,
      mockExecSync,
    );
    const first = config.ghToken();
    const second = config.ghToken();
    assert.strictEqual(first, second);
    assert.strictEqual(mockExecSync.mock.callCount(), 1);
  });

  test("embeddingBaseUrl returns custom URL from environment", async () => {
    const mockProcess = {
      cwd: spy(() => "/test/dir"),
      env: { EMBEDDING_BASE_URL: "https://custom.api.com" },
    };

    const config = await createConfig(
      "test",
      "myservice",
      {},
      mockProcess,
      mockStorageFn,
    );
    assert.strictEqual(config.embeddingBaseUrl(), "https://custom.api.com");
  });
});

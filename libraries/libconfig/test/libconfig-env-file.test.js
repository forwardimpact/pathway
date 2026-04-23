import { test, describe, mock, afterEach } from "node:test";
import assert from "node:assert";
import { writeFileSync, mkdirSync, rmSync, chmodSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { createConfig } from "../src/index.js";
import { createMockStorage } from "@forwardimpact/libharness";

describe("libconfig - .env file loading", () => {
  const testDir = path.join(tmpdir(), `libconfig-env-test-${process.pid}`);
  const envPath = path.join(testDir, ".env");

  const mockStorageFn = () =>
    createMockStorage({
      get: mock.fn(() => Promise.resolve("")),
    });

  const createProcess = (env = {}) => ({
    cwd: () => testDir,
    env,
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true });
    } catch {
      // ignore
    }
  });

  function writeEnvFile(content) {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(envPath, content, "utf8");
  }

  test("loads allowed keys from .env file", async () => {
    writeEnvFile("GITHUB_TOKEN=from-env-file\nLLM_TOKEN=my-llm-token\n");

    const config = await createConfig(
      "test",
      "svc",
      {},
      createProcess(),
      mockStorageFn,
    );

    assert.strictEqual(config.ghToken(), "from-env-file");
    const token = await config.llmToken();
    assert.strictEqual(token, "my-llm-token");
  });

  test("process.env takes precedence over .env file", async () => {
    writeEnvFile("GITHUB_TOKEN=file-value\n");

    const config = await createConfig(
      "test",
      "svc",
      {},
      createProcess({ GITHUB_TOKEN: "env-value" }),
      mockStorageFn,
    );

    assert.strictEqual(config.ghToken(), "env-value");
  });

  test("GH_TOKEN from .env file is treated as a credential", async () => {
    writeEnvFile("GH_TOKEN=gh-cli-value\n");

    const proc = createProcess();
    const config = await createConfig("test", "svc", {}, proc, mockStorageFn);

    assert.strictEqual(config.ghToken(), "gh-cli-value");
    assert.strictEqual(proc.env.GH_TOKEN, undefined);
  });

  test("loads non-allowed keys into process.env", async () => {
    writeEnvFile(
      "SERVICE_SECRET=my-secret\nSERVICE_MCP_URL=http://localhost:3005\nGITHUB_TOKEN=allowed\n",
    );

    const mockProcess = createProcess();
    const config = await createConfig(
      "test",
      "svc",
      {},
      mockProcess,
      mockStorageFn,
    );

    assert.strictEqual(config.ghToken(), "allowed");
    assert.strictEqual(mockProcess.env.SERVICE_SECRET, "my-secret");
    assert.strictEqual(
      mockProcess.env.SERVICE_MCP_URL,
      "http://localhost:3005",
    );
  });

  test("process.env takes precedence for non-allowed keys", async () => {
    writeEnvFile("SERVICE_SECRET=from-file\n");

    const mockProcess = createProcess({ SERVICE_SECRET: "from-env" });
    await createConfig("test", "svc", {}, mockProcess, mockStorageFn);

    assert.strictEqual(mockProcess.env.SERVICE_SECRET, "from-env");
  });

  test("skips comments and blank lines", async () => {
    writeEnvFile(
      "# This is a comment\n\n  \nGITHUB_TOKEN=secret-value\n# another comment\n",
    );

    const config = await createConfig(
      "test",
      "svc",
      {},
      createProcess(),
      mockStorageFn,
    );

    assert.strictEqual(config.ghToken(), "secret-value");
  });

  test("strips surrounding quotes from values", async () => {
    writeEnvFile("GITHUB_TOKEN=\"double-quoted\"\nLLM_TOKEN='single-quoted'\n");

    const config = await createConfig(
      "test",
      "svc",
      {},
      createProcess(),
      mockStorageFn,
    );

    assert.strictEqual(config.ghToken(), "double-quoted");
    const token = await config.llmToken();
    assert.strictEqual(token, "single-quoted");
  });

  test("handles values containing equals signs", async () => {
    writeEnvFile("GITHUB_TOKEN=abc=def=ghi\n");

    const config = await createConfig(
      "test",
      "svc",
      {},
      createProcess(),
      mockStorageFn,
    );

    assert.strictEqual(config.ghToken(), "abc=def=ghi");
  });

  test("continues gracefully when .env file does not exist", async () => {
    mkdirSync(testDir, { recursive: true });
    // No .env file written

    const config = await createConfig(
      "test",
      "svc",
      {},
      createProcess(),
      mockStorageFn,
    );

    assert.throws(() => config.ghToken(), {
      message: "GITHUB_TOKEN not found in environment",
    });
  });

  test("throws on non-ENOENT errors (e.g. permission denied)", async (t) => {
    if (process.getuid?.() === 0) {
      t.skip("cannot enforce file permissions as root");
      return;
    }

    writeEnvFile("GITHUB_TOKEN=secret\n");
    chmodSync(envPath, 0o000);

    await assert.rejects(
      () => createConfig("test", "svc", {}, createProcess(), mockStorageFn),
      (error) => error.code === "EACCES",
    );

    // Restore permissions so afterEach cleanup works
    chmodSync(envPath, 0o644);
  });

  test("does not set .env values on the data object", async () => {
    writeEnvFile("GITHUB_TOKEN=token\nLLM_TOKEN=llm\n");

    const config = await createConfig(
      "test",
      "svc",
      {},
      createProcess(),
      mockStorageFn,
    );

    // These should only be accessible via getter methods, not as properties
    assert.strictEqual(config.GITHUB_TOKEN, undefined);
    assert.strictEqual(config.LLM_TOKEN, undefined);
  });

  test("reset clears .env overrides", async () => {
    writeEnvFile("GITHUB_TOKEN=from-file\n");

    const config = await createConfig(
      "test",
      "svc",
      {},
      createProcess(),
      mockStorageFn,
    );

    assert.strictEqual(config.ghToken(), "from-file");
    config.reset();

    // After reset, .env overrides are cleared and no process env either
    assert.throws(() => config.ghToken(), {
      message: "GITHUB_TOKEN not found in environment",
    });
  });

  test("loads all allowed keys", async () => {
    writeEnvFile(
      [
        "GITHUB_TOKEN=gh-token",
        "LLM_TOKEN=llm-tok",
        "LLM_BASE_URL=https://llm.example.com",
        "EMBEDDING_BASE_URL=https://embed.example.com",
        "MCP_TOKEN=mcp-tok",
        "ANTHROPIC_API_KEY=sk-ant-test",
      ].join("\n"),
    );

    const config = await createConfig(
      "test",
      "svc",
      {},
      createProcess(),
      mockStorageFn,
    );

    assert.strictEqual(config.ghToken(), "gh-token");
    assert.strictEqual(await config.llmToken(), "llm-tok");
    assert.strictEqual(config.llmBaseUrl(), "https://llm.example.com");
    assert.strictEqual(config.embeddingBaseUrl(), "https://embed.example.com");
    assert.strictEqual(config.mcpToken(), "mcp-tok");
  });

  test("values do not leak via Object.keys or JSON.stringify", async () => {
    writeEnvFile("GITHUB_TOKEN=token\nLLM_TOKEN=secret\n");

    const config = await createConfig(
      "test",
      "svc",
      {},
      createProcess(),
      mockStorageFn,
    );

    assert.ok(!Object.keys(config).includes("GITHUB_TOKEN"));
    assert.ok(!Object.keys(config).includes("LLM_TOKEN"));
    const serialized = JSON.stringify(config);
    assert.ok(!serialized.includes("token"));
    assert.ok(!serialized.includes("secret"));
  });

  test("strips export prefix on keys", async () => {
    writeEnvFile("export GITHUB_TOKEN=exported-value\n");

    const config = await createConfig(
      "test",
      "svc",
      {},
      createProcess(),
      mockStorageFn,
    );

    assert.strictEqual(config.ghToken(), "exported-value");
  });

  test("handles adversarial values safely", async () => {
    writeEnvFile(
      [
        "GITHUB_TOKEN=value\x00with-null",
        "LLM_TOKEN=" + "a".repeat(10000),
      ].join("\n"),
    );

    const config = await createConfig(
      "test",
      "svc",
      {},
      createProcess(),
      mockStorageFn,
    );

    assert.strictEqual(config.ghToken(), "value\x00with-null");
    const token = await config.llmToken();
    assert.strictEqual(token.length, 10000);
  });
});

import { test, describe } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = join(__dirname, "..", "bin", "fit-guide.js");
const source = readFileSync(cliPath, "utf8");

describe("fit-guide CLI", () => {
  test("entry point has shebang and uses librepl", () => {
    assert.ok(source.includes("#!/usr/bin/env node"));
    assert.ok(source.includes("@forwardimpact/librepl"));
    assert.ok(source.includes("new Repl"));
    assert.ok(source.includes("repl.start"));
  });

  test("defines expected commands", () => {
    for (const cmd of ["login", "logout", "init", "status", "version"]) {
      assert.ok(source.includes(`${cmd}:`), `Missing command: ${cmd}`);
    }
  });

  test("uses Claude Agent SDK", () => {
    assert.ok(source.includes("@anthropic-ai/claude-agent-sdk"));
    assert.ok(source.includes("query("));
  });

  test("layers product identity with MCP scope prompt", () => {
    assert.ok(source.includes("createProductConfig"));
    assert.ok(source.includes("guideConfig.systemPrompt"));
    assert.ok(source.includes("fetchMcpPrompt"));
    assert.ok(source.includes("options.systemPrompt = systemPrompt"));
  });

  test("tracks session ID across turns", () => {
    assert.ok(source.includes("sessionId"));
    assert.ok(source.includes("session_id"));
    assert.ok(source.includes("options.resume = state.sessionId"));
  });

  test("checks for LLM_TOKEN migration", () => {
    assert.ok(source.includes("LLM_TOKEN"));
    assert.ok(source.includes("no longer used"));
  });

  test("no process.exit(0) after repl.start()", () => {
    const startIdx = source.lastIndexOf("repl.start()");
    const afterStart = source.slice(startIdx);
    assert.ok(
      !afterStart.includes("process.exit"),
      "process.exit must not follow repl.start — librepl manages the lifecycle",
    );
  });
});

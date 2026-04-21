import { test, describe } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = join(__dirname, "..", "bin", "fit-guide.js");
const commandsDir = join(__dirname, "..", "src", "commands");

function readCommand(name) {
  return readFileSync(join(commandsDir, `${name}.js`), "utf8");
}

describe("fit-guide CLI", () => {
  test("CLI entry point exists and is valid JS", () => {
    const source = readFileSync(cliPath, "utf8");
    assert.ok(source.includes("#!/usr/bin/env node"));
    assert.ok(source.includes("createCli"));
  });

  test("CLI defines expected commands", () => {
    const source = readFileSync(cliPath, "utf8");
    for (const cmd of ["login", "logout", "resume", "init", "status"]) {
      assert.ok(source.includes(`name: "${cmd}"`), `Missing command: ${cmd}`);
    }
  });

  test("CLI imports command handlers from src/commands", () => {
    const source = readFileSync(cliPath, "utf8");
    assert.ok(source.includes("../src/commands/init.js"));
    assert.ok(source.includes("../src/commands/chat.js"));
    assert.ok(source.includes("../src/commands/status.js"));
  });

  test("chat command imports Claude Agent SDK", () => {
    const source = readCommand("chat");
    assert.ok(source.includes("@anthropic-ai/claude-agent-sdk"));
  });

  test("CLI checks for LLM_TOKEN migration", () => {
    const source = readFileSync(cliPath, "utf8");
    assert.ok(source.includes("LLM_TOKEN"));
    assert.ok(source.includes("no longer used"));
  });

  test("chat command fetches prompt from MCP endpoint", () => {
    const source = readCommand("chat");
    assert.ok(source.includes("prompts/get"));
    assert.ok(source.includes("guide-default"));
  });

  test("chat command persists session ID for resume", () => {
    const source = readCommand("chat");
    assert.ok(source.includes("last-session-id"));
    assert.ok(source.includes("session_id"));
  });

  test("init command generates SERVICE_SECRET", () => {
    const source = readCommand("init");
    assert.ok(source.includes("SERVICE_SECRET"));
    assert.ok(source.includes("generateSecret"));
  });
});

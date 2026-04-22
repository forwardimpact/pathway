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
    for (const cmd of ["login", "logout", "clear", "init", "status"]) {
      assert.ok(source.includes(`name: "${cmd}"`), `Missing command: ${cmd}`);
    }
  });

  test("CLI imports command handlers from src/commands", () => {
    const source = readFileSync(cliPath, "utf8");
    assert.ok(source.includes("../src/commands/init.js"));
    assert.ok(source.includes("../src/commands/resume.js"));
    assert.ok(source.includes("../src/commands/clear.js"));
    assert.ok(source.includes("../src/commands/status.js"));
  });

  test("resume command imports Claude Agent SDK", () => {
    const source = readCommand("resume");
    assert.ok(source.includes("@anthropic-ai/claude-agent-sdk"));
  });

  test("resume command drives a librepl Repl", () => {
    const source = readCommand("resume");
    assert.ok(source.includes("@forwardimpact/librepl"));
    assert.ok(source.includes("new Repl"));
    assert.ok(source.includes("repl.start"));
  });

  test("CLI checks for LLM_TOKEN migration", () => {
    const source = readFileSync(cliPath, "utf8");
    assert.ok(source.includes("LLM_TOKEN"));
    assert.ok(source.includes("no longer used"));
  });

  test("resume command fetches prompt from MCP endpoint", () => {
    const source = readCommand("resume");
    assert.ok(source.includes("prompts/get"));
    assert.ok(source.includes("guide-default"));
  });

  test("resume command tracks session ID across turns", () => {
    const source = readCommand("resume");
    assert.ok(source.includes("sessionId"));
    assert.ok(source.includes("session_id"));
    assert.ok(source.includes("options.resume = state.sessionId"));
  });

  test("clear command wipes stored state before resuming", () => {
    const source = readCommand("clear");
    assert.ok(source.includes("storage.delete"));
    assert.ok(source.includes("runResumeCommand"));
  });

  test("init command generates SERVICE_SECRET", () => {
    const source = readCommand("init");
    assert.ok(source.includes("SERVICE_SECRET"));
    assert.ok(source.includes("generateSecret"));
  });
});

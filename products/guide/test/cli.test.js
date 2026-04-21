import { test, describe } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = join(__dirname, "..", "bin", "fit-guide.js");

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

  test("CLI imports Claude Agent SDK for chat", () => {
    const source = readFileSync(cliPath, "utf8");
    assert.ok(source.includes("@anthropic-ai/claude-agent-sdk"));
  });

  test("CLI checks for LLM_TOKEN migration", () => {
    const source = readFileSync(cliPath, "utf8");
    assert.ok(source.includes("LLM_TOKEN"));
    assert.ok(source.includes("no longer used"));
  });

  test("CLI fetches prompt from MCP endpoint", () => {
    const source = readFileSync(cliPath, "utf8");
    assert.ok(source.includes("prompts/get"));
    assert.ok(source.includes("guide-default"));
  });

  test("CLI persists session ID for resume", () => {
    const source = readFileSync(cliPath, "utf8");
    assert.ok(source.includes("last-session-id"));
    assert.ok(source.includes("session_id"));
  });
});

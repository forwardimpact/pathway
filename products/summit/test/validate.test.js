import { after, afterEach, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runValidateCommand } from "../src/commands/validate.js";

import {
  ERRORS_AND_WARNINGS_ROSTER,
  FIXTURE_ROSTER,
  WARNINGS_ROSTER,
  loadStarterData,
} from "./fixtures.js";

let starterData;
let tempDir;
let originalWrite;
let chunks;
let originalExitCode;

before(async () => {
  ({ data: starterData } = await loadStarterData());
});

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "summit-validate-"));
  chunks = [];
  originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    return true;
  };
  originalExitCode = process.exitCode;
  process.exitCode = 0;
});

afterEach(() => {
  process.stdout.write = originalWrite;
  rmSync(tempDir, { recursive: true, force: true });
  process.exitCode = originalExitCode;
});

after(() => {
  // Ensure we never leak a non-zero exitCode from a failing-path test.
  process.exitCode = 0;
});

function writeRoster(yaml) {
  const path = join(tempDir, "roster.yaml");
  writeFileSync(path, yaml);
  return path;
}

async function runWith(yaml, format) {
  await runValidateCommand({
    data: starterData,
    options: { roster: writeRoster(yaml), format },
  });
  return chunks.join("");
}

test("runValidateCommand prints all three warnings after the success message", async () => {
  const out = await runWith(WARNINGS_ROSTER, "text");
  assert.match(out, /Roster is valid/);
  const validIdx = out.indexOf("Roster is valid");
  const warnIdx = out.indexOf("Composition warnings:");
  assert.ok(validIdx >= 0 && warnIdx > validIdx);
  assert.match(out, /\[NO_SENIOR_MEMBER\]/);
  assert.match(out, /\[TRACKLESS_AT_ENTRY_LEVEL\]/);
  assert.match(out, /\[LOW_ALLOCATION_PROJECT\]/);
  assert.equal(process.exitCode, 0);
});

test("runValidateCommand prints warnings after the error block when both exist", async () => {
  const out = await runWith(ERRORS_AND_WARNINGS_ROSTER, "text");
  const failIdx = out.indexOf("Roster validation failed:");
  const errIdx = out.indexOf("[UNKNOWN_LEVEL]");
  const warnIdx = out.indexOf("Composition warnings:");
  assert.ok(failIdx >= 0, "expected failure header");
  assert.ok(errIdx > failIdx, "expected UNKNOWN_LEVEL after failure header");
  assert.ok(warnIdx > errIdx, "expected warnings after errors");
  assert.equal(process.exitCode, 1);
});

test("runValidateCommand emits unchanged output when no warnings fire", async () => {
  const out = await runWith(FIXTURE_ROSTER, "text");
  // Plan step 6: exact-equality assertion locks in spec criterion 3 — no
  // accidental trailing lines or warnings header when warnings are empty.
  assert.equal(out, "  Roster is valid. 3 members across 1 teams.\n");
  assert.equal(process.exitCode, 0);
});

test("runValidateCommand JSON mode includes populated warnings array", async () => {
  const out = await runWith(WARNINGS_ROSTER, "json");
  const parsed = JSON.parse(out);
  assert.deepEqual(parsed.errors, []);
  const codes = parsed.warnings.map((w) => w.code).sort();
  assert.deepEqual(codes, [
    "LOW_ALLOCATION_PROJECT",
    "NO_SENIOR_MEMBER",
    "TRACKLESS_AT_ENTRY_LEVEL",
  ]);
  assert.equal(process.exitCode, 0);
});

import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { MEMO_INBOX_MARKER } from "../src/constants.js";

const CLI_PATH = new URL("../bin/fit-wiki.js", import.meta.url).pathname;

describe("fit-wiki memo CLI", () => {
  let dir;
  let agentsDir;
  let wikiRoot;
  let savedEnv;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "wiki-cli-"));
    agentsDir = join(dir, ".claude", "agents");
    wikiRoot = join(dir, "wiki");
    mkdirSync(agentsDir, { recursive: true });
    mkdirSync(wikiRoot);
    writeFileSync(join(dir, "package.json"), '{"name":"root"}');

    writeFileSync(join(agentsDir, "staff-engineer.md"), "# SE");
    writeFileSync(join(agentsDir, "product-manager.md"), "# PM");

    writeFileSync(
      join(wikiRoot, "staff-engineer.md"),
      `# Staff Engineer\n\n## Message Inbox\n\n${MEMO_INBOX_MARKER}\n\n- old bullet\n`,
    );
    writeFileSync(
      join(wikiRoot, "product-manager.md"),
      `# PM\n\n## Message Inbox\n\n${MEMO_INBOX_MARKER}\n\n- old bullet\n`,
    );

    savedEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  function run(args, env = {}) {
    return execFileSync("node", [CLI_PATH, ...args], {
      cwd: dir,
      env: { ...process.env, ...env, PATH: process.env.PATH },
      encoding: "utf-8",
    });
  }

  function runFail(args, env = {}) {
    try {
      execFileSync("node", [CLI_PATH, ...args], {
        cwd: dir,
        env: { ...process.env, ...env, PATH: process.env.PATH },
        encoding: "utf-8",
        stdio: "pipe",
      });
      assert.fail("expected non-zero exit");
    } catch (err) {
      return { status: err.status, stderr: err.stderr, stdout: err.stdout };
    }
  }

  test("single-target write", () => {
    const stdout = run([
      "memo",
      "--from",
      "technical-writer",
      "--to",
      "staff-engineer",
      "--message",
      "audit d642ff0c",
    ]);

    assert.ok(stdout.includes("wrote"));

    const content = readFileSync(join(wikiRoot, "staff-engineer.md"), "utf-8");
    assert.ok(content.includes("from **technical-writer**: audit d642ff0c"));
  });

  test("broadcast writes to every agent except sender", () => {
    writeFileSync(join(agentsDir, "technical-writer.md"), "# TW");
    writeFileSync(
      join(wikiRoot, "technical-writer.md"),
      `# TW\n\n## Message Inbox\n\n${MEMO_INBOX_MARKER}\n`,
    );

    run([
      "memo",
      "--from",
      "technical-writer",
      "--to",
      "all",
      "--message",
      "check baselines",
    ]);

    const se = readFileSync(join(wikiRoot, "staff-engineer.md"), "utf-8");
    const pm = readFileSync(join(wikiRoot, "product-manager.md"), "utf-8");
    const tw = readFileSync(join(wikiRoot, "technical-writer.md"), "utf-8");
    assert.ok(se.includes("check baselines"));
    assert.ok(pm.includes("check baselines"));
    assert.ok(!tw.includes("check baselines"), "sender's own inbox skipped");
  });

  test("missing-marker exits 2", () => {
    writeFileSync(
      join(wikiRoot, "staff-engineer.md"),
      "# SE\n\n## Message Inbox\n\n- no marker\n",
    );

    const { status, stderr } = runFail([
      "memo",
      "--from",
      "x",
      "--to",
      "staff-engineer",
      "--message",
      "test",
    ]);

    assert.equal(status, 2);
    assert.ok(stderr.includes("memo:inbox marker"));
  });

  test("missing target file exits 2", () => {
    const { status } = runFail([
      "memo",
      "--from",
      "x",
      "--to",
      "nonexistent",
      "--message",
      "test",
    ]);

    assert.equal(status, 2);
  });

  test("LIBEVAL_AGENT_PROFILE fallback when --from omitted", () => {
    const stdout = run(
      ["memo", "--to", "staff-engineer", "--message", "env test"],
      { LIBEVAL_AGENT_PROFILE: "security-engineer" },
    );

    assert.ok(stdout.includes("wrote"));

    const content = readFileSync(join(wikiRoot, "staff-engineer.md"), "utf-8");
    assert.ok(content.includes("from **security-engineer**: env test"));
  });

  test("exits 2 when neither --from nor env var set", () => {
    const { status } = runFail(
      ["memo", "--to", "staff-engineer", "--message", "test"],
      { LIBEVAL_AGENT_PROFILE: "" },
    );

    assert.equal(status, 2);
  });
});

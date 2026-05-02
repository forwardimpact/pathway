import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { EXPECTED_HEADER } from "../src/constants.js";

const CLI_PATH = new URL("../bin/fit-xmr.js", import.meta.url).pathname;

describe("fit-xmr record", () => {
  let dir;
  let wikiRoot;
  let savedEnv;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "xmr-record-"));
    wikiRoot = join(dir, "wiki");
    mkdirSync(join(wikiRoot, "metrics"), { recursive: true });
    writeFileSync(join(dir, "package.json"), '{"name":"root"}');
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
      stdio: "pipe",
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
      return { status: err.status, stderr: err.stderr };
    }
  }

  test("new file gets header + 1 row (criterion #4)", () => {
    run([
      "record",
      "--skill",
      "kata-test",
      "--metric",
      "test_count",
      "--value",
      "5",
      "--date",
      "2026-05-02",
      "--wiki-root",
      wikiRoot,
    ]);

    const csvPath = join(wikiRoot, "metrics", "kata-test", "2026.csv");
    assert.ok(existsSync(csvPath));

    const lines = readFileSync(csvPath, "utf-8").trim().split("\n");
    assert.equal(lines[0], EXPECTED_HEADER);
    assert.equal(lines.length, 2);
    assert.ok(lines[1].startsWith("2026-05-02,test_count,5,count,"));
  });

  test("append-only on existing file", () => {
    const csvDir = join(wikiRoot, "metrics", "kata-test");
    mkdirSync(csvDir, { recursive: true });
    writeFileSync(
      join(csvDir, "2026.csv"),
      EXPECTED_HEADER + "\n2026-05-01,test_count,3,count,,\n",
    );

    run([
      "record",
      "--skill",
      "kata-test",
      "--metric",
      "test_count",
      "--value",
      "7",
      "--date",
      "2026-05-02",
      "--wiki-root",
      wikiRoot,
    ]);

    const lines = readFileSync(join(csvDir, "2026.csv"), "utf-8")
      .trim()
      .split("\n");
    assert.equal(lines.length, 3);
    assert.ok(lines[2].startsWith("2026-05-02,test_count,7,count,"));
  });

  test("one-line output format (criterion #3)", () => {
    const stdout = run([
      "record",
      "--skill",
      "kata-test",
      "--metric",
      "test_count",
      "--value",
      "5",
      "--date",
      "2026-05-02",
      "--wiki-root",
      wikiRoot,
    ]);

    assert.match(stdout, /metric=test_count/);
    assert.match(stdout, /n=1/);
    assert.match(stdout, /status=insufficient_data/);
    assert.match(stdout, /latest=5/);
  });

  test("missing required --metric exits 2", () => {
    const { status } = runFail([
      "record",
      "--skill",
      "kata-test",
      "--value",
      "5",
      "--wiki-root",
      wikiRoot,
    ]);

    assert.equal(status, 2);
  });

  test("custom --wiki-root honoured", () => {
    const customWiki = join(dir, "custom-wiki");
    mkdirSync(join(customWiki, "metrics"), { recursive: true });

    run([
      "record",
      "--skill",
      "kata-test",
      "--metric",
      "test_count",
      "--value",
      "1",
      "--date",
      "2026-05-02",
      "--wiki-root",
      customWiki,
    ]);

    assert.ok(existsSync(join(customWiki, "metrics", "kata-test", "2026.csv")));
  });

  test("LIBEVAL_SKILL fallback when --skill omitted", () => {
    run(
      [
        "record",
        "--metric",
        "test_count",
        "--value",
        "1",
        "--date",
        "2026-05-02",
        "--wiki-root",
        wikiRoot,
      ],
      { LIBEVAL_SKILL: "kata-env-test" },
    );

    assert.ok(
      existsSync(join(wikiRoot, "metrics", "kata-env-test", "2026.csv")),
    );
  });

  test("exits 2 when neither --skill nor env var set", () => {
    const { status } = runFail(
      [
        "record",
        "--metric",
        "test_count",
        "--value",
        "1",
        "--wiki-root",
        wikiRoot,
      ],
      { LIBEVAL_SKILL: "" },
    );

    assert.equal(status, 2);
  });
});

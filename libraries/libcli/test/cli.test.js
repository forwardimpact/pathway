import { test, describe } from "node:test";
import assert from "node:assert";

import { Cli } from "../cli.js";
import { HelpRenderer } from "../help.js";

function createProc() {
  return {
    env: {},
    stdout: {
      isTTY: false,
      output: "",
      write(data) {
        this.output += data;
      },
    },
    stderr: {
      output: "",
      write(data) {
        this.output += data;
      },
    },
    exitCode: 0,
  };
}

const definition = {
  name: "fit-test",
  version: "1.0.0",
  description: "Test CLI",
  options: {
    output: { type: "string", description: "Output path" },
    json: { type: "boolean", description: "JSON output" },
    help: { type: "boolean", short: "h", description: "Show help" },
    version: { type: "boolean", description: "Show version" },
  },
};

function createCli(proc) {
  const helpRenderer = new HelpRenderer({ process: proc });
  return new Cli(definition, { process: proc, helpRenderer });
}

describe("Cli", () => {
  describe("parse", () => {
    test("returns values and positionals for normal input", () => {
      const proc = createProc();
      const cli = createCli(proc);
      const result = cli.parse(["run", "--output=out.txt"]);
      assert.deepStrictEqual(result.positionals, ["run"]);
      assert.strictEqual(result.values.output, "out.txt");
    });

    test("returns null and writes help when --help is passed", () => {
      const proc = createProc();
      const cli = createCli(proc);
      const result = cli.parse(["--help"]);
      assert.strictEqual(result, null);
      assert.ok(proc.stdout.output.includes("fit-test"));
      assert.ok(proc.stdout.output.includes("Test CLI"));
    });

    test("returns null and writes JSON when --help --json is passed", () => {
      const proc = createProc();
      const cli = createCli(proc);
      const result = cli.parse(["--help", "--json"]);
      assert.strictEqual(result, null);
      const parsed = JSON.parse(proc.stdout.output);
      assert.strictEqual(parsed.name, "fit-test");
    });

    test("returns null and writes version when --version is passed", () => {
      const proc = createProc();
      const cli = createCli(proc);
      const result = cli.parse(["--version"]);
      assert.strictEqual(result, null);
      assert.strictEqual(proc.stdout.output.trim(), "1.0.0");
    });

    test("throws on unknown flags", () => {
      const proc = createProc();
      const cli = createCli(proc);
      assert.throws(() => cli.parse(["--unknown"]), {
        code: "ERR_PARSE_ARGS_UNKNOWN_OPTION",
      });
    });
  });

  describe("showHelp", () => {
    test("writes help to stdout without re-parsing", () => {
      const proc = createProc();
      const cli = createCli(proc);
      cli.showHelp();
      assert.ok(proc.stdout.output.includes("fit-test"));
      assert.ok(proc.stdout.output.includes("Test CLI"));
    });
  });

  describe("parse with multiple option", () => {
    test("collects repeated flags into an array", () => {
      const proc = createProc();
      const multiDef = {
        name: "fit-multi",
        options: {
          tag: { type: "string", multiple: true, description: "Tags" },
          help: { type: "boolean", short: "h", description: "Show help" },
        },
      };
      const helpRenderer = new HelpRenderer({ process: proc });
      const cli = new Cli(multiDef, { process: proc, helpRenderer });
      const result = cli.parse(["--tag=a", "--tag=b"]);
      assert.deepStrictEqual(result.values.tag, ["a", "b"]);
    });
  });

  describe("error", () => {
    test("writes prefixed message to stderr and sets exitCode to 1", () => {
      const proc = createProc();
      const cli = createCli(proc);
      cli.error("something broke");
      assert.strictEqual(
        proc.stderr.output,
        "fit-test: error: something broke\n",
      );
      assert.strictEqual(proc.exitCode, 1);
    });
  });

  describe("usageError", () => {
    test("writes prefixed message to stderr and sets exitCode to 2", () => {
      const proc = createProc();
      const cli = createCli(proc);
      cli.usageError("bad argument");
      assert.strictEqual(proc.stderr.output, "fit-test: error: bad argument\n");
      assert.strictEqual(proc.exitCode, 2);
    });
  });
});

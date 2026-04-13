import { test, describe } from "node:test";
import assert from "node:assert";

import { HelpRenderer } from "../src/help.js";

function createStream() {
  return {
    output: "",
    write(data) {
      this.output += data;
    },
  };
}

const proc = { env: {}, stdout: { isTTY: false, write() {} } };

function createRenderer() {
  return new HelpRenderer({ process: proc });
}

const fullDefinition = {
  name: "fit-test",
  version: "1.0.0",
  description: "A test CLI",
  commands: [
    { name: "run", args: "<file>", description: "Run a file" },
    { name: "check", description: "Check syntax" },
  ],
  globalOptions: {
    output: { type: "string", description: "Output path" },
    verbose: { type: "boolean", short: "v", description: "Verbose output" },
    help: { type: "boolean", short: "h", description: "Show this help" },
  },
  examples: ["fit-test run main.js", "fit-test check --verbose"],
};

describe("HelpRenderer", () => {
  describe("render", () => {
    test("includes header line with name, version, description", () => {
      const stream = createStream();
      createRenderer().render(fullDefinition, stream);
      assert.ok(stream.output.includes("fit-test 1.0.0"));
      assert.ok(stream.output.includes("A test CLI"));
    });

    test("includes one-line-per-command with aligned descriptions", () => {
      const stream = createStream();
      createRenderer().render(fullDefinition, stream);
      assert.ok(stream.output.includes("run <file>"));
      assert.ok(stream.output.includes("Run a file"));
      assert.ok(stream.output.includes("check"));
      assert.ok(stream.output.includes("Check syntax"));
    });

    test("includes options with type hints and descriptions", () => {
      const stream = createStream();
      createRenderer().render(fullDefinition, stream);
      assert.ok(stream.output.includes("--output=<string>"));
      assert.ok(stream.output.includes("--verbose, -v"));
      assert.ok(stream.output.includes("--help, -h"));
    });

    test("includes examples section", () => {
      const stream = createStream();
      createRenderer().render(fullDefinition, stream);
      assert.ok(stream.output.includes("fit-test run main.js"));
      assert.ok(stream.output.includes("fit-test check --verbose"));
    });

    test("omits commands section when definition has no commands", () => {
      const stream = createStream();
      const def = {
        name: "fit-simple",
        globalOptions: {
          help: { type: "boolean", description: "Help" },
        },
      };
      createRenderer().render(def, stream);
      assert.ok(!stream.output.includes("Commands:"));
    });

    test("uses custom usage string when provided", () => {
      const stream = createStream();
      const def = { name: "fit-query", usage: "fit-query <s> <p> <o>" };
      createRenderer().render(def, stream);
      assert.ok(stream.output.includes("Usage: fit-query <s> <p> <o>"));
    });

    test("includes hint line when commands exist", () => {
      const stream = createStream();
      createRenderer().render(fullDefinition, stream);
      assert.ok(stream.output.includes("--help for command-specific options"));
    });

    test("omits hint line when no commands exist", () => {
      const stream = createStream();
      const def = {
        name: "fit-simple",
        globalOptions: {
          help: { type: "boolean", description: "Help" },
        },
      };
      createRenderer().render(def, stream);
      assert.ok(!stream.output.includes("--help for command-specific options"));
    });

    test("global help shows only globalOptions, not per-command options", () => {
      const stream = createStream();
      const def = {
        name: "fit-test",
        commands: [
          {
            name: "run",
            options: {
              watch: { type: "boolean", description: "Watch mode" },
            },
            description: "Run a file",
          },
        ],
        globalOptions: {
          help: { type: "boolean", short: "h", description: "Show help" },
        },
      };
      createRenderer().render(def, stream);
      assert.ok(!stream.output.includes("--watch"));
    });
  });

  describe("per-command help", () => {
    test("renders per-command help with command and global options", () => {
      const stream = createStream();
      const def = {
        name: "fit-test",
        commands: [
          {
            name: "run",
            args: "<file>",
            description: "Run a file",
            options: {
              watch: { type: "boolean", description: "Watch mode" },
            },
            examples: ["fit-test run main.js"],
          },
        ],
        globalOptions: {
          data: { type: "string", description: "Data path" },
          help: { type: "boolean", short: "h", description: "Show help" },
          version: {
            type: "boolean",
            short: "v",
            description: "Show version",
          },
        },
      };
      createRenderer().render(def, stream, def.commands[0]);
      assert.ok(stream.output.includes("fit-test run <file>"));
      assert.ok(stream.output.includes("Options:"));
      assert.ok(stream.output.includes("--watch"));
      assert.ok(stream.output.includes("Global options:"));
      assert.ok(stream.output.includes("--data"));
      assert.ok(!stream.output.includes("--version"));
      assert.ok(stream.output.includes("fit-test run main.js"));
    });

    test("omits Options section when command has no options", () => {
      const stream = createStream();
      const def = {
        name: "fit-test",
        commands: [{ name: "check", description: "Check syntax" }],
        globalOptions: {
          help: { type: "boolean", short: "h", description: "Show help" },
        },
      };
      createRenderer().render(def, stream, def.commands[0]);
      assert.ok(stream.output.includes("Global options:"));
      const lines = stream.output.split("\n");
      const optionLines = lines.filter((l) => l.trim() === "Options:");
      assert.strictEqual(optionLines.length, 0);
    });
  });

  describe("renderJson", () => {
    test("produces valid JSON matching the definition", () => {
      const stream = createStream();
      createRenderer().renderJson(fullDefinition, stream);
      const parsed = JSON.parse(stream.output);
      assert.strictEqual(parsed.name, "fit-test");
      assert.strictEqual(parsed.commands.length, 2);
      assert.strictEqual(parsed.commands[0].name, "run");
    });

    test("per-command JSON includes command metadata and scoped options", () => {
      const stream = createStream();
      const def = {
        name: "fit-test",
        commands: [
          {
            name: "run",
            args: "<file>",
            description: "Run a file",
            options: {
              watch: { type: "boolean", description: "Watch mode" },
            },
          },
        ],
        globalOptions: {
          data: { type: "string", description: "Data path" },
          version: {
            type: "boolean",
            short: "v",
            description: "Show version",
          },
        },
      };
      createRenderer().renderJson(def, stream, def.commands[0]);
      const parsed = JSON.parse(stream.output);
      assert.strictEqual(parsed.parent, "fit-test");
      assert.strictEqual(parsed.name, "run");
      assert.ok(parsed.options.watch);
      assert.ok(parsed.globalOptions.data);
      assert.ok(!parsed.globalOptions.version);
    });
  });
});

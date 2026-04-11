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
  options: {
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
        options: { help: { type: "boolean", description: "Help" } },
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
  });
});

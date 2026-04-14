import { describe, test } from "node:test";
import assert from "node:assert";
import { PassThrough } from "node:stream";

import {
  Supervisor,
  createSupervisor,
  SUPERVISOR_SYSTEM_PROMPT,
  AGENT_SYSTEM_PROMPT,
} from "@forwardimpact/libeval";
import {
  createOrchestrationContext,
  createConcludeHandler,
  createRedirectHandler,
} from "../src/orchestration-toolkit.js";
import { createMockRunner } from "./mock-runner.js";

function concludeMsg(summary) {
  return {
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          id: "conclude-1",
          name: "Conclude",
          input: { summary },
        },
      ],
    },
  };
}

function redirectMsg(message) {
  return {
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          id: "redirect-1",
          name: "Redirect",
          input: { message },
        },
      ],
    },
  };
}

describe("Supervisor - output and events", () => {
  test("output contains tagged lines with correct source and seq", async () => {
    const ctx = createOrchestrationContext();
    const concludeHandler = createConcludeHandler(ctx);

    const supervisorMessages = [
      [{ type: "assistant", content: "Go ahead" }],
      [concludeMsg("Done")],
    ];
    const agentMessages = [[{ type: "assistant", content: "Working" }]];

    const supervisorRunner = createMockRunner(
      [{ text: "Go ahead" }, { text: "Done" }],
      supervisorMessages,
      { toolDispatcher: { Conclude: (input) => concludeHandler(input) } },
    );
    const agentRunner = createMockRunner([{ text: "Working" }], agentMessages);

    const output = new PassThrough();
    const supervisor = new Supervisor({
      agentRunner,
      supervisorRunner,
      output,
      maxTurns: 10,
      ctx,
    });
    agentRunner.onLine = (line) => supervisor.emitLine(line);
    supervisorRunner.onLine = (line) => supervisor.emitLine(line);

    await supervisor.run("Task");

    const data = output.read()?.toString() ?? "";
    const lines = data
      .trim()
      .split("\n")
      .filter((l) => l.length > 0);

    assert.ok(lines.length >= 4);

    const supervisorLine = JSON.parse(lines[0]);
    assert.strictEqual(supervisorLine.source, "supervisor");
    assert.strictEqual(typeof supervisorLine.seq, "number");
    assert.ok("event" in supervisorLine);

    const agentLine = JSON.parse(lines[1]);
    assert.strictEqual(agentLine.source, "agent");
    assert.ok("event" in agentLine);

    // Verify seq is monotonically increasing
    const seqs = lines
      .map((l) => JSON.parse(l))
      .filter((l) => typeof l.seq === "number")
      .map((l) => l.seq);
    for (let i = 1; i < seqs.length; i++) {
      assert.ok(
        seqs[i] > seqs[i - 1],
        `seq ${seqs[i]} should be > ${seqs[i - 1]}`,
      );
    }

    const summaryLine = JSON.parse(lines[lines.length - 1]);
    assert.strictEqual(summaryLine.source, "orchestrator");
    assert.strictEqual(summaryLine.type, "summary");
    assert.strictEqual(summaryLine.success, true);
  });

  test("events are nested under event key (no field collisions)", async () => {
    const ctx = createOrchestrationContext();
    const concludeHandler = createConcludeHandler(ctx);

    const sourceEvent = {
      type: "assistant",
      source: "sdk-internal",
      content: "test",
    };
    const supervisorRunner = createMockRunner(
      [{ text: "Go" }, { text: "Done" }],
      [[{ type: "assistant", content: "Go" }], [concludeMsg("Complete")]],
      { toolDispatcher: { Conclude: (input) => concludeHandler(input) } },
    );
    const agentRunner = createMockRunner([{ text: "Done" }], [[sourceEvent]]);

    const output = new PassThrough();
    const supervisor = new Supervisor({
      agentRunner,
      supervisorRunner,
      output,
      maxTurns: 10,
      ctx,
    });
    agentRunner.onLine = (line) => supervisor.emitLine(line);
    supervisorRunner.onLine = (line) => supervisor.emitLine(line);

    await supervisor.run("Task");

    const data = output.read()?.toString() ?? "";
    const lines = data
      .trim()
      .split("\n")
      .filter((l) => l.length > 0);

    const tagged = JSON.parse(lines[1]);
    assert.strictEqual(tagged.source, "agent");
    assert.strictEqual(tagged.event.source, "sdk-internal");
  });

  test("mid-turn Redirect emits orchestrator events", async () => {
    const ctx = createOrchestrationContext();
    const concludeHandler = createConcludeHandler(ctx);
    const redirectHandler = createRedirectHandler(ctx);

    const agentMessages = [
      [
        {
          type: "assistant",
          message: {
            content: [{ type: "text", text: "Trying the wrong thing." }],
          },
        },
      ],
      [
        {
          type: "assistant",
          message: {
            content: [{ type: "text", text: "Switching to the right thing." }],
          },
        },
      ],
    ];

    const agentRunner = createMockRunner(
      [{ text: "Trying the wrong thing." }, { text: "Switching." }],
      agentMessages,
    );
    agentRunner.batchSize = 1;
    const supervisorRunner = createMockRunner(
      [
        { text: "Welcome." },
        { text: "Switch to the right path." },
        { text: "Keep going." },
        { text: "Done" },
      ],
      [
        undefined,
        [redirectMsg("Switch to the right path.")],
        undefined,
        [concludeMsg("Complete")],
      ],
      {
        toolDispatcher: {
          Conclude: (input) => concludeHandler(input),
          Redirect: (input) => redirectHandler(input),
        },
      },
    );

    const output = new PassThrough();
    const supervisor = new Supervisor({
      agentRunner,
      supervisorRunner,
      output,
      maxTurns: 10,
      ctx,
    });
    agentRunner.onLine = (line) => supervisor.emitLine(line);
    supervisorRunner.onLine = (line) => supervisor.emitLine(line);

    const result = await supervisor.run("Task");
    assert.strictEqual(result.success, true);

    const lines = (output.read()?.toString() ?? "")
      .trim()
      .split("\n")
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l));

    const interventionRequested = lines.find(
      (l) =>
        l.source === "orchestrator" &&
        l.event?.type === "intervention_requested",
    );
    assert.ok(
      interventionRequested,
      "Trace must contain intervention_requested orchestrator event",
    );

    const summary = lines[lines.length - 1];
    assert.strictEqual(summary.source, "orchestrator");
    assert.strictEqual(summary.type, "summary");
    assert.strictEqual(summary.success, true);
  });

  test("emits supervisor output and summary when supervisor errors on turn 0", async () => {
    const supervisorMessages = [
      [{ type: "assistant", content: "Starting..." }],
    ];
    const supervisorRunner = createMockRunner(
      [{ text: "Starting...", success: false }],
      supervisorMessages,
    );

    const origRun = supervisorRunner.run;
    supervisorRunner.run = async (task) => {
      const result = await origRun.call(supervisorRunner, task);
      return { ...result, error: new Error("Process exited with code 1") };
    };

    const agentRunner = createMockRunner([]);

    const output = new PassThrough();
    const supervisor = new Supervisor({
      agentRunner,
      supervisorRunner,
      output,
      maxTurns: 10,
    });
    agentRunner.onLine = (line) => supervisor.emitLine(line);
    supervisorRunner.onLine = (line) => supervisor.emitLine(line);

    const result = await supervisor.run("Task");

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.turns, 0);

    const data = output.read()?.toString() ?? "";
    const lines = data
      .trim()
      .split("\n")
      .filter((l) => l.length > 0);

    assert.ok(lines.length >= 2, "Expected at least supervisor line + summary");

    const supervisorLine = JSON.parse(lines[0]);
    assert.strictEqual(supervisorLine.source, "supervisor");
    assert.strictEqual(typeof supervisorLine.seq, "number");

    const summaryLine = JSON.parse(lines[lines.length - 1]);
    assert.strictEqual(summaryLine.source, "orchestrator");
    assert.strictEqual(summaryLine.success, false);
    assert.strictEqual(summaryLine.turns, 0);
  });

  test("summary includes Conclude payload", async () => {
    const ctx = createOrchestrationContext();
    const concludeHandler = createConcludeHandler(ctx);

    const supervisorRunner = createMockRunner(
      [{ text: "Done" }],
      [[concludeMsg("Agent passed all checks")]],
      { toolDispatcher: { Conclude: (input) => concludeHandler(input) } },
    );

    const agentRunner = createMockRunner([]);
    const output = new PassThrough();
    const supervisor = new Supervisor({
      agentRunner,
      supervisorRunner,
      output,
      maxTurns: 10,
      ctx,
    });

    await supervisor.run("Task");

    const data = output.read()?.toString() ?? "";
    const lines = data
      .trim()
      .split("\n")
      .filter((l) => l.length > 0);
    const summaryLine = JSON.parse(lines[lines.length - 1]);
    assert.strictEqual(summaryLine.summary, "Agent passed all checks");
  });
});

describe("Supervisor - createSupervisor factory", () => {
  test("createSupervisor factory returns a Supervisor instance", () => {
    const supervisor = createSupervisor({
      supervisorCwd: "/tmp/sup",
      agentCwd: "/tmp/agent",
      query: async function* () {},
      output: new PassThrough(),
    });
    assert.ok(supervisor instanceof Supervisor);
  });

  test("createSupervisor uses default supervisor tools when none specified", () => {
    const supervisor = createSupervisor({
      supervisorCwd: "/tmp/sup",
      agentCwd: "/tmp/agent",
      query: async function* () {},
      output: new PassThrough(),
    });
    assert.deepStrictEqual(supervisor.supervisorRunner.allowedTools, [
      "Bash",
      "Read",
      "Glob",
      "Grep",
      "Write",
      "Edit",
    ]);
  });

  test("createSupervisor passes custom supervisor tools", () => {
    const supervisor = createSupervisor({
      supervisorCwd: "/tmp/sup",
      agentCwd: "/tmp/agent",
      query: async function* () {},
      output: new PassThrough(),
      supervisorAllowedTools: ["Read", "Glob", "Grep"],
    });
    assert.deepStrictEqual(supervisor.supervisorRunner.allowedTools, [
      "Read",
      "Glob",
      "Grep",
    ]);
  });

  test("createSupervisor wires system prompts to both runners", () => {
    const supervisor = createSupervisor({
      supervisorCwd: "/tmp/sup",
      agentCwd: "/tmp/agent",
      query: async function* () {},
      output: new PassThrough(),
    });

    assert.deepStrictEqual(supervisor.agentRunner.systemPrompt, {
      type: "preset",
      preset: "claude_code",
      append: AGENT_SYSTEM_PROMPT,
    });
    assert.deepStrictEqual(supervisor.supervisorRunner.systemPrompt, {
      type: "preset",
      preset: "claude_code",
      append: SUPERVISOR_SYSTEM_PROMPT,
    });
  });

  test("createSupervisor blocks sub-agent spawn tools on supervisor by default", () => {
    const supervisor = createSupervisor({
      supervisorCwd: "/tmp/sup",
      agentCwd: "/tmp/agent",
      query: async function* () {},
      output: new PassThrough(),
    });
    assert.deepStrictEqual(supervisor.supervisorRunner.disallowedTools, [
      "Agent",
      "Task",
      "TaskOutput",
      "TaskStop",
    ]);
    assert.deepStrictEqual(supervisor.agentRunner.disallowedTools, []);
  });

  test("createSupervisor merges custom supervisorDisallowedTools with defaults", () => {
    const supervisor = createSupervisor({
      supervisorCwd: "/tmp/sup",
      agentCwd: "/tmp/agent",
      query: async function* () {},
      output: new PassThrough(),
      supervisorDisallowedTools: ["WebSearch", "Task"],
    });
    const disallowed = supervisor.supervisorRunner.disallowedTools;
    assert.ok(disallowed.includes("Agent"));
    assert.ok(disallowed.includes("Task"));
    assert.ok(disallowed.includes("TaskOutput"));
    assert.ok(disallowed.includes("TaskStop"));
    assert.ok(disallowed.includes("WebSearch"));
    assert.strictEqual(disallowed.length, new Set(disallowed).size);
  });

  test("system prompt constants are non-empty strings", () => {
    assert.ok(typeof SUPERVISOR_SYSTEM_PROMPT === "string");
    assert.ok(typeof AGENT_SYSTEM_PROMPT === "string");
    assert.ok(SUPERVISOR_SYSTEM_PROMPT.length > 0);
    assert.ok(AGENT_SYSTEM_PROMPT.length > 0);
  });

  test("SUPERVISOR_SYSTEM_PROMPT describes tools, not text tokens", () => {
    assert.ok(SUPERVISOR_SYSTEM_PROMPT.includes("Conclude"));
    assert.ok(SUPERVISOR_SYSTEM_PROMPT.includes("Redirect"));
    assert.ok(!SUPERVISOR_SYSTEM_PROMPT.includes("EVALUATION_COMPLETE"));
    assert.ok(!SUPERVISOR_SYSTEM_PROMPT.includes("EVALUATION_INTERVENTION"));
  });

  test("createSupervisor wires MCP servers to both runners", () => {
    const supervisor = createSupervisor({
      supervisorCwd: "/tmp/sup",
      agentCwd: "/tmp/agent",
      query: async function* () {},
      output: new PassThrough(),
    });
    assert.ok(supervisor.agentRunner.mcpServers);
    assert.strictEqual(
      supervisor.agentRunner.mcpServers.orchestration.type,
      "sdk",
    );
    assert.ok(supervisor.supervisorRunner.mcpServers);
    assert.strictEqual(
      supervisor.supervisorRunner.mcpServers.orchestration.type,
      "sdk",
    );
  });
});

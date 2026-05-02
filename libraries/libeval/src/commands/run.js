import { readFileSync, createWriteStream } from "node:fs";
import { Writable } from "node:stream";
import { resolve } from "node:path";
import { createAgentRunner } from "../agent-runner.js";
import { composeProfilePrompt } from "../profile-prompt.js";
import { createTeeWriter } from "../tee-writer.js";
import { SequenceCounter } from "../sequence-counter.js";

/**
 * Parse and validate run command options from parsed values.
 * @param {object} values - Parsed option values from cli.parse()
 * @returns {{ taskContent: string, cwd: string, model: string, maxTurns: number, outputPath: string|undefined, agentProfile: string|undefined, allowedTools: string[] }}
 */
function parseRunOptions(values) {
  const taskFile = values["task-file"];
  const taskText = values["task-text"];
  if (taskFile && taskText)
    throw new Error("--task-file and --task-text are mutually exclusive");
  if (!taskFile && !taskText)
    throw new Error("--task-file or --task-text is required");

  const maxTurnsRaw = values["max-turns"] ?? "50";
  const taskAmend = values["task-amend"] ?? undefined;
  const taskContent = taskFile ? readFileSync(taskFile, "utf8") : taskText;

  return {
    taskContent,
    taskAmend,
    cwd: resolve(values.cwd ?? "."),
    model: values.model ?? "claude-opus-4-7[1m]",
    maxTurns: maxTurnsRaw === "0" ? 0 : parseInt(maxTurnsRaw, 10),
    outputPath: values.output,
    agentProfile: values["agent-profile"] ?? undefined,
    allowedTools: (
      values["allowed-tools"] ??
      "Bash,Read,Glob,Grep,Write,Edit,Agent,TodoWrite"
    ).split(","),
  };
}

/**
 * Run command — execute a single agent via the Claude Agent SDK.
 *
 * Usage: fit-eval run [options]
 *
 * @param {object} values - Parsed option values from cli.parse()
 * @param {string[]} args - Positional arguments
 */
export async function runRunCommand(values, _args) {
  const {
    taskContent,
    taskAmend,
    cwd,
    model,
    maxTurns,
    outputPath,
    agentProfile,
    allowedTools,
  } = parseRunOptions(values);

  // When --output is specified, stream text to stdout while writing NDJSON to file.
  // Otherwise, write NDJSON directly to stdout (backwards-compatible).
  const fileStream = outputPath ? createWriteStream(outputPath) : null;
  const output = fileStream
    ? createTeeWriter({ fileStream, textStream: process.stdout, mode: "raw" })
    : process.stdout;

  const counter = new SequenceCounter();
  const devNull = new Writable({
    write(_chunk, _enc, cb) {
      cb();
    },
  });
  const onLine = (line) => {
    const event = JSON.parse(line);
    output.write(
      JSON.stringify({ source: "agent", seq: counter.next(), event }) + "\n",
    );
  };

  if (agentProfile) {
    process.env.LIBEVAL_AGENT_PROFILE = agentProfile;
  }

  const systemPrompt = agentProfile
    ? composeProfilePrompt(agentProfile, {
        profilesDir: resolve(cwd, ".claude/agents"),
      })
    : undefined;

  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const runner = createAgentRunner({
    cwd,
    query,
    output: devNull,
    model,
    maxTurns,
    allowedTools,
    onLine,
    settingSources: ["project"],
    systemPrompt,
    taskAmend,
  });

  const result = await runner.run(taskContent);

  if (fileStream) {
    await new Promise((r) => output.end(r));
    await new Promise((r) => fileStream.end(r));
  }

  process.exit(result.success ? 0 : 1);
}

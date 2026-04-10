import { readFileSync, createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { createAgentRunner } from "../agent-runner.js";
import { createTeeWriter } from "../tee-writer.js";

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
  let taskContent = taskFile ? readFileSync(taskFile, "utf8") : taskText;
  if (taskAmend) taskContent += `\n\n${taskAmend}`;

  return {
    taskContent,
    cwd: resolve(values.cwd ?? "."),
    model: values.model ?? "opus",
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

  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const runner = createAgentRunner({
    cwd,
    query,
    output,
    model,
    maxTurns,
    allowedTools,
    settingSources: ["project"],
    agentProfile,
  });

  const result = await runner.run(taskContent);

  if (fileStream) {
    await new Promise((r) => output.end(r));
    await new Promise((r) => fileStream.end(r));
  }

  process.exit(result.success ? 0 : 1);
}

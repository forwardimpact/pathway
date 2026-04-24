import { readFileSync, createWriteStream, mkdtempSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { createSupervisor } from "../supervisor.js";
import { createTeeWriter } from "../tee-writer.js";

/**
 * Parse all supervise flags from parsed values into an options object.
 * @param {object} values - Parsed option values from cli.parse()
 * @returns {object}
 */
function parseSuperviseOptions(values) {
  const taskFile = values["task-file"];
  const taskText = values["task-text"];
  if (taskFile && taskText)
    throw new Error("--task-file and --task-text are mutually exclusive");
  if (!taskFile && !taskText)
    throw new Error("--task-file or --task-text is required");

  const supervisorAllowedToolsRaw = values["supervisor-allowed-tools"];

  const taskAmend = values["task-amend"] ?? undefined;
  const taskContent = taskFile ? readFileSync(taskFile, "utf8") : taskText;

  return {
    taskContent,
    taskAmend,
    supervisorCwd: resolve(values["supervisor-cwd"] ?? "."),
    agentCwd: resolve(
      values["agent-cwd"] ?? mkdtempSync(join(tmpdir(), "fit-eval-agent-")),
    ),
    model: values.model ?? "claude-opus-4-7[1m]",
    maxTurns: (() => {
      const raw = values["max-turns"] ?? "20";
      return raw === "0" ? 0 : parseInt(raw, 10);
    })(),
    outputPath: values.output,
    supervisorProfile: values["supervisor-profile"] ?? undefined,
    agentProfile: values["agent-profile"] ?? undefined,
    allowedTools: (
      values["allowed-tools"] ??
      "Bash,Read,Glob,Grep,Write,Edit,Agent,TodoWrite"
    ).split(","),
    supervisorAllowedTools: supervisorAllowedToolsRaw
      ? supervisorAllowedToolsRaw.split(",")
      : undefined,
  };
}

/**
 * Supervise command — run two agents in a relay loop via the Claude Agent SDK.
 *
 * Usage: fit-eval supervise [options]
 *
 * @param {object} values - Parsed option values from cli.parse()
 * @param {string[]} args - Positional arguments
 */
export async function runSuperviseCommand(values, _args) {
  const opts = parseSuperviseOptions(values);

  // When --output is specified, stream text to stdout while writing NDJSON to file.
  // Otherwise, write NDJSON directly to stdout (backwards-compatible).
  const fileStream = opts.outputPath
    ? createWriteStream(opts.outputPath)
    : null;
  const output = fileStream
    ? createTeeWriter({
        fileStream,
        textStream: process.stdout,
        mode: "supervised",
      })
    : process.stdout;

  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const supervisor = createSupervisor({
    supervisorCwd: opts.supervisorCwd,
    agentCwd: opts.agentCwd,
    query,
    output,
    model: opts.model,
    maxTurns: opts.maxTurns,
    allowedTools: opts.allowedTools,
    supervisorAllowedTools: opts.supervisorAllowedTools,
    supervisorProfile: opts.supervisorProfile,
    agentProfile: opts.agentProfile,
    taskAmend: opts.taskAmend,
  });

  const result = await supervisor.run(opts.taskContent);

  if (fileStream) {
    await new Promise((r) => output.end(r));
    await new Promise((r) => fileStream.end(r));
  }

  process.exit(result.success ? 0 : 1);
}

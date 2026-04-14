import { readFileSync, createWriteStream, mkdtempSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { createFacilitator } from "../facilitator.js";
import { createTeeWriter } from "../tee-writer.js";

/**
 * Parse agent config string into structured configs.
 * Format: "name1:key=val:key=val,name2:key=val"
 * @param {string} raw
 * @returns {Array<{name: string, role: string, cwd: string, maxTurns?: number}>}
 */
function parseAgentConfigs(raw) {
  return raw.split(",").map((spec) => {
    const parts = spec.split(":");
    const name = parts[0];
    const config = { name, role: name };
    for (let i = 1; i < parts.length; i++) {
      const [key, val] = parts[i].split("=");
      if (key === "cwd") config.cwd = resolve(val);
      else if (key === "role") config.role = val;
      else if (key === "maxTurns") config.maxTurns = parseInt(val, 10);
    }
    if (!config.cwd) {
      config.cwd = mkdtempSync(join(tmpdir(), `fit-eval-${name}-`));
    }
    return config;
  });
}

/**
 * Parse and validate facilitate command options.
 * @param {object} values - Parsed option values
 * @returns {object} Parsed options
 */
function parseFacilitateOptions(values) {
  const taskFile = values["task-file"];
  const taskText = values["task-text"];
  if (taskFile && taskText)
    throw new Error("--task-file and --task-text are mutually exclusive");
  if (!taskFile && !taskText)
    throw new Error("--task-file or --task-text is required");

  const taskAmend = values["task-amend"] ?? undefined;
  let taskContent = taskFile ? readFileSync(taskFile, "utf8") : taskText;
  if (taskAmend) taskContent += `\n\n${taskAmend}`;

  const agentsRaw = values.agents;
  if (!agentsRaw) throw new Error("--agents is required");

  const agentConfigs = parseAgentConfigs(agentsRaw);
  if (agentConfigs.length < 2)
    throw new Error("--agents must specify at least two agents");

  const maxTurnsRaw = values["max-turns"] ?? "20";

  return {
    taskContent,
    agentConfigs,
    facilitatorCwd: resolve(values["facilitator-cwd"] ?? "."),
    model: values.model ?? "opus",
    maxTurns: maxTurnsRaw === "0" ? 0 : parseInt(maxTurnsRaw, 10),
    outputPath: values.output,
    facilitatorProfile: values["facilitator-profile"] ?? undefined,
  };
}

/**
 * Facilitate command — run a facilitated multi-agent session.
 *
 * Usage: fit-eval facilitate [options]
 *
 * @param {object} values - Parsed option values from cli.parse()
 * @param {string[]} _args - Positional arguments
 */
export async function runFacilitateCommand(values, _args) {
  const opts = parseFacilitateOptions(values);

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
  const facilitator = createFacilitator({
    facilitatorCwd: opts.facilitatorCwd,
    agentConfigs: opts.agentConfigs,
    query,
    output,
    model: opts.model,
    maxTurns: opts.maxTurns,
    facilitatorProfile: opts.facilitatorProfile,
  });

  const result = await facilitator.run(opts.taskContent);

  if (fileStream) {
    await new Promise((r) => output.end(r));
    await new Promise((r) => fileStream.end(r));
  }

  process.exit(result.success ? 0 : 1);
}

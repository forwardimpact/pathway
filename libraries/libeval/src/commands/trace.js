import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTraceCollector } from "@forwardimpact/libeval";
import { createTraceQuery } from "../trace-query.js";
import { createTraceGitHub } from "../trace-github.js";

// --- GitHub commands ---

/**
 * List recent workflow runs matching a pattern.
 * @param {object} values - Parsed option values
 * @param {string[]} args - [pattern?]
 */
export async function runRunsCommand(values, args) {
  const gh = await createTraceGitHub({ repo: values.repo });
  const pattern = args[0] ?? "agent";
  const lookback = values.lookback ?? "7d";
  const runs = await gh.listRuns({ pattern, lookback });
  writeJSON(runs);
}

/**
 * Download a trace artifact and auto-convert to structured JSON.
 * @param {object} values - Parsed option values
 * @param {string[]} args - [run-id]
 */
export async function runDownloadCommand(values, args) {
  const gh = await createTraceGitHub({ repo: values.repo });
  const result = await gh.downloadTrace(args[0], {
    dir: values.dir,
    name: values.artifact,
  });

  const ndjsonFile = result.files.find((f) => f.endsWith(".ndjson"));
  if (ndjsonFile) {
    const ndjsonPath = join(result.dir, ndjsonFile);
    const collector = createTraceCollector();
    for (const line of readFileSync(ndjsonPath, "utf8").split("\n")) {
      collector.addLine(line);
    }
    const structuredPath = join(result.dir, "structured.json");
    writeFileSync(structuredPath, JSON.stringify(collector.toJSON()) + "\n");
    result.files.push("structured.json");
  }

  writeJSON(result);
}

// --- Query commands ---

/** @param {object} values @param {string[]} args - [file] */
export async function runOverviewCommand(values, args) {
  writeJSON(loadTrace(args[0]).overview());
}

/** @param {object} values @param {string[]} args - [file] */
export async function runCountCommand(values, args) {
  process.stdout.write(String(loadTrace(args[0]).count()) + "\n");
}

/** @param {object} values @param {string[]} args - [file, from, to] */
export async function runBatchCommand(values, args) {
  writeJSON(
    loadTrace(args[0]).batch(parseInt(args[1], 10), parseInt(args[2], 10)),
  );
}

/** @param {object} values @param {string[]} args - [file, N?] */
export async function runHeadCommand(values, args) {
  const n = args[1] ? parseInt(args[1], 10) : 10;
  writeJSON(loadTrace(args[0]).head(n));
}

/** @param {object} values @param {string[]} args - [file, N?] */
export async function runTailCommand(values, args) {
  const n = args[1] ? parseInt(args[1], 10) : 10;
  writeJSON(loadTrace(args[0]).tail(n));
}

/** @param {object} values @param {string[]} args - [file, pattern] */
export async function runSearchCommand(values, args) {
  const limit = values.limit ? parseInt(values.limit, 10) : 50;
  const context = values.context ? parseInt(values.context, 10) : 0;
  writeJSON(loadTrace(args[0]).search(args[1], { limit, context }));
}

/** @param {object} values @param {string[]} args - [file] */
export async function runToolsCommand(values, args) {
  writeJSON(loadTrace(args[0]).toolFrequency());
}

/** @param {object} values @param {string[]} args - [file, name] */
export async function runToolCommand(values, args) {
  writeJSON(loadTrace(args[0]).tool(args[1]));
}

/** @param {object} values @param {string[]} args - [file] */
export async function runErrorsCommand(values, args) {
  writeJSON(loadTrace(args[0]).errors());
}

/** @param {object} values @param {string[]} args - [file] */
export async function runReasoningCommand(values, args) {
  const from = values.from ? parseInt(values.from, 10) : undefined;
  const to = values.to ? parseInt(values.to, 10) : undefined;
  writeJSON(loadTrace(args[0]).reasoning({ from, to }));
}

/** @param {object} values @param {string[]} args - [file] */
export async function runTimelineCommand(values, args) {
  const lines = loadTrace(args[0]).timeline();
  process.stdout.write(lines.join("\n") + "\n");
}

/** @param {object} values @param {string[]} args - [file] */
export async function runStatsCommand(values, args) {
  writeJSON(loadTrace(args[0]).stats());
}

// --- Shared helpers ---

/**
 * Load a trace file. Supports structured JSON and raw NDJSON.
 * @param {string} file
 * @returns {import("../trace-query.js").TraceQuery}
 */
function loadTrace(file) {
  const content = readFileSync(file, "utf8");

  try {
    const parsed = JSON.parse(content);
    if (parsed.turns) {
      return createTraceQuery(parsed);
    }
  } catch {
    // Not valid JSON — fall through to NDJSON.
  }

  const collector = createTraceCollector();
  for (const line of content.split("\n")) {
    collector.addLine(line);
  }
  return createTraceQuery(collector.toJSON());
}

/** @param {object} data */
function writeJSON(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

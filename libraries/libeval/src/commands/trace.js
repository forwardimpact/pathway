import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createTraceCollector } from "@forwardimpact/libeval";
import { createTraceQuery } from "../trace-query.js";
import { createTraceGitHub } from "../trace-github.js";
import { stripSignatures } from "../signature-filter.js";

// --- GitHub commands ---

/**
 * List recent workflow runs matching a pattern.
 * @param {object} values - Parsed option values
 * @param {string[]} args - [pattern?]
 * @param {{config: import("@forwardimpact/libconfig").Config}} ctx
 */
export async function runRunsCommand(values, args, ctx) {
  const gh = await createTraceGitHub({
    token: ctx.config.ghToken(),
    repo: values.repo,
  });
  const pattern = args[0] ?? "agent";
  const lookback = values.lookback ?? "7d";
  const runs = await gh.listRuns({ pattern, lookback });
  writeJSON(runs, values);
}

/**
 * Download a trace artifact and auto-convert to structured JSON.
 * @param {object} values - Parsed option values
 * @param {string[]} args - [run-id]
 * @param {{config: import("@forwardimpact/libconfig").Config}} ctx
 */
export async function runDownloadCommand(values, args, ctx) {
  const gh = await createTraceGitHub({
    token: ctx.config.ghToken(),
    repo: values.repo,
  });
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

  writeJSON(result, values);
}

// --- Query commands ---

/** @param {object} values @param {string[]} args - [file] */
export async function runOverviewCommand(values, args) {
  writeJSON(loadTrace(args[0]).overview(), values);
}

/** @param {object} values @param {string[]} args - [file] */
export async function runCountCommand(values, args) {
  process.stdout.write(String(loadTrace(args[0]).count()) + "\n");
}

/** @param {object} values @param {string[]} args - [file, from, to] */
export async function runBatchCommand(values, args) {
  writeJSON(
    loadTrace(args[0]).batch(parseInt(args[1], 10), parseInt(args[2], 10)),
    values,
  );
}

/** @param {object} values @param {string[]} args - [file, N?] */
export async function runHeadCommand(values, args) {
  const n = args[1] ? parseInt(args[1], 10) : 10;
  writeJSON(loadTrace(args[0]).head(n), values);
}

/** @param {object} values @param {string[]} args - [file, N?] */
export async function runTailCommand(values, args) {
  const n = args[1] ? parseInt(args[1], 10) : 10;
  writeJSON(loadTrace(args[0]).tail(n), values);
}

/** @param {object} values @param {string[]} args - [file, pattern] */
export async function runSearchCommand(values, args) {
  const limit = values.limit ? parseInt(values.limit, 10) : 50;
  const context = values.context ? parseInt(values.context, 10) : 0;
  const full = values.full ?? false;
  writeJSON(
    loadTrace(args[0]).search(args[1], { limit, context, full }),
    values,
  );
}

/** @param {object} values @param {string[]} args - [file] */
export async function runToolsCommand(values, args) {
  writeJSON(loadTrace(args[0]).toolFrequency(), values);
}

/** @param {object} values @param {string[]} args - [file, name] */
export async function runToolCommand(values, args) {
  writeJSON(loadTrace(args[0]).tool(args[1]), values);
}

/** @param {object} values @param {string[]} args - [file] */
export async function runErrorsCommand(values, args) {
  writeJSON(loadTrace(args[0]).errors(), values);
}

/** @param {object} values @param {string[]} args - [file] */
export async function runReasoningCommand(values, args) {
  const from = values.from ? parseInt(values.from, 10) : undefined;
  const to = values.to ? parseInt(values.to, 10) : undefined;
  writeJSON(loadTrace(args[0]).reasoning({ from, to }), values);
}

/** @param {object} values @param {string[]} args - [file] */
export async function runTimelineCommand(values, args) {
  const lines = loadTrace(args[0]).timeline();
  process.stdout.write(lines.join("\n") + "\n");
}

/** @param {object} values @param {string[]} args - [file] */
export async function runStatsCommand(values, args) {
  writeJSON(loadTrace(args[0]).stats(), values);
}

/** @param {object} values @param {string[]} args - [file] */
export async function runInitCommand(values, args) {
  writeJSON(loadTrace(args[0]).init(), values);
}

/** @param {object} values @param {string[]} args - [file, index] */
export async function runTurnCommand(values, args) {
  writeJSON(loadTrace(args[0]).turn(parseInt(args[1], 10)), values);
}

/** @param {object} values @param {string[]} args - [file] */
export async function runFilterCommand(values, args) {
  const opts = {};
  if (values.role) opts.role = values.role;
  if (values.tool) opts.toolName = values.tool;
  if (values.error) opts.isError = true;
  writeJSON(loadTrace(args[0]).filter(opts), values);
}

// --- Split command ---

/** Valid agent source name pattern: lowercase letter, then lowercase alphanumeric or hyphen */
const VALID_SOURCE_NAME = /^[a-z][a-z0-9-]*$/;

/**
 * Split a combined NDJSON trace into per-source files.
 * @param {object} values - Parsed option values
 * @param {string[]} args - [file]
 */
export async function runSplitCommand(values, args) {
  const file = args[0];
  if (!file) throw new Error("split: missing input file");

  const mode = values.mode;
  if (!mode) throw new Error("split: --mode is required");

  if (mode === "run") {
    process.stdout.write(
      "run mode: trace is already in final form, no split needed\n",
    );
    return;
  }

  const outputDir = values["output-dir"] || dirname(file);
  mkdirSync(outputDir, { recursive: true });

  const buckets = parseBuckets(readFileSync(file, "utf8"));

  if (mode === "supervise") {
    writeBucket(buckets, "agent", outputDir);
    writeBucket(buckets, "supervisor", outputDir);
  } else if (mode === "facilitate") {
    splitFacilitated(buckets, outputDir);
  }
}

/**
 * Parse NDJSON content into per-source buckets of unwrapped event lines.
 * Skips empty lines, malformed JSON, non-envelope lines, and orchestrator events.
 * @param {string} content - Raw NDJSON file content
 * @returns {Map<string, string[]>} source name -> array of unwrapped JSON lines
 */
function parseBuckets(content) {
  const buckets = new Map();

  for (const raw of content.split("\n")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    let envelope;
    try {
      envelope = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (!envelope.event || typeof envelope.source !== "string") continue;
    if (envelope.source === "orchestrator") continue;

    if (!buckets.has(envelope.source)) {
      buckets.set(envelope.source, []);
    }
    buckets.get(envelope.source).push(JSON.stringify(envelope.event));
  }

  return buckets;
}

/**
 * Write facilitated mode split: facilitator, per-agent, and combined agent files.
 * @param {Map<string, string[]>} buckets
 * @param {string} outputDir
 */
function splitFacilitated(buckets, outputDir) {
  writeBucket(buckets, "facilitator", outputDir);

  const agentSources = [...buckets.keys()].filter(
    (s) => s !== "facilitator" && VALID_SOURCE_NAME.test(s),
  );

  for (const name of agentSources) {
    writeBucket(buckets, name, outputDir);
  }

  const combinedLines = agentSources.flatMap((n) => buckets.get(n) ?? []);
  if (combinedLines.length > 0) {
    writeFileSync(
      join(outputDir, "trace-agent.ndjson"),
      combinedLines.join("\n") + "\n",
    );
  }
}

/**
 * Write a single source bucket to a trace-{name}.ndjson file.
 * @param {Map<string, string[]>} buckets
 * @param {string} name
 * @param {string} outputDir
 */
function writeBucket(buckets, name, outputDir) {
  const lines = buckets.get(name);
  if (!lines || lines.length === 0) return;
  const outPath = join(outputDir, `trace-${name}.ndjson`);
  writeFileSync(outPath, lines.join("\n") + "\n");
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

/**
 * Write JSON output to stdout. By default strips `thinking.signature`
 * base64 blobs from the payload so they don't dominate terminal output;
 * pass `--signatures` (surfaced as `values.signatures`) to keep them.
 * @param {*} data
 * @param {object} [values]
 */
function writeJSON(data, values = {}) {
  const output = values.signatures ? data : stripSignatures(data);
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}

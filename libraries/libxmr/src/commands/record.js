import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import fsAsync from "node:fs/promises";
import path from "node:path";
import { Finder } from "@forwardimpact/libutil";
import { analyze } from "../analyze.js";
import { EXPECTED_HEADER } from "../constants.js";

const csvField = (v) => {
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

function parseRecordOptions(values, cli) {
  const skill = values.skill || process.env.LIBEVAL_SKILL;
  if (!skill) {
    cli.usageError("record requires --skill <name> or LIBEVAL_SKILL env var");
    process.exit(2);
  }

  if (!values.metric) {
    cli.usageError("record requires --metric <name>");
    process.exit(2);
  }

  if (values.value === undefined || values.value === null) {
    cli.usageError("record requires --value <number>");
    process.exit(2);
  }

  return {
    skill,
    metric: values.metric,
    numValue: Number(values.value),
    date: values.date || new Date().toISOString().slice(0, 10),
    unit: values.unit || "count",
    run: values.run || "",
    note: values.note || "",
    wikiRootOverride: values["wiki-root"],
  };
}

function printSummary(csvPath, metric) {
  try {
    const text = readFileSync(csvPath, "utf-8");
    const report = analyze(text);
    const m = report.metrics.find((r) => r.metric === metric);

    if (m) {
      const latest = m.latest ? m.latest.value : m.values[m.values.length - 1];
      process.stdout.write(
        `metric=${m.metric} n=${m.n} status=${m.status} latest=${latest}\n`,
      );
    }
  } catch (err) {
    process.stderr.write(`warning: analyze failed: ${err.message}\n`);
  }
}

/** Append a metric data point to `wiki/metrics/<skill>/<year>.csv` (creating the directory and header if absent) and print a one-line XmR status summary for the recorded metric. */
export function runRecordCommand(values, _args, cli) {
  const opts = parseRecordOptions(values, cli);

  const logger = { debug() {} };
  const finder = new Finder(fsAsync, logger, process);
  const projectRoot = finder.findProjectRoot(process.cwd());

  const wikiRoot = opts.wikiRootOverride || path.join(projectRoot, "wiki");
  const year = opts.date.slice(0, 4);
  const csvDir = path.join(wikiRoot, "metrics", opts.skill);
  const csvPath = path.join(csvDir, `${year}.csv`);

  if (!existsSync(csvDir)) {
    mkdirSync(csvDir, { recursive: true });
  }

  if (!existsSync(csvPath)) {
    writeFileSync(csvPath, EXPECTED_HEADER + "\n");
  }

  const row = [
    opts.date,
    opts.metric,
    opts.numValue,
    opts.unit,
    opts.run,
    opts.note,
  ]
    .map(csvField)
    .join(",");
  writeFileSync(csvPath, readFileSync(csvPath, "utf-8") + row + "\n");

  printSummary(csvPath, opts.metric);
}

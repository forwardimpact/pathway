import { existsSync, readFileSync } from "node:fs";

import { analyze } from "../analyze.js";
import { renderChart } from "../chart.js";
import { MIN_POINTS } from "../constants.js";

export function runChartCommand(values, args, cli) {
  const csvPath = args[0];
  if (!csvPath) {
    cli.usageError("chart requires a <csv-path> argument");
    process.exit(2);
  }
  if (values.format === "json") {
    cli.usageError("chart does not support --format json");
    process.exit(2);
  }
  if (!existsSync(csvPath)) {
    cli.usageError(`cannot read CSV "${csvPath}": file not found`);
    process.exit(2);
  }

  const text = readFileSync(csvPath, "utf-8");
  const report = analyze(text);

  if (report.metrics.length === 0) {
    cli.usageError(`no metrics found in "${csvPath}"`);
    process.exit(2);
  }

  // If --metric is given, pick that one. If not given but the CSV carries
  // exactly one metric, use it implicitly — the user couldn't have meant
  // anything else.
  let target;
  if (values.metric) {
    target = report.metrics.find((m) => m.metric === values.metric);
    if (!target) {
      cli.usageError(`no rows for metric "${values.metric}"`);
      process.exit(2);
    }
  } else if (report.metrics.length === 1) {
    target = report.metrics[0];
  } else {
    const names = report.metrics.map((m) => m.metric).join(", ");
    cli.usageError(
      `chart requires --metric when CSV has multiple metrics (found: ${names})`,
    );
    process.exit(2);
  }

  if (target.status === "insufficient_data") {
    process.stdout.write(
      `Insufficient data: ${target.n} points (need at least ${MIN_POINTS}).\n`,
    );
    return;
  }

  const chart = renderChart(target.values, target.stats, target.signals, {
    ascii: !!values.ascii,
  });
  process.stdout.write(chart + "\n");
}

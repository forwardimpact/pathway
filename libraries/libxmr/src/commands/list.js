import { existsSync, readFileSync } from "node:fs";
import { formatHeader, formatTable } from "@forwardimpact/libcli";

import { listMetrics } from "../xmr.js";

export function runListCommand(values, args, cli) {
  const csvPath = args[0];
  if (!csvPath) {
    cli.usageError("list requires a <csv-path> argument");
    process.exit(2);
  }
  if (!existsSync(csvPath)) {
    cli.usageError(`cannot read CSV "${csvPath}": file not found`);
    process.exit(2);
  }

  const text = readFileSync(csvPath, "utf-8");
  const metrics = listMetrics(text);

  if (values.format === "json") {
    process.stdout.write(
      JSON.stringify({ source: csvPath, metrics }, null, 2) + "\n",
    );
  } else {
    const header = formatHeader(`Metrics — ${csvPath}`);
    const rows = metrics.map((m) => [
      m.metric,
      m.unit,
      String(m.n),
      m.from,
      m.to,
    ]);
    const table = formatTable(["Metric", "Unit", "Points", "From", "To"], rows);
    process.stdout.write(header + "\n\n" + table + "\n");
  }
}

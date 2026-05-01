import { existsSync, readFileSync } from "node:fs";

import { parseCSV, sparkline } from "../xmr.js";

export function runSparkCommand(values, args, cli) {
  const csvPath = args[0];
  if (!csvPath) {
    cli.usageError("spark requires a <csv-path> argument");
    process.exit(2);
  }
  if (!values.metric) {
    cli.usageError("spark requires --metric");
    process.exit(2);
  }
  if (!existsSync(csvPath)) {
    cli.usageError(`cannot read CSV "${csvPath}": file not found`);
    process.exit(2);
  }

  const text = readFileSync(csvPath, "utf-8");
  const rows = parseCSV(text).filter((r) => r.metric === values.metric);

  if (rows.length === 0) {
    process.stdout.write("            \n");
    return;
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));
  process.stdout.write(sparkline(rows.map((r) => r.value)) + "\n");
}

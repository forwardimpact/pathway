import { existsSync, readFileSync } from "node:fs";
import {
  formatHeader,
  formatSuccess,
  formatError,
  formatBullet,
} from "@forwardimpact/libcli";

import { validateCSV } from "../xmr.js";

export function runValidateCommand(values, args, cli) {
  const csvPath = args[0];
  if (!csvPath) {
    cli.usageError("validate requires a <csv-path> argument");
    process.exit(2);
  }
  if (!existsSync(csvPath)) {
    cli.usageError(`cannot read CSV "${csvPath}": file not found`);
    process.exit(2);
  }

  const text = readFileSync(csvPath, "utf-8");
  const result = validateCSV(text);
  result.source = csvPath;

  if (values.format === "json") {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    const parts = [formatHeader(`Validate — ${csvPath}`)];
    parts.push(`Rows: ${result.rows}`);

    if (result.valid) {
      parts.push(formatSuccess("Valid"));
    } else {
      parts.push(formatError(`${result.errors.length} error(s)`));
      for (const e of result.errors) {
        const loc = e.field ? `line ${e.line} [${e.field}]` : `line ${e.line}`;
        parts.push(formatBullet(`${loc}: ${e.message}`));
      }
    }

    process.stdout.write(parts.join("\n") + "\n");
  }

  if (!result.valid) process.exitCode = 1;
}

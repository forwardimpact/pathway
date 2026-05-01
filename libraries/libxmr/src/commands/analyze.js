import { existsSync, readFileSync } from "node:fs";
import {
  formatHeader,
  formatSection,
  formatTable,
  formatBullet,
} from "@forwardimpact/libcli";

import { analyze } from "../xmr.js";

export function runAnalyzeCommand(values, args, cli) {
  const csvPath = args[0];
  if (!csvPath) {
    cli.usageError("analyze requires a <csv-path> argument");
    process.exit(2);
  }
  if (!existsSync(csvPath)) {
    cli.usageError(`cannot read CSV "${csvPath}": file not found`);
    process.exit(2);
  }

  const text = readFileSync(csvPath, "utf-8");
  const report = analyze(text);
  report.source = csvPath;
  report.generated = new Date().toISOString().slice(0, 10);

  if (values.metric) {
    report.metrics = report.metrics.filter((m) => m.metric === values.metric);
  }

  if (values.format === "json") {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    process.stdout.write(formatText(report) + "\n");
  }
}

function formatText(report) {
  const parts = [formatHeader(`XmR Analysis — ${report.source}`)];

  for (const m of report.metrics) {
    const header = `${m.metric} (${m.unit})`;
    const lines = [
      `${m.n} points from ${m.from} to ${m.to}`,
      `Status: ${m.status}`,
    ];

    if (m.x_bar !== undefined) {
      lines.push("");
      const rows = [
        ["X-bar", String(m.x_bar)],
        ["mR-bar", String(m.mr_bar)],
        ["UNPL", String(m.unpl)],
        ["LNPL", String(m.lnpl)],
        ["URL", String(m.url)],
      ];
      lines.push(formatTable(["Statistic", "Value"], rows, { compact: true }));

      lines.push(
        `Latest: ${m.latest.value} on ${m.latest.date} (mR=${m.latest.mr})`,
      );

      if (m.signals.length > 0) {
        lines.push("");
        lines.push("Signals:");
        for (const s of m.signals) {
          const span = s.date || `${s.from} to ${s.to}`;
          lines.push(formatBullet(`${s.rule} — ${span}`));
        }
      }
    }

    parts.push(formatSection(header, lines.join("\n")));
  }

  return parts.join("\n\n");
}

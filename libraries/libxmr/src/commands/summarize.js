import { existsSync, readFileSync } from "node:fs";

import { analyze, classify } from "../xmr.js";

export function runSummarizeCommand(values, args, cli) {
  const csvPath = args[0];
  if (!csvPath) {
    cli.usageError("summarize requires a <csv-path> argument");
    process.exit(2);
  }
  if (!existsSync(csvPath)) {
    cli.usageError(`cannot read CSV "${csvPath}": file not found`);
    process.exit(2);
  }

  const text = readFileSync(csvPath, "utf-8");
  const report = analyze(text);

  if (values.metric) {
    report.metrics = report.metrics.filter((m) => m.metric === values.metric);
  }

  const rows = report.metrics.map((m) => ({
    metric: m.metric,
    n: m.n,
    classification: classify(m),
    latest: m.latest?.value ?? null,
    latest_date: m.latest?.date ?? null,
    x_bar: m.x_bar ?? null,
    unpl: m.unpl ?? null,
    lnpl: m.lnpl ?? null,
    signals: m.signals ?? [],
  }));

  if (values.format === "json") {
    process.stdout.write(
      JSON.stringify({ source: csvPath, rows }, null, 2) + "\n",
    );
    return;
  }

  process.stdout.write(renderMarkdown(csvPath, rows) + "\n");
}

function renderMarkdown(source, rows) {
  const sufficient = rows.filter((r) => r.classification !== "insufficient");
  const insufficient = rows.filter((r) => r.classification === "insufficient");
  const today = new Date().toISOString().slice(0, 10);

  const lines = [`**XmR — \`${source}\`** _(${today})_`, ""];

  if (sufficient.length === 0 && insufficient.length === 0) {
    lines.push("_No metrics found._");
    return lines.join("\n");
  }

  if (sufficient.length > 0) {
    lines.push(
      "| metric | n | latest | x̄ | UNPL | LNPL | classification | signals |",
      "| ------ | - | ------ | -- | ---- | ---- | -------------- | ------- |",
    );
    for (const r of sufficient) {
      lines.push(
        `| ${r.metric} | ${r.n} | ${r.latest} | ${r.x_bar} | ${r.unpl} | ${r.lnpl} | ${r.classification} | ${formatSignals(r.signals)} |`,
      );
    }
  }

  if (insufficient.length > 0) {
    if (sufficient.length > 0) lines.push("");
    const parts = insufficient.map((r) => `${r.metric} (n=${r.n})`);
    lines.push(`_Insufficient data (n<15):_ ${parts.join(", ")}.`);
  }

  return lines.join("\n");
}

function formatSignals(signals) {
  if (signals.length === 0) return "—";
  return signals.map(formatSignal).join("; ");
}

function formatSignal(s) {
  const span = s.date ? s.date : `${s.from}→${s.to}`;
  if (s.rule === "run_above" || s.rule === "run_below") {
    return `${s.rule} ${s.length} from ${s.from}`;
  }
  if (s.rule === "trend_up" || s.rule === "trend_down") {
    return `${s.rule} ${s.moves} from ${s.from}`;
  }
  if (s.count !== undefined && s.count > 1) {
    return `${s.rule} ${s.count} from ${s.from}`;
  }
  return `${s.rule} ${span}`;
}

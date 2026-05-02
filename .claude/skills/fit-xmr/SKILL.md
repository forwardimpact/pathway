---
name: fit-xmr
description: >
  Analyze time-series CSV metrics with Wheeler/Vacanti XmR control charts to
  distinguish stable processes from special causes. Renders the canonical
  14-line X+mR chart and applies the three Wheeler detection rules. Use when a
  metric is being tracked over time and the question is whether it has
  changed — covers signal rules, the chart layout, and how to read the report.
---

# XmR Analysis

`fit-xmr` reads a CSV of dated observations, computes Wheeler/Vacanti XmR
(individuals and moving range) control limits, detects special-cause signals,
and renders a fixed-width 14-line chart that makes the rules visible by
inspection.

It implements **one canonical rendering — no variants** — following Donald
Wheeler's three-rule formulation as adopted by Daniel Vacanti for agile flow
metrics. If the rendering you need is different, what you need is a different
chart.

## When to Use

- A metric is recorded over time (security backlog, lead time, error rate, agent
  token usage) and you need to know whether a recent change is signal or noise.
- A team wants compact markdown status tables for a status page, PR description,
  or weekly report.
- A chart needs to be pasted into a code review, wiki, console, or any other
  monospace context.

If the question is _"how is this metric trending?"_ — this is the right tool. If
the question is _"what target should we set?"_ — this is **not** the right tool.
Natural process limits describe what a process _does_, not what it _should_ do.

## CSV Schema

`fit-xmr` expects exactly this header:

```
date,metric,value,unit,run,note
```

- `date` — ISO 8601 (`YYYY-MM-DD`)
- `metric` — metric name (one CSV may carry many metrics)
- `value` — numeric
- `unit` — free text (`count`, `days`, `pct`, ...)
- `run` — optional URL or run id
- `note` — annotate when a signal appears, with what you discovered

Validate before analysis:

```sh
npx fit-xmr validate observations.csv
```

## CLI Reference

Install and run via npm:

```sh
npx fit-xmr <command> <csv-path> [options]
```

| Command           | Purpose                                                               |
| ----------------- | --------------------------------------------------------------------- |
| `validate <csv>`  | Check the CSV against the schema                                      |
| `list <csv>`      | One row per metric: count, unit, date range                           |
| `analyze <csv>`   | Full XmR report: chart, limits, signals, classification               |
| `chart <csv>`     | The 14-line Wheeler/Vacanti chart for one metric                      |
| `summarize <csv>` | Compact markdown table across metrics with classification and signals |

### Common Options

| Flag                     | Purpose                                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--metric <name>` / `-m` | Filter to a single metric. Optional on `chart` when the CSV has exactly one metric; otherwise required. Filters `analyze` and `summarize` when given. |
| `--format <text\|json>`  | Output format (default: text). `chart` is text-only.                                                                                                  |
| `--ascii`                | Substitute ASCII glyphs for Unicode in chart rendering                                                                                                |
| `--help` / `-h`          | Show help (`--json` formats help itself as JSON)                                                                                                      |

`validate` exits non-zero on schema errors so it can gate CI. Missing CSV path
exits 2 with a friendly error, not a stack trace.

## Typical Workflow

```sh
npx fit-xmr validate observations.csv
npx fit-xmr list observations.csv
npx fit-xmr analyze observations.csv --metric open_vulnerabilities
npx fit-xmr chart observations.csv --metric open_vulnerabilities
npx fit-xmr summarize observations.csv               # paste into a status page
```

Validate first; list to see what's available; analyze for the full report
(chart + stats + signals); chart for the chart alone; summarize for the rollup.

## Detection Rules and Chart Layout

See [`references/rules-and-chart.md`](references/rules-and-chart.md) for the
three Wheeler detection rules, the 14-line chart layout, and the formulas for
the natural process limits, moving range, and outer-zone boundaries.

## Report Shape and Interpretation

See [`references/report-format.md`](references/report-format.md) for the
`analyze --format json` shape, the `status` and `classification` enums, and
guidance on reading the report.

---

## Documentation

- [XmR Analysis](https://www.forwardimpact.team/docs/libraries/xmr-analysis/index.md)
  — The full guide: CSV schema, commands, the three rules, the chart layout, a
  worked security backlog example, and interpretation guidance.

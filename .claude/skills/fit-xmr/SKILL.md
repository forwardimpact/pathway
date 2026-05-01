---
name: fit-xmr
description: >
  Analyze time-series CSV metrics with XmR control charts to distinguish stable
  processes from special causes. Use when a metric is being tracked over time
  and the question is whether it has changed — covers signal rules, the report
  shape, and how to interpret runs, trends, and out-of-limit points.
---

# XmR Analysis

`fit-xmr` reads a CSV of dated observations, computes XmR (individuals and
moving range) control limits, and detects special-cause signals. It turns a
column of numbers over time into a structured judgement about whether the
process is stable or has shifted.

## When to Use

- A metric is recorded over time (security backlog, lead time, error rate, agent
  token usage) and you need to know whether a recent change is signal or noise.
- A team wants compact markdown status tables (with signals annotated) for a
  wiki page, PR description, or weekly report.
- Inline sparklines are needed in a markdown table for one-glance trend
  indicators.

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

| Command                       | Purpose                                              |
| ----------------------------- | ---------------------------------------------------- |
| `validate <csv>`              | Check the CSV against the schema                     |
| `list <csv>`                  | One row per metric: count, unit, date range          |
| `analyze <csv>`               | Full XmR report: limits, latest, signals, status     |
| `summarize <csv>`             | Compact markdown table across metrics with signals   |
| `spark <csv> --metric <name>` | 12-character braille sparkline of the last 12 points |

### Common Options

| Flag                     | Purpose                                           |
| ------------------------ | ------------------------------------------------- |
| `--metric <name>` / `-m` | Filter `analyze` / `summarize` to a single metric |
| `--format <text\|json>`  | Output format (default: text)                     |
| `--help` / `-h`          | Show help                                         |
| `--json`                 | Output help as JSON                               |

`validate` exits non-zero on schema errors so it can gate CI.

---

## Signal Rules

Four families of special-cause signals. Each is a prompt to investigate, not a
verdict.

| Rule                                    | Meaning                                                 |
| --------------------------------------- | ------------------------------------------------------- |
| `point_above_unpl` / `point_below_lnpl` | Points outside natural process limits                   |
| `run_above` / `run_below`               | 8+ consecutive points on the same side of `x_bar`       |
| `trend_up` / `trend_down`               | 6+ consecutive increases or decreases                   |
| `mr_above_url`                          | Moving range exceeds URL — unusual point-to-point churn |

Consecutive out-of-bounds points are consolidated into one streak with `from`,
`to`, `count`, and `peak`/`trough`. Single-point streaks use `date` instead of
`from`/`to`.

**Runs and trends are the most actionable** — they say the level has shifted.
Point signals confirm the magnitude. `mr_above_url` means the limits themselves
are unreliable until the chaos is investigated.

## Report Shape

`analyze --format=json` is the canonical output. Each metric:

```json
{
  "metric": "open_vulnerabilities",
  "unit": "count",
  "n": 105,
  "from": "2026-01-01",
  "to": "2026-04-14",
  "x_bar": 16.79,
  "mr_bar": 0.64,
  "unpl": 18.5,
  "lnpl": 15.08,
  "url": 2.11,
  "latest": { "date": "2026-04-14", "value": 13, "mr": 1 },
  "signals": [
    { "rule": "run_below", "from": "2026-02-25", "to": "2026-04-14", "length": 50 },
    { "rule": "point_below_lnpl", "from": "2026-03-02", "to": "2026-04-14", "count": 45, "trough": 7 }
  ],
  "status": "signals_present"
}
```

`status` is one of:

- `predictable` — stable process, no signals. Don't react to individual points.
- `signals_present` — special cause detected. Read `signals`.
- `insufficient_data` — fewer than 15 points. Keep recording.

`summarize` reduces this to a markdown table with a coarse classification
column: `stable`, `signals`, `chaos` (when `mr_above_url` is present), or
`insufficient`.

## Typical Workflow

```sh
npx fit-xmr validate observations.csv
npx fit-xmr list observations.csv
npx fit-xmr analyze observations.csv --metric open_vulnerabilities
npx fit-xmr summarize observations.csv               # paste into a wiki page
npx fit-xmr spark observations.csv --metric open_vulnerabilities
```

Validate first; list to see what's available; analyze a single metric to
investigate; summarize for the rollup; spark for inline indicators.

## Interpretation Guidance

- **Predictable** processes vary within their natural limits. Reacting to a
  single point is tampering — it makes the process worse on average.
- **Runs and trends** mean something changed. Find what changed and decide
  whether to lock it in or roll it back.
- **Out-of-limits points** confirm magnitude. The size of the shift matters for
  prioritization, not for the verdict.
- **`mr_above_url`** says volatility itself spiked. The limits are computed from
  `mr_bar`; if the moving range is unstable, the limits don't yet describe a
  stable process. Investigate the volatility before reading the rest of the
  report.
- **Annotate the CSV `note` field** when you investigate a signal. The note is
  the record of why the process changed; future analyses depend on it.
- **Don't set targets from the limits.** Targets come from the work; limits
  describe the work. Conflating them turns the chart into a stick.

---

## Documentation

- [XmR Analysis](https://www.forwardimpact.team/docs/libraries/xmr-analysis/index.md)
  — The full guide: CSV schema, commands, signal rules, a worked security
  backlog example, and interpretation guidance.

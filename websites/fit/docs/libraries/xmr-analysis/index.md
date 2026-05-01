---
title: XmR Analysis
description: Distinguish stable processes from special causes with XmR control charts — record observations, read signal rules, and turn variation into action.
---

# XmR Analysis

A metric on its own is a number. A metric over time is a process. **XmR control
charts** (individuals and moving range) tell you whether that process is stable
or reacting to a special cause — using the data itself to compute natural
process limits, with no external targets required.

`fit-xmr` reads a time-series CSV, computes the limits, detects four families of
signals, and prints either a human-readable report, a compact markdown summary,
or structured JSON for further analysis. It is the analysis surface on top of
any CSV that records observations of a metric over time.

This guide walks through the CSV schema, the commands, the signal rules, and how
to interpret the report.

## Prerequisites

- Node.js 18+
- A CSV of observations with the schema below
- At least 15 data points per metric for limits to be meaningful

## CSV schema

`fit-xmr` expects the header `date,metric,value,unit,run,note` and one row per
observation:

```csv
date,metric,value,unit,run,note
2026-01-01,open_vulnerabilities,12,count,https://example.com/run/1,
2026-01-02,open_vulnerabilities,11,count,https://example.com/run/2,
2026-01-03,open_vulnerabilities,11,count,https://example.com/run/3,
```

| Field    | Required | Notes                                                                |
| -------- | -------- | -------------------------------------------------------------------- |
| `date`   | yes      | ISO 8601 (`YYYY-MM-DD`). Sort key.                                   |
| `metric` | yes      | Metric name. One CSV may carry multiple metrics — they are grouped.  |
| `value`  | yes      | Numeric. `NaN` is rejected by `validate`.                            |
| `unit`   | yes      | Free text (`count`, `days`, `pct`, ...). Used in report headers.     |
| `run`    | no       | Optional URL or identifier of the run that produced the observation. |
| `note`   | no       | Free text — annotate with what you discovered when a signal appears. |

Validate before analysis:

```sh
npx fit-xmr validate observations.csv
```

A non-zero exit code means the file does not match the schema.

## 1. Get oriented

List what's in the file before charting:

```sh
npx fit-xmr list observations.csv
```

Prints one row per metric with the count of observations and the date range.
Useful when a CSV carries several metrics and you only want to chart one of
them.

## 2. Run the analysis

The full report lives in `analyze`:

```sh
npx fit-xmr analyze observations.csv
npx fit-xmr analyze observations.csv --metric open_vulnerabilities
npx fit-xmr analyze observations.csv --format json
```

For each metric the report prints:

- **`x_bar`** — central line, mean of all values.
- **`mr_bar`** — average moving range (`|x_i - x_{i-1}|`).
- **`unpl`** / **`lnpl`** — upper / lower natural process limits
  (`x_bar ± 2.66 * mr_bar`; `lnpl` floors at 0 for counts).
- **`url`** — upper range limit for the moving range chart (`3.27 * mr_bar`).
- **`latest`** — the most recent observation.
- **`signals`** — every special-cause signal detected.
- **`status`** — `predictable`, `signals_present`, or `insufficient_data`.

The JSON output is the canonical shape; the text report is a pretty-print.

## 3. Read the signals

`fit-xmr` detects four families of special-cause signals. Treat each as a prompt
to investigate, not a verdict.

| Rule                                    | Meaning                                                  |
| --------------------------------------- | -------------------------------------------------------- |
| `point_above_unpl` / `point_below_lnpl` | One or more points outside the natural process limits.   |
| `run_above` / `run_below`               | 8+ consecutive points on the same side of `x_bar`.       |
| `trend_up` / `trend_down`               | 6+ consecutive increases or decreases.                   |
| `mr_above_url`                          | Moving range exceeds URL — unusual point-to-point churn. |

Consecutive out-of-bounds points are consolidated into one streak signal with
`from`, `to`, `count`, and `peak`/`trough`. Single-point streaks carry `date`
instead of `from`/`to`.

**Runs and trends are usually the most actionable** — they say the process level
has shifted. Point signals confirm the magnitude. `mr_above_url` says the limits
themselves are unreliable until the chaos is investigated; treat the rest of the
report cautiously when it appears.

## 4. Summarize across metrics

For a status overview across many metrics, `summarize` produces a markdown table
you can paste into a wiki page or PR description:

```sh
npx fit-xmr summarize observations.csv
npx fit-xmr summarize observations.csv --format json
```

Each row carries the metric, sample count, latest value, `x_bar`, the limits, a
coarse classification, and a compact list of signals. The classifications are
deterministic:

- **`stable`** — `predictable` status, no signals.
- **`signals`** — special cause detected; investigate.
- **`chaos`** — `mr_above_url` present; the limits are not trustworthy.
- **`insufficient`** — fewer than 15 points; keep recording.

Metrics with insufficient data are listed below the main table so they don't
crowd the active signals.

## 5. Sparklines for inline reporting

For one-glance trend indicators in markdown tables, `spark` prints a
twelve-character braille sparkline of the last twelve points:

```sh
npx fit-xmr spark observations.csv --metric open_vulnerabilities
# ▆▇█▇▆▅▄▃▃▂▁▁
```

Sparklines are pure visual signal — no thresholds, no detection. Pair them with
`summarize` for a status table that reads at a glance and drills into detail
when needed.

## Worked example: a security backlog

A team records open vulnerability counts daily into `security/2026.csv`. After
three months they run:

```sh
npx fit-xmr analyze security/2026.csv --metric open_vulnerabilities
```

The report shows `status: signals_present` with two signals: a `run_below` of 50
days starting 2026-02-25, and a `point_below_lnpl` streak of 45 points in the
same window. The interpretation:

- **Run below `x_bar`** — the process has shifted. Open vulnerabilities are
  consistently lower than they were in the first two months.
- **Points below `lnpl`** — the magnitude of the shift is large enough to break
  through the lower natural process limit.

The team annotates the CSV `note` field on 2026-02-25 with the change that
landed (a new pre-merge security gate) and treats the new level as the process
baseline going forward. The next quarterly report will be computed against the
post-shift data.

This is the loop: record, analyze, investigate signals, annotate, repeat.

## Interpretation guidance

- **Do not react to individual data points** when `status: predictable`. Routine
  variation is noise, not signal.
- **Do not set targets based on the natural process limits.** They describe what
  the process _does_, not what it _should_ do.
- **Annotate the CSV** with what you discovered when a signal appears. The
  `note` field is the record of why the process changed.
- **Keep at least 15 points** before reading limits. Below that the report marks
  the metric `insufficient_data` and computes nothing.

## Related

- [`fit-xmr` reference](https://www.npmjs.com/package/@forwardimpact/libxmr) —
  package on npm.

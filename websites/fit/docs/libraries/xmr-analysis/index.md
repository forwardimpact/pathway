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
2026-01-03,open_vulnerabilities,11,count,,
```

Trailing commas keep the column count consistent when `run` and `note` are
empty.

| Field    | Required | Notes                                                                |
| -------- | -------- | -------------------------------------------------------------------- |
| `date`   | yes      | ISO 8601 (`YYYY-MM-DD`). Sort key.                                   |
| `metric` | yes      | Metric name. One CSV may carry multiple metrics — they are grouped.  |
| `value`  | yes      | Numeric. Non-numeric strings are rejected by `validate`.             |
| `unit`   | yes      | Free text (`count`, `days`, `pct`, ...). Empty `unit` is rejected.   |
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

JSON output is the canonical shape; text is a pretty-print of the same data. The
JSON document is wrapped in `{ source, generated, metrics: [...] }` — each
metric in that array carries:

- **`x_bar`** — central line, mean of all values.
- **`mr_bar`** — average of the moving ranges `|x_i - x_{i-1}|`.
- **`unpl`** / **`lnpl`** — upper / lower natural process limits
  (`x_bar ± 2.66 * mr_bar`; `lnpl` floors at 0 for counts).
- **`url`** — upper range limit for the moving range chart (`3.27 * mr_bar`).
- **`latest`** — most recent observation as `{ date, value, mr }`. `mr` is the
  moving range at that point — useful for "is today's change unusual?".
- **`signals`** — special-cause signals, sorted by start date.
- **`status`** — `predictable`, `signals_present`, or `insufficient_data`.

The constants `2.66` and `3.27` are XmR's standard scale factors for the n=2
moving range (≈ 3σ for individuals, D4 for the range chart). They are not
tunable — that's what makes XmR limits comparable across processes.

## 3. Read the signals

`fit-xmr` detects four families of special-cause signals. Treat each as a prompt
to investigate, not a verdict.

| Rule                                    | Meaning                                                  |
| --------------------------------------- | -------------------------------------------------------- |
| `point_above_unpl` / `point_below_lnpl` | One or more points outside the natural process limits.   |
| `run_above` / `run_below`               | 8+ consecutive points on the same side of `x_bar`.       |
| `trend_up` / `trend_down`               | 6+ consecutive increases or decreases.                   |
| `mr_above_url`                          | Moving range exceeds URL — unusual point-to-point churn. |

Signal payloads:

- **Run signals** carry `from`, `to`, and `length` (point count).
- **Trend signals** carry `from`, `to`, and `moves` (number of consecutive
  same-direction transitions; 6 moves = 7 same-direction points).
- **Point and mR signals** carry `count` plus `peak` (for above-limit) or
  `trough` (for below-limit). Consecutive out-of-bounds points are consolidated
  into one streak with `from`/`to`; single-point streaks carry `date` instead.

**Runs and trends are usually the most actionable** — they say the process level
has shifted. Why those rules? A predictable process produces points that hop
randomly across `x_bar`; under that null, eight consecutive points on one side
or six consecutive same-direction moves are each rarer than 1%. Point signals
confirm the magnitude of the shift; the size matters for prioritization, not for
the verdict.

`mr_above_url` is special. The limits are computed from `mr_bar`, so an outlier
moving range inflates `mr_bar` and pulls UNPL/LNPL wider than the process
actually warrants. Until you investigate the outlier — usually a single big jump
— the rest of the report describes a stretched envelope, not a real one.

## 4. Summarize across metrics

For a status overview across many metrics, `summarize` produces a markdown table
you can paste into a status page or PR description:

```sh
npx fit-xmr summarize observations.csv
npx fit-xmr summarize observations.csv --metric open_vulnerabilities
npx fit-xmr summarize observations.csv --format json
```

`--metric` filters to a single row; `--format json` returns the same data as
JSON. Each row carries the metric, sample count, latest value, `x_bar`, the
limits, a coarse classification, and a compact list of signals. The
classifications are deterministic:

- **`stable`** — `predictable` status, no signals.
- **`signals`** — special cause detected; investigate.
- **`chaos`** — `mr_above_url` present; the limits are not trustworthy.
- **`insufficient`** — fewer than 15 points; keep recording.

Metrics with insufficient data are listed below the main table so they don't
crowd the active signals.

## 5. Sparklines for inline reporting

For one-glance trend indicators in markdown tables, `spark` prints a
twelve-character block-element sparkline of the last twelve points:

```sh
npx fit-xmr spark observations.csv --metric open_vulnerabilities
# ▆▇█▇▆▅▄▃▃▂▁▁
```

How to read it:

- **Scale is per-series, not absolute** — the lowest of the last 12 points maps
  to `▁`, the highest to `█`. Two sparklines from different metrics are not
  comparable on visual height.
- **Padding** — fewer than 12 points pad with leading spaces, so the bars always
  right-align in markdown table cells.
- **Flat or single-value series** render as a row of mid-bars (`▄`).
- **Last 12 points only** — a level shift older than 12 observations is
  invisible. Use `analyze` for shift detection; sparklines are situational
  awareness.

Pair them with `summarize` for a status table that reads at a glance and drills
into detail when needed.

## Worked example: a security backlog

A team records open vulnerability counts daily into `security/2026.csv`. After
three months they run:

```sh
npx fit-xmr analyze security/2026.csv --metric open_vulnerabilities
```

The report shows `status: signals_present` with three signals on the single
metric:

- A `run_above` of 55 points covering 2026-01-01 → 2026-02-24.
- A `run_below` of 50 points covering 2026-02-25 → 2026-04-14.
- A `point_below_lnpl` streak of 45 points in the post-shift window.

This is the classic shape of a **level shift**: the global `x_bar` sits between
the pre-shift and post-shift levels, so points fall consistently on one side
then consistently on the other. Both runs are real signals — they say the
process you have today is not the process you had in January.

The team annotates the CSV `note` field on 2026-02-25 with the change that
landed (a new pre-merge security gate) and treats the new level as the process
baseline going forward. The next analysis is run against **post-shift data
only** — otherwise `x_bar` keeps averaging across two different processes and
the limits describe neither.

This is the loop: record, analyze, investigate signals, annotate, recompute once
a shift is locked in, repeat.

## Interpretation guidance

- **Do not react to individual data points** when `status: predictable`. Routine
  variation is common-cause noise; treating it as a problem and intervening
  makes the process worse on average. W. Edwards Deming called this _tampering_.
- **Do not set targets based on the natural process limits.** They describe what
  the process _does_, not what it _should_ do. Targets come from the work;
  limits describe the work.
- **A series spanning a level shift will surface signals on both sides** of
  `x_bar` — that's not a bug. Once you confirm the shift is locked in, recompute
  against the post-shift segment so the new limits describe the new process.
- **Annotate the CSV** with what you discovered when a signal appears. The
  `note` field is the durable record of why the process changed.
- **Keep at least 15 points** before reading limits. Below that the report marks
  the metric `insufficient_data` and computes nothing.

## Related

- [`fit-xmr` on npm](https://www.npmjs.com/package/@forwardimpact/libxmr) —
  installation and changelog.
- [Trace Analysis](https://www.forwardimpact.team/docs/libraries/trace-analysis/index.md)
  — qualitative analysis of agent traces; the same "let the data tell you"
  posture applied to a different domain.

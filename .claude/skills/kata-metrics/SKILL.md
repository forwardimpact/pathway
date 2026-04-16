---
name: kata-metrics
description: >
  Time-series data recording and analysis protocol for Kata agents. Defines CSV
  schema, storage conventions, metric design guidance, and XmR control chart
  analysis via `fit-xmr`. Utility skill — no agent routes to it directly;
  entry-point skills reference it for recording and analysis.
---

# Metrics Protocol

Utility skill like `kata-review` — defines the recording and analysis protocol
that entry-point skills follow for time-series data.

## When to Use

- **Recording** — You are an entry-point kata skill appending measurements after
  completing primary work. Follow the recording protocol for format, storage,
  and design guidance.
- **Analysis** — You need to understand process behavior from recorded metrics.
  Use `fit-xmr` to validate, inventory, and analyze CSV files.

## Recording Protocol

1. Choose which metrics to record based on what you observed during this run
   (informed by your skill's `references/metrics.md`).
2. For each metric, append one CSV row to
   `wiki/metrics/{agent}/{domain}/{YYYY}.csv`. Create the directory and header
   row if the file does not exist.
3. Commit metrics files as part of the wiki push at the end of the run.

## Metric Design Guidance

- Prefer counts and durations over ratios (ratios hide volume).
- Prefer direct measurements over derived values.
- Keep metric names stable across runs (snake_case, descriptive).
- One metric per measurement — do not pack multiple values into one row.

## Storage

```
wiki/metrics/{agent}/{domain}/{YYYY}.csv
```

Agent matches profile name. Domain matches skill domain slug (e.g., `audit`,
`triage`, `release-readiness`). Partitioned by year. First line of each new file
is the header row.

## CSV Format

See [`references/csv-schema.md`](references/csv-schema.md) for field
definitions, types, and appending rules.

## Analysis with `fit-xmr`

Four commands cover the analysis workflow. All default to text output; add
`--format json` for structured JSON.

**Validate** recordings after appending rows:

```sh
bunx fit-xmr validate wiki/metrics/{agent}/{domain}/{YYYY}.csv
```

Returns `{ valid, rows, errors[] }`. Non-zero exit on invalid data.

**List** metrics in a file (quick inventory before full analysis):

```sh
bunx fit-xmr list wiki/metrics/{agent}/{domain}/{YYYY}.csv
```

Returns metric name, unit, point count, and date range for each metric.

**Analyze** process behavior with XmR control charts:

```sh
bunx fit-xmr analyze wiki/metrics/{agent}/{domain}/{YYYY}.csv
bunx fit-xmr analyze wiki/metrics/{agent}/{domain}/{YYYY}.csv --metric open_vulnerabilities
```

Returns limits (`x_bar`, `unpl`, `lnpl`), latest observation, detected signals,
and `status` — one of `predictable`, `signals_present`, or `insufficient_data`.
Filter to a single metric with `--metric`.

**Spark** — sparkline of the last 12 data points (for storyboard tables):

```sh
bunx fit-xmr spark wiki/metrics/{agent}/{domain}/{YYYY}.csv --metric open_vulnerabilities
```

Outputs 12 bar characters scaled from ▁ (min) to █ (max) within the metric's own
range.

See [`references/xmr.md`](references/xmr.md) for chart construction, signal
rules, JSON report format, and interpretation guidance.

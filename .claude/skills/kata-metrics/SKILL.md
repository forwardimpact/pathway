---
name: kata-metrics
description: >
  Time-series data recording protocol for Kata agents. Defines CSV schema,
  storage conventions, and metric design guidance. Utility skill — no agent
  routes to it directly; entry-point skills reference it for recording.
---

# Metrics Recording Protocol

Utility skill like `kata-gh-cli` — defines the protocol that entry-point skills
follow when recording time-series data at the end of each run.

## When to Use

You are an entry-point kata skill recording measurements after completing
primary work. Reference this protocol for format, storage, and design guidance.

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

## Process Behavior Charts

See [`references/control-charts.md`](references/control-charts.md) for XmR chart
construction, natural process limits, and signal detection.

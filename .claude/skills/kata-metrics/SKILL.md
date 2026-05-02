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

Metrics exist to drive XmR analysis. A metric is worth recording only if its
values, plotted in order, reveal whether the process is predictable or shifting.
Apply these constraints:

- **Only end-to-end skills record metrics.** A skill is end-to-end when its
  output is value-bearing on its own (not WIP for a downstream skill). Pipeline
  stations and orchestration utilities do not record.
- **Only process throughput.** Record the count of units of work the process
  produced this run — issues triaged, PRs merged, findings filed,
  implementations shipped. One observation per run.
- **Do not record stocks or state.** Backlog counts (`open_issues`, `open_prs`)
  and ages (`days_since_release`, `days_in_draft`) can be queried any time from
  `gh`, `git`, or `npm audit`. Freezing them into CSV adds noise without signal:
  stocks drift on accumulated history and ages are sawtooth functions that reset
  on each event — neither tells you about the _process_ under XmR.
- **No ratios, no aggregates with shifting scope.** Ratios hide volume; counts
  whose denominator changes are not stable.
- **One metric per skill.** If a second feels essential, it usually duplicates
  the first or measures internal mechanics rather than process outcome.
- **Names stable across runs** (snake_case). One row per measurement.

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

**Analyze** process behavior with the canonical Wheeler/Vacanti X+mR chart:

```sh
bunx fit-xmr analyze wiki/metrics/{agent}/{domain}/{YYYY}.csv
bunx fit-xmr analyze wiki/metrics/{agent}/{domain}/{YYYY}.csv --metric issues_triaged
```

Returns the 14-line chart, full-precision stats (`mu`, `R`, `sigmaHat`, `UPL`,
`LPL`, `URL`, `zoneUpper`, `zoneLower`), latest observation, detected signals
keyed by rule (`xRule1`, `xRule2`, `xRule3`, `mrRule1`), `status` — one of
`predictable`, `signals_present`, `insufficient_data` — and `classification`
(`stable`, `signals`, `chaos`, `insufficient`). Filter to a single metric with
`--metric`.

**Chart** — render the 14-line X+mR chart for a single metric:

```sh
bunx fit-xmr chart wiki/metrics/{agent}/{domain}/{YYYY}.csv --metric issues_triaged
```

Add `--ascii` if the consuming environment mishandles Unicode glyphs.

See [`references/xmr.md`](references/xmr.md) for chart construction, signal
rules, JSON report format, and interpretation guidance. The same material in
public-facing form (for external readers) lives at the
[XmR Analysis guide](https://www.forwardimpact.team/docs/libraries/xmr-analysis/index.md).

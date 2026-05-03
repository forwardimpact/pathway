---
title: XmR Analysis
description: Distinguish stable processes from special causes with Wheeler/Vacanti XmR control charts — record observations, render the canonical 14-line chart, read three detection rules, and turn variation into action.
---

A metric on its own is a number. A metric over time is a process. **XmR control
charts** (individuals and moving range) tell you whether that process is stable
or reacting to a special cause — using the data itself to compute natural
process limits, with no external targets required.

`fit-xmr` reads a time-series CSV, computes the limits, applies the three
Wheeler detection rules, and renders the canonical 14-line X+mR chart you can
paste into a code review, wiki, or status page. It implements one canonical
rendering — no variants, no tunable rules — following Donald Wheeler's
formulation as adopted by Daniel Vacanti for agile flow metrics.

This guide walks through the CSV schema, the commands, the chart layout, the
three rules, and how to interpret the report.

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

## 2. Render the chart

For a single metric, render the 14-line chart:

```sh
npx fit-xmr chart observations.csv --metric open_vulnerabilities
```

`--metric` is optional when the CSV carries exactly one metric — `chart` picks
it up implicitly. When the CSV carries multiple metrics, `--metric` is required
and the command exits with the available names if it is omitted.

The chart looks like this:

```
 UPL 12.5 ──────────────────────────────●───────────────
          │
+1.5σ 9.4 │        ·           ·  ·              ·
    μ 6.4 ┼╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
-1.5σ 3.4 │  ·  ·     ·  ·  ·        ·     ·  ·     ·  ·
          │
  LPL 0.3 ──────────────────────────────────────────────

  URL 7.5 ─────────────────────────────────●────────────
          │                    ·        ·
    R 2.3 ┼╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
          │     ·  ·  ·  ·  ·     ·  ·        ·  ·  ·  ·
      0.0 ──────────────────────────────────────────────
             1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
```

- Top half — **X chart** (individuals): each observation rendered against
  natural process limits and the inner/outer zones.
- Bottom half — **mR chart** (moving range): consecutive `|x_i − x_{i-1}|`
  values against the upper range limit.
- The shared time axis at the bottom serves both charts. Drop your eye straight
  down from any X-chart point to find its time index.
- `·` is a non-signal point; `●` is a signal point.

If your terminal mishandles Unicode, use `--ascii`:

```sh
npx fit-xmr chart observations.csv --metric open_vulnerabilities --ascii
```

## 3. Run the analysis

The full report combines chart + limits + signals + classification:

```sh
npx fit-xmr analyze observations.csv
npx fit-xmr analyze observations.csv --metric open_vulnerabilities
npx fit-xmr analyze observations.csv --format json
```

JSON output is the canonical structured shape. Each metric in the report
carries:

- **`stats`** — `mu`, `R`, `sigmaHat`, `UPL`, `LPL`, `URL`, `zoneUpper`,
  `zoneLower`. Full precision.
- **`latest`** — most recent observation as `{ date, value, mr }`. `mr` is the
  moving range at that point — useful for "is today's change unusual?".
- **`signals`** — keyed by rule: `xRule1`, `xRule2`, `xRule3`, `mrRule1`. Each
  entry carries `slots` (1-indexed positions) and a human-readable
  `description`.
- **`status`** — `predictable`, `signals_present`, or `insufficient_data`.
- **`classification`** — `stable`, `signals`, `chaos`, or `insufficient`.

### Computed quantities

For an individuals chart with subgroup size n=2:

```
μ    = mean(values)                     X chart centerline
R    = mean(|x_i − x_{i-1}|)            mR chart centerline
σ̂    = R / 1.128                        d₂ for n=2
UPL  = μ + 2.660 × R                    E₂ = 3 / d₂
LPL  = μ − 2.660 × R                    LPL is NOT clipped to zero
URL  = 3.268 × R                        D₄ for n=2
+1.5σ̂, -1.5σ̂                            outer-zone boundaries (Rule 3)
```

The constants are exact for individuals charts. They are not tunable — that's
what makes XmR limits comparable across processes.

## 4. Read the three rules

`fit-xmr` applies the three rules from Wheeler's _Understanding Variation_, as
Vacanti adopts them in _Actionable Agile Metrics_:

| Rule          | Condition                                                            | Applied to |
| ------------- | -------------------------------------------------------------------- | ---------- |
| **X-Rule 1**  | A point falls outside the natural process limits (UPL or LPL)        | X chart    |
| **X-Rule 2**  | 8 consecutive points on the same side of the centerline μ            | X chart    |
| **X-Rule 3**  | 3 of any 4 consecutive points strictly beyond ±1.5σ̂ on the same side | X chart    |
| **mR-Rule 1** | A moving range point exceeds URL                                     | mR chart   |

Treat each as a prompt to investigate, not a verdict.

When Rule 2 or Rule 3 fires, **all** participating slots are listed in the
signal record — the visual gestalt of the run carries the diagnostic
information, so flagging only the trigger would hide the pattern.

**Why these three rules?** A predictable process produces points that hop
randomly across μ. Under that null, the probabilities of 8 consecutive points on
one side, 3 of 4 outside ±1.5σ̂, and a single point outside ±3σ̂ are each small
and roughly comparable — together they catch sustained shifts, smaller shifts,
and isolated outliers without inflating false-alarm rates.

**No additional rules.** Western Electric's full set, the Nelson rules, and
trend tests are deliberately omitted. They increase sensitivity but inflate
false alarms beyond what is useful for the small-sample contexts these charts
are designed for. Wheeler chose three rules; that is the set this guide
describes.

**mR Rule 1 is special.** The X-chart limits are computed from `R`, so an
outlier moving range inflates `R` and pulls UPL/LPL wider than the process
actually warrants. Until you investigate the outlier — usually a single big jump
— the rest of the report describes a stretched envelope, not a real one. That's
why the `chaos` classification is reserved for series with mR breaches.

## 5. Summarize across metrics

For a status overview across many metrics, `summarize` produces a markdown table
you can paste into a status page or PR description:

```sh
npx fit-xmr summarize observations.csv
npx fit-xmr summarize observations.csv --metric open_vulnerabilities
npx fit-xmr summarize observations.csv --format json
```

Each row carries the metric, sample count, latest value, μ, the limits, a coarse
classification, and a compact list of signals (`R1×k`, `R2×len`, `R3×slots`,
`mR1×k`). Classifications are deterministic:

- **`stable`** — predictable; no rules fire.
- **`signals`** — at least one X-chart rule fires; investigate.
- **`chaos`** — mR Rule 1 fires; the limits are not trustworthy.
- **`insufficient`** — fewer than 15 points; keep recording.

Metrics with insufficient data are listed below the main table so they don't
crowd the active signals.

## Worked example: a security backlog

A team records open vulnerability counts daily into `security/2026.csv`. After
three months they run:

```sh
npx fit-xmr analyze security/2026.csv --metric open_vulnerabilities
```

The report shows `classification: signals` with the following signals:

- An X-Rule 2 run-above of 55 points covering 2026-01-01 → 2026-02-24.
- An X-Rule 2 run-below of 50 points covering 2026-02-25 → 2026-04-14.
- An X-Rule 1 breach of LPL on the lowest post-shift days.

This is the classic shape of a **level shift**: the global μ sits between the
pre-shift and post-shift levels, so points fall consistently on one side then
consistently on the other. Both runs are real signals — they say the process you
have today is not the process you had in January.

The team annotates the CSV `note` field on 2026-02-25 with the change that
landed (a new pre-merge security gate) and treats the new level as the process
baseline going forward. The next analysis is run against **post-shift data
only** — otherwise μ keeps averaging across two different processes and the
limits describe neither.

This is the loop: record, render the chart, investigate signals, annotate,
recompute once a shift is locked in, repeat.

## Interpretation guidance

- **Do not react to individual data points** when `classification: stable`.
  Routine variation is common-cause noise; treating it as a problem and
  intervening makes the process worse on average. W. Edwards Deming called this
  _tampering_.
- **Do not set targets based on the natural process limits.** They describe what
  the process _does_, not what it _should_ do. Targets come from the work;
  limits describe the work.
- **A series spanning a level shift will surface signals on both sides** of μ —
  that's not a bug. Once you confirm the shift is locked in, recompute against
  the post-shift segment so the new limits describe the new process.
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

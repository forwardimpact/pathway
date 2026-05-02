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

---

## The Three Rules

The three rules from Wheeler's _Understanding Variation_, applied as Vacanti
applies them in _Actionable Agile Metrics_:

| Rule          | Condition                                                           | Applied to |
| ------------- | ------------------------------------------------------------------- | ---------- |
| **X-Rule 1**  | A point falls outside the natural process limits (UPL or LPL)       | X chart    |
| **X-Rule 2**  | 8 consecutive points fall on the same side of the centerline μ      | X chart    |
| **X-Rule 3**  | 3 of any 4 consecutive points fall in the outer zone (beyond ±1.5σ̂) | X chart    |
| **mR-Rule 1** | A moving range point exceeds URL                                    | mR chart   |

Rules 2 and 3 are not applied to the mR chart — its distribution is asymmetric,
so symmetric zone tests don't behave the way they do on the X chart.

When a run-pattern rule fires (Rule 2 or Rule 3), **all** participating slots
are marked, not just the trigger. The visual gestalt of the run carries the
diagnostic information.

**No additional rules.** Western Electric's full set, the Nelson rules, and
trend tests are deliberately omitted. They inflate false-alarm rates beyond what
is useful for the small-sample contexts these charts are designed for. Wheeler
chose three rules; that is the set this skill renders.

## The Chart

`fit-xmr chart` renders 14 lines: an X chart (7 rows), a blank separator, and an
mR chart (6 rows including a single shared time axis at the bottom that serves
both charts).

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

- `·` is a non-signal point; `●` is a signal point.
- Drop your eye straight down from any point in the X chart to find its time
  index in the shared axis.
- `+1.5σ̂` and `−1.5σ̂` mark the **outer-zone boundary** for X-Rule 3.

### Computed quantities

```
μ    = mean of values                  (X chart centerline)
R    = mean of moving ranges            (mR chart centerline)
σ̂    = R / 1.128                       (d₂ for n=2)
UPL  = μ + 2.660 × R                   (E₂ = 3 / d₂)
LPL  = μ − 2.660 × R                   (LPL is NOT clipped to zero)
URL  = 3.268 × R                       (D₄ for n=2)
```

The constants are exact for individuals charts. They are not tunable — that's
what makes XmR limits comparable across processes.

## Report Shape

`analyze --format json` returns the structured report:

```json
{
  "source": "observations.csv",
  "generated": "2026-04-14",
  "metrics": [
    {
      "metric": "open_vulnerabilities",
      "unit": "count",
      "n": 15,
      "from": "2026-01-01",
      "to": "2026-01-15",
      "status": "signals_present",
      "latest": { "date": "2026-01-15", "value": 5, "mr": 1 },
      "signals": {
        "xRule1": [{ "slots": [10], "description": "x=13 > UPL=12.5" }],
        "xRule2": [],
        "xRule3": [],
        "mrRule1": [{ "slots": [11], "description": "mR=8 > URL=7.5" }]
      },
      "classification": "chaos",
      "stats": {
        "mu": 6.4, "R": 2.3, "sigmaHat": 2.03,
        "UPL": 12.5, "LPL": 0.3, "URL": 7.5,
        "zoneUpper": 9.4, "zoneLower": 3.4
      }
    }
  ]
}
```

Each signal record carries `slots` (1-indexed positions) and a human-readable
`description`. Rules 2 and 3 list every participating slot.

`status` values:

- `predictable` — no rules fire.
- `signals_present` — at least one rule fires.
- `insufficient_data` — fewer than 15 points; limits not computed.

`classification` rolls these into a coarse category:

- `stable` — predictable.
- `signals` — at least one X chart rule fires.
- `chaos` — mR Rule 1 fires; the variation itself is unstable, which makes every
  X-chart limit unreliable until the outsized moves are investigated.
- `insufficient` — n < 15.

`summarize` reduces the report to a markdown table with a compact signal column
(`R1×k`, `R2×len`, `R3×slots`, `mR1×k`).

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

## Interpretation Guidance

- **Predictable** processes vary within their natural limits. Reacting to a
  single point is tampering — it makes the process worse on average.
- **X-Rule 1** points confirm magnitude. The size of the shift matters for
  prioritization, not for the verdict.
- **X-Rule 2 runs** mean the centerline shifted. Find what changed and decide
  whether to lock it in or roll it back.
- **X-Rule 3 outer-zone clusters** detect smaller shifts than Rule 2 — they
  catch a level change before the run gets long enough to fire Rule 2.
- **A series spanning a level shift** will surface Rule 2 on **both** sides
  (run-above for pre-shift, run-below for post-shift). Once the shift is locked
  in, recompute by trimming the CSV to post-shift dates so the limits describe
  the new process.
- **mR Rule 1 (chaos classification)** says volatility itself spiked. The limits
  on the X chart are computed from `R`; an outsized moving range inflates `R`
  and pulls UPL/LPL wider, so the rest of the report is unreliable until you
  investigate.
- **Annotate the CSV `note` field** when you investigate a signal. The note is
  the record of why the process changed; future analyses depend on it.
- **Don't set targets from the limits.** Targets come from the work; limits
  describe the work. Conflating them turns the chart into a stick.

---

## Documentation

- [XmR Analysis](https://www.forwardimpact.team/docs/libraries/xmr-analysis/index.md)
  — The full guide: CSV schema, commands, the three rules, the chart layout, a
  worked security backlog example, and interpretation guidance.

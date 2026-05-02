# XmR Charts

XmR (individuals and moving range) charts distinguish stable processes from
those reacting to special causes. They use the data itself to compute natural
process limits — no external targets needed. `fit-xmr` implements the canonical
Wheeler/Vacanti rendering: one layout, one set of rules.

## Usage

Run `fit-xmr analyze` against any observation CSV:

```sh
bunx fit-xmr analyze wiki/metrics/{agent}/{domain}/{YYYY}.csv
```

Other commands: `fit-xmr chart` (single-metric 14-line chart),
`fit-xmr summarize` (markdown table), `fit-xmr list` (inventory),
`fit-xmr validate` (schema check). `fit-xmr --help` for details.

`analyze --format json` returns structured output; text mode embeds the chart
plus a stats table and signals list.

## Construction

Subgroup size n=2 individuals chart. Constants are exact:

1. **X chart (individuals):** Plot each measurement in time order. Compute the
   centerline `μ = mean(values)`.
2. **mR chart (moving range):** Compute `|x_i − x_{i-1}|` for consecutive
   measurements. Compute `R = mean(mRs)`.
3. **σ̂ estimate:** `σ̂ = R / 1.128` (the d₂ constant for n=2).
4. **Natural process limits:** `UPL = μ + 2.660 × R`, `LPL = μ − 2.660 × R`. LPL
   is **not** clipped to zero — a negative LPL on a count metric is a signal
   about the metric, not a thing to hide.
5. **Upper range limit:** `URL = 3.268 × R` (D₄ for n=2). There is no LRL — D₃
   = 0.
6. **Outer-zone boundaries:** `μ ± 1.5σ̂` mark the strip used by Rule 3.

Minimum 15 data points before computing meaningful limits.

## The Three Detection Rules

| Rule          | Condition                                                            | Applied to |
| ------------- | -------------------------------------------------------------------- | ---------- |
| **X-Rule 1**  | A point falls outside the natural process limits (strict inequality) | X chart    |
| **X-Rule 2**  | 8 consecutive points on the same side of μ                           | X chart    |
| **X-Rule 3**  | 3 of any 4 consecutive points strictly beyond ±1.5σ̂ on the same side | X chart    |
| **mR-Rule 1** | A moving range point exceeds URL                                     | mR chart   |

When Rule 2 or Rule 3 fires, all participating slots are listed — the visual
gestalt of the run carries the diagnostic information.

**No additional rules.** Western Electric's full set, the Nelson rules, and
trend tests are deliberately omitted. They inflate false-alarm rates beyond what
is useful for the small-sample contexts these charts are designed for.

## JSON Report Format

The `analyze --format json` script outputs:

```json
{
  "source": "...",
  "generated": "2026-04-14",
  "metrics": [{
    "metric": "open_issues",
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
  }]
}
```

### Field Reference

| Field            | Type   | Description                                                                                           |
| ---------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| `metric`         | string | Metric name from the CSV                                                                              |
| `unit`           | string | Unit of measurement                                                                                   |
| `n`              | number | Number of data points                                                                                 |
| `from`, `to`     | string | First and last observation dates                                                                      |
| `status`         | string | `predictable`, `signals_present`, or `insufficient_data`                                              |
| `classification` | string | `stable`, `signals`, `chaos`, or `insufficient`                                                       |
| `latest`         | object | Most recent observation: `date`, `value`, `mr`                                                        |
| `signals`        | object | Keyed by rule: `xRule1`, `xRule2`, `xRule3`, `mrRule1`. Each entry carries `slots` and `description`. |
| `stats`          | object | `mu`, `R`, `sigmaHat`, `UPL`, `LPL`, `URL`, `zoneUpper`, `zoneLower`                                  |

## Interpretation Guidance

- **`classification: "stable"`** — process is predictable. Variation is routine
  noise. Do not react to individual data points.
- **`classification: "signals"`** — at least one X-chart rule fires. Read the
  `signals` object to understand what changed and when.
- **`classification: "chaos"`** — mR Rule 1 fires; volatility itself is
  unstable. The X-chart limits are computed from `R`, so an outsized moving
  range pulls UPL/LPL wider and the rest of the report is unreliable until you
  investigate.
- **`classification: "insufficient"`** — fewer than 15 points. Limits are not
  meaningful yet. Continue recording.
- Rule 2 (run) means the centerline shifted. Rule 3 (outer-zone cluster) catches
  smaller shifts before the run gets long enough to fire Rule 2. Rule 1 confirms
  the magnitude.
- Do not set targets based on the limits — they describe what the process
  _does_, not what it _should_ do. Target conditions come from the storyboard.
- When a signal appears, annotate the CSV `note` field with what you discover.

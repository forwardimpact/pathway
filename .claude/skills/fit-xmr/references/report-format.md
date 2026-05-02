# Report Shape and Interpretation

## JSON Report

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

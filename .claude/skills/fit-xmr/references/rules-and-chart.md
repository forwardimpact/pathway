# Detection Rules and the 14-Line Chart

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

## Computed Quantities

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

# libxmr

<!-- BEGIN:description — Do not edit. Generated from package.json. -->

Wheeler/Vacanti XmR control charts — distinguish signal from noise so agent
teams act on real changes, not fluctuations.

<!-- END:description -->

## Getting Started

```sh
npx fit-xmr --help
npx fit-xmr chart observations.csv --metric latency
npx fit-xmr record --skill kata-product-issue --metric issues_triaged --value 3
```

```js
import {
  analyze,
  renderChart,
  computeXmR,
  detectSignals,
} from "@forwardimpact/libxmr";
```

## CSV schema

```
date,metric,value,unit,run,note
2026-01-01,latency,124,ms,,
2026-01-02,latency,131,ms,,
```

`date` is ISO 8601, `value` is numeric, `metric` and `unit` are required. `run`
and `note` are optional. At least 15 points per metric are needed before limits
are computed.

## Example output

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

## Documentation

- [XmR Analysis](https://www.forwardimpact.team/docs/libraries/xmr-analysis/index.md)
  — full guide: CSV schema, commands, the three rules, the chart layout, a
  worked security backlog example, and interpretation guidance.

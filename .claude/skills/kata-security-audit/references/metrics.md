# Metrics — Security Audit

Record per the [`kata-metrics`](../../kata-metrics/SKILL.md) protocol. Append
one row per run.

| Metric         | Unit  | Description                      | Data source  |
| -------------- | ----- | -------------------------------- | ------------ |
| findings_count | count | New findings identified this run | Audit report |

Open vulnerabilities (`npm audit`, `gh alerts`) are queried, not recorded —
they're a stock.

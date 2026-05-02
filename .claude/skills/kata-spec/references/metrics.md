# Metrics — Specification

Record per the [`kata-metrics`](../../kata-metrics/SKILL.md) protocol. Append
one row per run.

| Metric        | Unit  | Description                        | Data source |
| ------------- | ----- | ---------------------------------- | ----------- |
| specs_drafted | count | Spec PRs opened or pushed this run | gh pr list  |

Open spec PRs and draft age (`gh pr list`, `git log`) are queried, not recorded.

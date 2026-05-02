# Metrics — Security Update

Record per the [`kata-metrics`](../../kata-metrics/SKILL.md) protocol. Append
one row per run.

| Metric       | Unit  | Description                              | Data source |
| ------------ | ----- | ---------------------------------------- | ----------- |
| prs_actioned | count | Dependabot PRs merged or closed this run | Run actions |

Backlog (`gh pr list --author app/dependabot`) is queried, not recorded.

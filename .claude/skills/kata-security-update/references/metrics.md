# Metrics — Security Update

Record per KATA.md § Metrics. Append
one row per run.

| Metric       | Unit  | Description                              | Data source |
| ------------ | ----- | ---------------------------------------- | ----------- |
| prs_actioned | count | Dependabot PRs merged or closed this run | Run actions |

Backlog (`gh pr list --author app/dependabot`) is queried, not recorded.

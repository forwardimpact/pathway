# Metrics — Security Update

Suggested metrics for this domain. These are starting points — discover which
metrics are most useful through practice. Record per the
[`kata-metrics`](../../kata-metrics/SKILL.md) protocol.

| Metric                | Unit  | Description                               | Data source       |
| --------------------- | ----- | ----------------------------------------- | ----------------- |
| dependabot_pr_backlog | count | Open Dependabot PRs at run end            | gh pr list        |
| time_to_resolve       | days  | Days oldest open Dependabot PR has waited | gh pr list        |
| prs_merged            | count | PRs successfully merged this run          | Run actions taken |

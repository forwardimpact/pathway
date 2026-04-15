# Metrics — Release Readiness

Suggested metrics for this domain. These are starting points — discover which
metrics are most useful through practice. Record per the
[`kata-metrics`](../../kata-metrics/SKILL.md) protocol.

| Metric                  | Unit  | Description                              | Data source |
| ----------------------- | ----- | ---------------------------------------- | ----------- |
| prs_waiting             | count | PRs awaiting rebase or CI fix at run end | gh pr list  |
| consecutive_stuck_count | count | PRs stuck across multiple runs           | Wiki log    |
| rebase_failures         | count | Rebases that failed this run             | Run actions |

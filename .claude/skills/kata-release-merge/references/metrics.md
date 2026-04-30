# Metrics — Release Merge

Suggested metrics for this domain. These are starting points — discover which
metrics are most useful through practice. Record per the
[`kata-metrics`](../../kata-metrics/SKILL.md) protocol.

| Metric                  | Unit  | Description                                 | Data source    |
| ----------------------- | ----- | ------------------------------------------- | -------------- |
| open_prs                | count | Open PRs at run end                         | gh pr list     |
| prs_merged              | count | PRs merged this run                         | Run actions    |
| prs_rebased             | count | PRs rebased this run                        | Run actions    |
| blocked_pr_count        | count | PRs blocked (any gate)                      | Classification |
| blocked_awaiting_signal | count | PRs blocked specifically on approval gate   | Classification |
| consecutive_stuck_count | count | PRs stuck across multiple runs              | Wiki log       |
| rebase_failures         | count | Rebases aborted due to substantive conflict | Run actions    |
| trust_lookups           | count | Top-7 contributor lookups performed         | Run actions    |

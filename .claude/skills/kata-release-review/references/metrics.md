# Metrics — Release Review

Suggested metrics for this domain. These are starting points — discover which
metrics are most useful through practice. Record per the
[`kata-metrics`](../../kata-metrics/SKILL.md) protocol.

| Metric             | Unit  | Description                              | Data source     |
| ------------------ | ----- | ---------------------------------------- | --------------- |
| unreleased_changes | count | Commits on main since last release       | git log         |
| days_since_release | days  | Days since most recent release tag       | gh release list |
| publish_failures   | count | Publish workflow failures since last run | gh run list     |

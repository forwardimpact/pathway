# Metrics — Specification

Suggested metrics for this domain. These are starting points — discover which
metrics are most useful through practice. Record per the
[`kata-metrics`](../../kata-metrics/SKILL.md) protocol.

| Metric           | Unit  | Description                                           | Data source |
| ---------------- | ----- | ----------------------------------------------------- | ----------- |
| specs_in_backlog | count | Open `spec(...): …` PRs without `spec:approved` label | gh pr list  |
| days_in_draft    | days  | Days the oldest draft spec has waited                 | Git log     |

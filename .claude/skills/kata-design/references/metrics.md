# Metrics — Design

Suggested metrics for this domain. These are starting points — discover which
metrics are most useful through practice. Record per the
[`kata-metrics`](../../kata-metrics/SKILL.md) protocol.

| Metric             | Unit  | Description                                       | Data source |
| ------------------ | ----- | ------------------------------------------------- | ----------- |
| designs_in_backlog | count | Specs with `spec.md` on main but no `design-a.md` | git ls-tree |
| days_in_draft      | days  | Days the oldest design draft has waited           | Git log     |

# Metrics — Planning

Suggested metrics for this domain. These are starting points — discover which
metrics are most useful through practice. Record per the
[`kata-metrics`](../../kata-metrics/SKILL.md) protocol.

| Metric           | Unit  | Description                                         | Data source |
| ---------------- | ----- | --------------------------------------------------- | ----------- |
| plans_in_backlog | count | Specs with `design-a.md` on main but no `plan-a.md` | git ls-tree |
| days_in_draft    | days  | Days the oldest plan draft has waited               | Git log     |

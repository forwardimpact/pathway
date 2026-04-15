# Metrics — Trace Analysis

Suggested metrics for this domain. These are starting points — discover which
metrics are most useful through practice. Record per the
[`kata-metrics`](../../kata-metrics/SKILL.md) protocol.

| Metric             | Unit  | Description                                 | Data source     |
| ------------------ | ----- | ------------------------------------------- | --------------- |
| traces_analyzed    | count | Workflow traces analyzed this run           | Run actions     |
| findings_per_trace | count | Actionable findings from the analyzed trace | Analysis        |
| invariants_passed  | count | Invariants that passed this run             | Invariant audit |

# Metrics — Security Audit

Suggested metrics for this domain. These are starting points — discover which
metrics are most useful through practice. Record per the
[`kata-metrics`](../../kata-metrics/SKILL.md) protocol.

| Metric                 | Unit  | Description                                   | Data source          |
| ---------------------- | ----- | --------------------------------------------- | -------------------- |
| open_vulnerabilities   | count | Unresolved vulnerabilities at run end         | npm audit, gh alerts |
| days_since_topic_audit | days  | Days since this audit topic was last reviewed | Coverage map in wiki |
| findings_count         | count | New findings identified this run              | Audit report         |

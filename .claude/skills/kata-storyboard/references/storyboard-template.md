# Storyboard — YYYY Month

## Challenge

_The long-term direction that gives meaning to target conditions and
experiments. Changes rarely — only when strategic direction shifts._

> [Write the challenge here.]

## Target Condition

_The measurable state the team aims to reach by the end of this month. Not a
task list — a description of how the system will behave differently, expressed
in terms verifiable with data from metrics CSVs._

> [Write the target condition here. Include specific metrics and thresholds.]

**Due:** YYYY-MM-DD (end of month)

## Current Condition

_The measured state as of the last storyboard review. Updated daily using data
from wiki/metrics/. Always numbers, not narratives._

| Agent             | Domain  | Metric               | Value | Spark        |
| ----------------- | ------- | -------------------- | ----- | ------------ |
| security-engineer | audit   | open_vulnerabilities | 2     | ▆▆████▆▆▆▃▁▃ |
| product-manager   | backlog | open_issues          | 13    | ▁▁▁▁▁██▁▁▁▁▅ |

Spark: last 12 data points via `bunx fit-xmr spark <csv> --metric <name>`. Bar
height scales from ▁ (min) to █ (max) within the metric's own range.

**Last updated:** YYYY-MM-DD

## Obstacles

_What stands between the current condition and the target condition. Discovered
through experiments, not predicted upfront._

- **Current obstacle -->** [describe]
- [other known obstacles]

## Experiments

_PDSA cycles run against the current obstacle. Record expected outcome before
running, actual outcome after._

### Experiment N

- **Obstacle:** [which obstacle this addresses]
- **What:** [description of the experiment]
- **Expected outcome:** [what you predict will happen — record before running]
- **Actual outcome:** [what actually happened — record after running]
- **What did we learn?** [gap between expected and actual]
- **Next step:** [continue, pivot, or new experiment]

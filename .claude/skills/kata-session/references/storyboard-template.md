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

For the XmR summary block below the table, paste verbatim output from
`bunx fit-xmr summarize <csv> --markdown` (one invocation per agent-domain CSV)
and add a one-line interpretive note only for metrics whose `status` is
`signals_present` or whose run-length is unusual. Stable metrics get no prose.

**Last updated:** YYYY-MM-DD

## Obstacles

_What stands between the current condition and the target condition. Discovered
through experiments, not predicted upfront. Each obstacle is a labeled GitHub
issue; the storyboard carries one-line references. Full state lives in the
issue._

### Active

- **Current obstacle -->** Obstacle name (#NNN)
- Other obstacle (#NNN)

### Concluded (last 7 days)

_One line per item: status (RESOLVED/ABANDONED), date closed, one-sentence
verdict. Items older than 7 days are deleted; the closed issue is the permanent
record._

- ~~Obstacle name~~ (#NNN) — RESOLVED YYYY-MM-DD. [one-sentence verdict].

## Experiments

_PDSA cycles run against the current obstacle. Each experiment is a labeled
GitHub issue carrying the full PDSA content; the storyboard carries one-line
references._

### Active

- Exp N (#NNN) — [short name]

### Concluded (last 7 days)

_One line per item: verdict (DELIVERED/PASS/FAIL/ABANDONED), date closed,
one-sentence learning. Items older than 7 days are deleted; the closed issue is
the permanent record._

- **Exp N — [short name]** (#NNN) — DELIVERED YYYY-MM-DD. [one-sentence
  learning].

## Retention rule

When concluding an obstacle or experiment, post the verdict as a closing comment
on the issue, close the issue, and move the storyboard entry from `Active` to
`Concluded (last 7 days)`. At the start of every storyboard session, scan
`Concluded (last 7 days)` and delete any line whose closed-date is more than 7
days before today. The decision is mechanical — date math, not judgment. The
closed issue is the permanent record.

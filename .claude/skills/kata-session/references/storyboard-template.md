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
through experiments, not predicted upfront. Use the partition below — never mix
active and concluded items in the same list._

### Active

- **Current obstacle -->** [describe]
- [other open obstacles]

### Concluded (last 7 days)

_One line per item: status (RESOLVED/ABANDONED), date closed, one-sentence
verdict. Items older than 7 days are deleted; the prior month's storyboard and
git history are the permanent record._

- ~~[obstacle]~~ — RESOLVED YYYY-MM-DD. [one-sentence verdict].

## Experiments

_PDSA cycles run against the current obstacle. Record expected outcome before
running, actual outcome after. Use the partition below — never mix active and
concluded experiments in the same list._

### Active

#### Experiment N — [short name]

- **Obstacle:** [which obstacle this addresses]
- **What:** [description of the experiment]
- **Expected outcome:** [what you predict will happen — record before running]
- **Actual outcome:** [what actually happened — record after running]
- **What did we learn?** [gap between expected and actual]
- **Next step:** [continue, pivot, or new experiment]

### Concluded (last 7 days)

_One line per item: verdict (DELIVERED/PASS/FAIL/ABANDONED), date closed,
one-sentence learning. Items older than 7 days are deleted._

- **Experiment N — [short name]** — DELIVERED YYYY-MM-DD. [one-sentence
  learning].

## Retention rule

When marking an obstacle RESOLVED or an experiment DELIVERED/PASS/FAIL, move the
item from `Active` to `Concluded (last 7 days)` in the same edit. At the start
of every storyboard session, scan `Concluded (last 7 days)` and delete any line
whose closed-date is more than 7 days before today. The decision is mechanical —
date math, not judgment. The prior month's storyboard file (and git history) is
the permanent archive.

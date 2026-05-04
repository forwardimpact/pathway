---
title: Tell Whether Culture Investments Are Working
description: Know whether mentorship programs, tooling changes, and process improvements are producing measurable results — before the next budget cycle, not after.
---

You need to determine whether specific organizational investments -- a
mentorship program, a tooling rollout, a process change -- moved the numbers
before the next budget review asks for evidence.

## Prerequisites

Complete
[Demonstrate Engineering Progress](/docs/products/engineering-outcomes/) first.
This page assumes you have a working Landmark setup with health views, snapshot
data, and at least two GetDX snapshots spanning the period of your investment.

## List active and completed initiatives

Start by confirming which investments Landmark is tracking. Initiatives are
organizational programs linked to a target driver in your engineering standard.

```sh
npx fit-landmark initiative list --manager alice@example.com
```

```text
  Initiatives

    Code Review Standards     65%   active     2025-09-30
    Runbook Coverage          100%  completed  2025-06-30
    Mentorship Pilot          40%   active     2025-12-31
```

Each row shows the initiative name, completion percentage, status, and due date.
If the output is empty, your GetDX data does not include initiative records --
check with whoever administers your GetDX account.

## Check the driver trend for a specific investment

Before looking at initiative-level impact, see whether the target driver is
trending in the right direction. Each initiative targets a driver from your
`drivers.yaml` -- for example, a code review program targets `quality` and a
runbook effort targets `reliability`.

Track the driver across all available snapshots:

```sh
npx fit-landmark snapshot trend --item reliability --manager alice@example.com
```

```text
  Trend for reliability

    2025-03-15       65
    2025-06-14       71
    2025-09-13       74
```

A rising trend does not prove the investment caused the change, but a flat or
declining trend after a completed initiative is a strong signal that the
investment did not produce the expected outcome.

Replace `reliability` with the driver ID your investment targets. Run
`npx fit-landmark snapshot list` to see available snapshot dates.

## Compare a snapshot against benchmarks

A trend shows direction; a comparison shows position. Check how the team's
current score for the target driver sits relative to organizational benchmarks:

```sh
npx fit-landmark snapshot compare --snapshot NzE4MmRk --manager alice@example.com
```

```text
  Snapshot NzE4MmRk

    Driver          Score   vs_prev  vs_org  vs_50th  vs_75th  vs_90th
    quality           78    +6       +5      +8       -2       -10
    reliability       71    +6       +3      +3       -5       -13
    cognitive_load    82    +1       +10     +10      +1       -8
```

Use the snapshot ID from `npx fit-landmark snapshot list`. The `vs_prev` column
shows movement since the last snapshot -- the most direct measure of recent
change. The `vs_org` and percentile columns place that change in context: a +6
that still sits below the 75th percentile means the investment is working but
the team has not caught up yet.

## Measure initiative impact on driver scores

For completed initiatives, Landmark correlates the completion date with
before-and-after driver scores from the bounding snapshots:

```sh
npx fit-landmark initiative impact --manager alice@example.com
```

```text
  Completed initiatives — outcome correlation

    "Runbook Coverage" (completed 2025-06-30)
      Target driver: reliability
      Score before: 65
      Score after:  71
      Change: +6 percentile points

    "Onboarding Revamp" (completed 2025-04-15)
      Target driver: cognitive_load
      Score before: 79
      Score after:  82
      Change: +3 percentile points
```

The output pairs each completed initiative with the driver score from the
snapshot immediately before completion and the snapshot immediately after. A
positive delta suggests the investment correlated with improvement; a zero or
negative delta prompts a deeper look.

Two caveats to keep in mind when presenting this data:

- **Correlation, not causation.** Other changes may have contributed to the
  score movement. Use voice data (see below) to add qualitative context.
- **Snapshot timing matters.** If the initiative completed between two snapshots
  that are far apart, other factors had time to influence the score.

## Add qualitative context with engineer voice

Numbers show direction; the team's own words explain why. Surface comments
related to the investment's target area to ground the quantitative data in lived
experience:

```sh
npx fit-landmark voice --manager alice@example.com
```

```text
  Voice: Alice Smith's team (latest snapshot)

    incident    3 comments
      "On-call handoffs are still rough"
      "Runbook coverage is improving but gaps remain"
      "Incident review meetings have been helpful"

    planning    2 comments
      "Sprint planning feels more realistic this quarter"
      "Design docs are getting better but still inconsistent"
```

Look for comments that name the investment directly or describe its effects.
Three comments about runbook improvements alongside a +6 reliability delta tells
a more convincing story than either data point alone.

## Verify

The assessment is complete when you can answer three questions with data:

1. **Is the target driver trending in the right direction?**
   `npx fit-landmark snapshot trend --item <driver> --manager <email>` shows a
   rising score across the snapshots that span your investment period.

2. **Did completed initiatives correlate with score changes?**
   `npx fit-landmark initiative impact --manager <email>` shows a positive delta
   for each completed initiative. Initiatives still in progress show no impact
   data -- that is expected.

3. **Do engineer comments support the quantitative signal?**
   `npx fit-landmark voice --manager <email>` surfaces comments that reference
   the investment area, adding context that pure numbers cannot provide.

If all three signals align -- rising trend, positive delta, supportive comments
-- you have evidence that the investment is working. If they diverge, the data
gives you a specific starting point for investigating why.

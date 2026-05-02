# Team Storyboard Overlay

Applies to `kata-storyboard.yml` runs: the improvement coach facilitates a
monthly team storyboard meeting with multiple participants.

## Artifact

Monthly file at `wiki/storyboard-YYYY-MNN.md` (e.g., `storyboard-2026-M04.md`)
with five sections: Challenge, Target Condition, Current Condition, Obstacles,
Experiments. Full template at
[`storyboard-template.md`](storyboard-template.md).

## Planning vs. Review

**Planning meeting** — first meeting of the month or no storyboard exists.
Create the storyboard from the template. Lead the team through: establishing or
confirming the Challenge, setting the Target Condition (measurable, by month
end), measuring the Current Condition from metrics CSVs, identifying initial
Obstacles, and planning the first Experiment.

**Review meeting** — all other team meetings. Walk through the five questions,
update Current Condition with fresh metrics, record experiment outcomes (actual
vs. expected), update Obstacles, and plan the next experiment.

## Question Wording (Team)

1. **What is the target condition?** Read the target from the storyboard. Ground
   the conversation in where the team is headed. If the target is unclear or
   expired, update it (planning mode).
2. **What is the actual condition now?** Each participant follows the
   Participant Protocol: measure with live data, record to CSV, then report via
   `Answer`. Include each metric's `status`, `μ`, and any fired-rule `signals`
   from `bunx fit-xmr analyze` in the Q2 `Ask`. Participants flag any metric
   whose status changed since the last meeting.
3. **What obstacles are preventing us from reaching the target?** Participants
   identify obstacles from their domain based on the gap between current and
   target. Obstacles are discovered through data and experiments, not
   hypothesized upfront. Prefer trace findings or live run data over accumulated
   log narratives.
4. **What is the next step? What do you expect?** For the obstacle currently
   being addressed, participants propose their next experiment. The expected
   outcome is recorded _before_ the experiment runs. Experiments should be small
   and testable within one or two daily cycles.
5. **When can we see what we learned?** Typically: next meeting, end of week, or
   after a specific workflow run.

## Metrics

Each participant records to `wiki/metrics/{agent}/{domain}/{YYYY}.csv`. See
[`metrics.md`](metrics.md) for suggested coaching-side metrics; authoritative
XmR protocol reference at
[`../../kata-metrics/references/xmr.md`](../../kata-metrics/references/xmr.md).

## Storyboard updates

Current Condition is rendered as per-metric blocks grouped under
`### {agent} — {domain}` headings (no row-per-metric overview table). For each
CSV-backed metric, write a `#### {metric_name}` block containing:

1. A one-line status header —
   `**Latest:** {value} · **Status:** {status from analyze}`. No trend arrows or
   alert glyphs — the chart shows direction and position relative to limits; the
   `Status` field carries the classification.
2. The visualization: paste the canonical 14-line Wheeler/Vacanti X+mR chart
   from `bunx fit-xmr chart <csv> --metric <name>` verbatim, wrapped in a fenced
   code block to preserve monospace alignment. The chart already labels `μ`,
   `UPL`, `LPL`, the `±1.5σ` zones, `URL`, `R`, and the run index — **do not
   restate any of those values in surrounding prose**.

   Chart the whole CSV. The process being measured is continuous; the storyboard
   month is a coaching artifact for setting a new target, not a process reset.
   Don't filter to "this month" or "trailing N days" — every new storyboard
   renders the same continuous series with whatever history has accumulated.

3. A `**Signals:**` line listing the fired Wheeler rules from
   `bunx fit-xmr analyze` (`xRule1`, `xRule2`, `xRule3`, `mrRule1`), or `—` if
   none.
4. An optional one-line note only when `status` is `signals_present` and a fired
   rule needs cross-referencing to a specific event. Stable metrics get no
   prose.

Above the agent-domain sections, write a tight `### Headlines` list naming only
the metrics whose status changed since the last meeting (new fired rule,
threshold crossed, classification flip). The Wheeler/Vacanti chart is the
visualization — agents add the cross-reference layer (e.g., "matches PR #535
burst") only where there is something to say.

## Active / Concluded partition

Obstacles and Experiments are partitioned into `### Active` and
`### Concluded (last 7 days)` subsections. The rule is mechanical:

1. When concluding an obstacle or experiment, post the verdict as a closing
   comment on the issue (see [`issue-lifecycle.md`](issue-lifecycle.md)), close
   the issue, and move the storyboard entry from `Active` to
   `Concluded (last 7 days)`. The Concluded entry is one line: status, date
   closed, one-sentence verdict, with `(#NNN)`.
2. At the start of every storyboard session, scan `Concluded (last 7 days)` and
   delete any line whose closed-date is more than 7 days before today. Date
   math, not judgment.
3. Never mix active and concluded items in the same list.

The closed issue is the permanent record. Full issue lifecycle — creation,
commenting, closing, and one-time migration — is in
[`issue-lifecycle.md`](issue-lifecycle.md).

## Participant briefing template

> "You are joining a team storyboard meeting. I will Ask you five questions;
> reply to each with Answer. Before answering Q2, record your domain metrics to
> `wiki/metrics/{your-agent}/{domain}/{YYYY}.csv`; your Answer references the
> CSV row."

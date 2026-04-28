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
   `Answer`. Include each metric's `status`, `x_bar`, and any `signals` in the
   Q2 `Ask`. Participants flag any metric whose status changed since the last
   meeting.
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

For each CSV-backed metric in the Current Condition table, generate a sparkline
with `bunx fit-xmr spark <csv> --metric <name>` and write it to the Spark
column.

For the XmR analysis block under the Current Condition table, run
`bunx fit-xmr summarize <csv> --markdown` once per agent-domain CSV and paste
the output verbatim. Add a one-line interpretive note only for metrics whose
`status` is `signals_present` or whose run-length is unusual; stable metrics get
no prose. The summarize subcommand emits the deterministic stats table — agents
add the cross-reference layer (e.g., "matches PR #535 burst") only where there
is something to say.

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

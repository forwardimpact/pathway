# Team Storyboard Overlay

Applies to `kata-storyboard.yml` runs: the improvement coach facilitates a
monthly team storyboard meeting with multiple participants. Each participant is
briefed by the coach inside the first `Ask`.

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

## Participant briefing

Broadcast this once via `Announce` at session open, before the first Q1 `Ask`
round. One broadcast reaches every participant, so Q1 Asks carry only the
question:

> "You are joining a team storyboard meeting. I will Ask you five questions;
> reply to each with Answer. Before answering Q2, record your domain metrics to
> `wiki/metrics/{your-agent}/{domain}/{YYYY}.csv`; your Answer references the
> CSV row."

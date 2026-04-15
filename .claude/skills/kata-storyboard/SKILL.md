---
name: kata-storyboard
description: >
  Toyota Kata coaching protocol for team storyboard meetings and 1-on-1
  coaching sessions. The improvement coach facilitates; domain agents
  participate. Same five coaching kata questions in both contexts.
---

# Kata Storyboard

Entry-point skill used by the improvement coach in two contexts — team
storyboard meetings (5 domain agents) and 1-on-1 coaching sessions (1 domain
agent analyzing its own trace). Both use the same five coaching kata questions.

## When to Use

Your Assess section routed you to a coaching context: team storyboard meeting or
1-on-1 coaching session.

## Checklists

<read_do_checklist goal="Prepare for the coaching session">

- [ ] Read the current month's storyboard (`wiki/storyboard-YYYY-MNN.md`). If
      none exists, this is a planning meeting.
- [ ] Identify which metrics CSVs to review from `wiki/metrics/`.
- [ ] For 1-on-1: identify the agent's most recent trace for analysis.

</read_do_checklist>

<do_confirm_checklist goal="Verify coaching session quality">

- [ ] All five coaching kata questions were addressed.
- [ ] Current condition updated with numbers from metrics CSVs (not narrative).
- [ ] For team meetings: storyboard file updated and committed.
- [ ] For 1-on-1: agent's findings written to its own memory.
- [ ] Experiment expected outcome recorded _before_ the experiment runs.

</do_confirm_checklist>

## Storyboard Artifact

Monthly file at `wiki/storyboard-YYYY-MNN.md` (e.g., `storyboard-2026-M04.md`)
with five sections: Challenge, Target Condition, Current Condition, Obstacles,
Experiments. Full template at
[`references/storyboard-template.md`](references/storyboard-template.md).

## Meeting Modes

Three modes, all using the five coaching kata questions:

**Planning meeting** — first meeting of the month or no storyboard exists.
Create the storyboard. Lead the team through: establishing/confirming the
Challenge, setting the Target Condition (measurable, by month end), measuring
the Current Condition from metrics CSVs, identifying initial Obstacles, and
planning the first Experiment.

**Review meeting** — all other team meetings. Walk through the five questions
(see [`references/coaching-protocol.md`](references/coaching-protocol.md)),
update Current Condition with fresh metrics, record experiment outcomes (actual
vs. expected), update Obstacles, and plan the next experiment.

**1-on-1 coaching** — coach facilitates, one domain agent participates. The
agent runs `kata-trace` on its own recent trace during the session. The five
questions guide the agent's reflection: what were you trying to achieve? What
actually happened (measured)? What obstacles did you encounter? What will you
try next? When will you know?

## Process

1. **Read the storyboard.** Load `wiki/storyboard-YYYY-MNN.md`. If it does not
   exist, this is a planning meeting — create it from
   [`references/storyboard-template.md`](references/storyboard-template.md).
2. **Gather metrics.** Read relevant CSVs from `wiki/metrics/` for each
   participating agent's domain.
3. **Run the five questions.** Follow
   [`references/coaching-protocol.md`](references/coaching-protocol.md) for the
   appropriate mode.
4. **Update the storyboard.** Write updated Current Condition, Obstacles, and
   Experiments sections back to the storyboard file.
5. **Commit.** Commit storyboard changes as part of the wiki push.

## Memory: what to record

Append to the current week's log (see agent profile for the file path):

- **Meeting type** — Planning, review, or 1-on-1 (with which agent)
- **Current condition** — Key numbers from metrics CSVs reviewed
- **Obstacle addressed** — Which obstacle was the focus
- **Experiment status** — Outcome of prior experiment, next experiment planned
- **Metrics** — Record coaching-specific measurements (e.g.,
  `meetings_facilitated`, `experiments_active`) to
  `wiki/metrics/improvement-coach/coaching/` per the
  [`kata-metrics`](../kata-metrics/SKILL.md) protocol. The coach records
  coaching activity metrics, not domain metrics — domain agents record their own
  domain metrics via their own entry-point skills.

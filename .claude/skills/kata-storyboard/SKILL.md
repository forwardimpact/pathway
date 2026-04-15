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

Entry-point skill for the improvement coach's two facilitation contexts: team
storyboard meetings (daily-meeting workflow) and 1-on-1 coaching sessions
(coaching-session workflow).

## Checklists

<read_do_checklist goal="Prepare for the coaching session">

- [ ] Detect mode: call RollCall — success means facilitated mode,
      tool-not-found means solo mode.
- [ ] Read the current month's storyboard (`wiki/storyboard-YYYY-MNN.md`). If
      none exists, this is a planning meeting.
- [ ] Identify which metrics CSVs to review from `wiki/metrics/`.
- [ ] For 1-on-1: identify the agent's most recent trace for analysis.

</read_do_checklist>

<do_confirm_checklist goal="Verify coaching session quality">

- [ ] All five coaching kata questions were addressed.
- [ ] In facilitated mode: every coaching question reached participants via Tell
      or Share — no direct wiki/metrics file reads for domain data.
- [ ] Current condition updated with numbers from metrics CSVs (not narrative).
- [ ] For team meetings: storyboard file updated and committed.
- [ ] For 1-on-1: agent's findings written to its own memory.
- [ ] Experiment expected outcome recorded _before_ the experiment runs.
- [ ] In facilitated mode: Conclude called with session summary.

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

1. **Detect mode.** Call RollCall. If it succeeds, you are in facilitated mode —
   use orchestration tools for all participant interaction. If the call fails
   with tool-not-found, you are in solo mode — use direct file reads (existing
   behavior).
2. **Read the storyboard.** Load `wiki/storyboard-YYYY-MNN.md`. If it does not
   exist, this is a planning meeting — create it from
   [`references/storyboard-template.md`](references/storyboard-template.md).
3. **Run the five questions.** Follow
   [`references/coaching-protocol.md`](references/coaching-protocol.md). In
   facilitated mode, use the orchestration tools specified in each question's
   Facilitation subsection — Share to broadcast Q1, Tell to pose Q2–Q5 to
   individual agents, collect agent responses (agents respond via Share). In
   solo mode, read metrics and wiki files directly.
4. **Update the storyboard.** Write updated Current Condition, Obstacles, and
   Experiments sections back to the storyboard file.
5. **Evaluate coaching need (team meetings only).** Review the session's
   findings. If a participant would benefit from a 1-on-1 coaching session —
   persistent obstacles, unanalyzed traces, or stalled experiments — trigger
   `coaching-session.yml` via
   `gh workflow run coaching-session.yml -f agent=<name>`. Skip this step in
   1-on-1 sessions.
6. **Commit.** Commit storyboard changes as part of the wiki push.
7. **Conclude (facilitated mode only).** Call Conclude with a session summary
   covering: meeting type, key metrics reviewed, obstacles addressed,
   experiments planned, and any coaching session triggered.

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

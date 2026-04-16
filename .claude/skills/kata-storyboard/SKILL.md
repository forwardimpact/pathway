---
name: kata-storyboard
description: >
  Toyota Kata coaching protocol for team storyboard meetings and 1-on-1
  coaching sessions. Shared by the improvement coach (facilitator) and all
  domain agents (participants). Same five coaching kata questions in both
  contexts.
---

# Kata Storyboard

Shared entry-point skill for storyboard meetings. The improvement coach
facilitates; domain agents participate. Both roles load this skill — the
facilitator follows the Facilitator Process, participants follow the Participant
Protocol. Both use the same five coaching kata questions.

## When to Use

**Facilitator**: Entry-point skill for the improvement coach's two facilitation
contexts — team storyboard meetings (daily-meeting workflow) and 1-on-1 coaching
sessions (coaching-session workflow).

**Participant**: Loaded automatically when you join a storyboard meeting. Follow
the Participant Protocol when the coach poses questions via orchestration tools.

## Checklists

### Facilitator

<read_do_checklist goal="Prepare for the coaching session">

- [ ] Detect mode: call RollCall — success means facilitated mode,
      tool-not-found means solo mode.
- [ ] Read the current month's storyboard (`wiki/storyboard-YYYY-MNN.md`). If
      none exists, this is a planning meeting.
- [ ] Identify which metrics CSVs to review from `wiki/metrics/`.
- [ ] Run `bunx fit-xmr analyze --format json` against each metrics CSV and
      record the output.
- [ ] For 1-on-1: identify the agent's most recent trace for analysis.

</read_do_checklist>

<do_confirm_checklist goal="Verify coaching session quality">

- [ ] All five coaching kata questions were addressed.
- [ ] In facilitated mode: every coaching question reached participants via Tell
      or Share — no direct wiki/metrics file reads for domain data.
- [ ] Current condition updated with numbers from metrics CSVs (not narrative).
- [ ] Current condition includes XmR `status` and signal descriptions for each
      metric with sufficient data. Metrics with `insufficient_data` are noted.
- [ ] Coaching metrics appended to CSV (see Facilitator Process step 6).
- [ ] For team meetings: storyboard file updated and committed.
- [ ] For 1-on-1: agent's findings written to its own memory.
- [ ] Experiment expected outcome recorded _before_ the experiment runs.
- [ ] In facilitated mode: Conclude called with session summary.

</do_confirm_checklist>

### Participant

<do_confirm_checklist goal="Verify participation quality">

- [ ] Q2 data gathered from live sources, not memory or prior logs.
- [ ] Domain metrics appended to CSV before sharing (step 2).
- [ ] Metrics reported via Share match the CSV rows just written.
- [ ] Q3 obstacles grounded in data or trace findings, not narrative.
- [ ] Q4 experiment has a recorded expected outcome.

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

## Facilitator Process

1. **Detect mode.** Call RollCall. If it succeeds, you are in facilitated mode —
   use orchestration tools for all participant interaction. If the call fails
   with tool-not-found, you are in solo mode — use direct file reads (existing
   behavior).
2. **Read the storyboard.** Load `wiki/storyboard-YYYY-MNN.md`. If it does not
   exist, this is a planning meeting — create it from
   [`references/storyboard-template.md`](references/storyboard-template.md).
3. **Run XmR analysis.** For every CSV in `wiki/metrics/`, run:
   `bunx fit-xmr analyze wiki/metrics/{agent}/{domain}/{YYYY}.csv --format json`
   Use `status`, `signals`, and `x_bar` from the JSON output when reporting the
   Condition. If a metric returns `insufficient_data`, note it. In facilitated
   mode, include XmR summaries in the Q2 Tell to each agent.
4. **Run the five questions.** Follow
   [`references/coaching-protocol.md`](references/coaching-protocol.md). In
   facilitated mode, use orchestration tools — Share to broadcast Q1, Tell to
   pose Q2–Q5 to individual agents, collect agent responses (agents respond via
   Share). In solo mode, read metrics and wiki files directly.
5. **Update the storyboard.** Write updated Current Condition, Obstacles, and
<<<<<<< Updated upstream
   Experiments sections. For each CSV-backed metric in the Current Condition
   table, generate a sparkline with `bunx fit-xmr spark <csv> --metric <name>`
   and write it to the Spark column.
=======
   Experiments sections back to the storyboard file.
>>>>>>> Stashed changes
6. **Record coaching metrics.** Append coaching activity metrics (e.g.,
   `meetings_facilitated`, `experiments_active`, `agents_participating`) to
   `wiki/metrics/improvement-coach/coaching/{YYYY}.csv` per the
   [`kata-metrics`](../kata-metrics/SKILL.md) protocol. See
   [`references/metrics.md`](references/metrics.md) for suggested metrics.
7. **Evaluate coaching need (team meetings only).** Review the session's
   findings. If a participant would benefit from a 1-on-1 coaching session —
   persistent obstacles, unanalyzed traces, or stalled experiments — trigger
   `coaching-session.yml` via
   `gh workflow run coaching-session.yml -f agent=<name>`. Skip this step in
   1-on-1 sessions.
8. **Commit.** Commit storyboard changes as part of the wiki push.
9. **Conclude (facilitated mode only).** Call Conclude with a session summary
   covering: meeting type, key metrics reviewed, obstacles addressed,
   experiments planned, and any coaching session triggered.

## Participant Protocol

Follow these steps when participating in a storyboard meeting. You have full
file-system access — use it to measure and record, not just report.

1. **Prepare for Q2.** When the coach poses Q2 ("What is the actual condition
   now?"), gather your domain's current measured state. Use live data (`gh`,
   `bun`, repo files) — not memory or narrative.
2. **Record metrics to CSV.** Before sharing your Q2 report, append one row per
   metric to your domain's CSV at
   `wiki/metrics/{your-agent}/{domain}/{YYYY}.csv` per the
   [`kata-metrics`](../kata-metrics/SKILL.md) protocol. Create the directory and
   header row if the file does not exist. This is the authoritative record —
   your Share message summarizes it, the CSV persists it.
3. **Share measured data.** Report numbers via Share. Reference the CSV rows you
   just wrote. Use counts and durations — not narratives like "improving" or
   "stable."
4. **Ground obstacles in data.** For Q3, identify obstacles from the gap between
   your measured current condition and the target. Prefer trace findings or live
   run data over accumulated log narratives.
5. **Propose testable experiments.** For Q4, propose small experiments with
   expected outcomes that can be verified in one or two daily cycles.

## Memory: what to record

Append to the current week's log (see agent profile for the file path):

- **Meeting type** — Planning, review, or 1-on-1 (with which agent)
- **Current condition** — Key numbers from metrics CSVs reviewed
- **Obstacle addressed** — Which obstacle was the focus
- **Experiment status** — Outcome of prior experiment, next experiment planned
- **Metrics** — Facilitator: record coaching activity metrics per step 6.
  Participants: record domain metrics per Participant Protocol step 2.

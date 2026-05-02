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

Current Condition is rendered as per-metric blocks under
`### {agent} — {domain}` headings (no overview table). For each CSV-backed
metric, write a `#### {metric_name}` block containing:

1. A status header — `**Latest:** {value} · **Status:** {status}`. No trend
   arrows or alert glyphs.
2. The visualization: paste the 14-line X+mR chart from
   `bunx fit-xmr chart <csv> --metric <name>` verbatim in a fenced code block.
   The chart labels `μ`, `UPL`, `LPL`, `±1.5σ`, `URL`, `R`, and the run index —
   **do not restate any of these in prose**.

   Chart the whole CSV. The process is continuous; the storyboard month is a
   coaching artifact, not a process reset. Don't filter to "this month" — every
   storyboard renders the same series.

3. A `**Signals:**` line listing fired Wheeler rules (`xRule1`, `xRule2`,
   `xRule3`, `mrRule1`), or `—` if none.
4. An optional one-line note only when `status` is `signals_present` and a fired
   rule needs cross-referencing. Stable metrics get no prose.

Above the agent-domain sections, write a tight `### Headlines` list naming only
metrics whose status changed since the last meeting. Agents add cross-reference
notes (e.g. "matches PR #535 burst") only where they help.

## Active / Concluded partition

Obstacles and Experiments split into `### Active` and
`### Concluded (last 7 days)`. Mechanical rule:

1. Concluding an item — close the issue with a verdict comment (see
   [`issue-lifecycle.md`](issue-lifecycle.md)), and move the storyboard entry to
   `Concluded (last 7 days)` as one line: status, close date, one-sentence
   verdict, `(#NNN)`.
2. At session start, drop any concluded line older than 7 days. Date math, not
   judgment.
3. Never mix active and concluded in the same list.

The closed issue is the permanent record; full lifecycle in
[`issue-lifecycle.md`](issue-lifecycle.md).

## Q3 obstacle routing

Per SKILL.md Step 7, pick a route per obstacle (parallel allowed):

| Trigger                                                                          | Route      |
| -------------------------------------------------------------------------------- | ---------- |
| Obstacle would change a shared artifact (metric, routing rule, boundary, policy) | Discussion |
| Same question surfaced in ≥2 agents' Q3 answers                                  | Discussion |
| Persistent obstacle the agent owns; unanalyzed trace; stalled experiment         | Coaching   |

**Worked example — run 25247279159, 2026-05-02.** SE/RE/TW/PM each flagged a
canonical-11 metric (`prs_actioned`, `releases_cut`, `errors_found`,
`issues_created`). All four mapped to one shared artifact — right route: one
Discussion, not four parallel coaching dispatches.

## Participant briefing template

> "You are joining a team storyboard meeting. I will Ask you five questions;
> reply to each with Answer. Before answering Q2, record your domain metrics to
> `wiki/metrics/{your-agent}/{domain}/{YYYY}.csv`; your Answer references the
> CSV row."

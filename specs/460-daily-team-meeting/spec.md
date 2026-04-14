# Spec 460 — Daily Team Meeting

## Problem

Spec 450 gave each kata agent autonomy to assess its domain and choose its own
next action. Spec 440 gave agents structured tools for multi-agent facilitated
sessions. But agents still work in isolation. Each wakes on its schedule, reads
the wiki, does its best work, writes back, and goes to sleep. Coordination is
passive and asynchronous — an agent discovers what its teammates did by reading
summaries left behind hours earlier.

This creates three visible problems in the wiki:

- **No shared plan.** Each agent independently assesses its domain every run,
  but nobody decides _what the team should focus on this week_. The
  security-engineer may spend Tuesday auditing CI/CD while the staff-engineer is
  implementing a spec that will restructure CI/CD — because neither knew the
  other's intent. Individual assessment (spec 450) solved _per-agent_ planning;
  it did not solve _cross-agent_ planning.

- **Slow feedback loops.** The "Observations for Teammates" pattern in wiki
  summaries works, but observations routinely sit for days before the target
  agent acknowledges them. The technical-writer flagged a protobufjs observation
  for the security-engineer that went 12 days without response. When the only
  communication channel is "write a note, hope they read it tomorrow,"
  cross-agent feedback degrades into a suggestion box.

- **No weekly rhythm.** The wiki already uses ISO weeks for log files, and each
  agent's coverage map reveals weekly patterns. But there is no artifact that
  captures _what the team intends to accomplish this week_ versus _what each
  agent happened to pick on its own_. Without a shared plan, there is no way to
  distinguish "we chose to defer this" from "nobody noticed it."

The Toyota Kata model prescribes team-level target conditions, not just
individual ones. Spec 450 gave agents the ability to grasp their own current
condition and choose their next experiment. This spec gives the _team_ the
ability to establish a shared target condition for the week and review progress
toward it daily.

## Proposal

Add a **daily team meeting** workflow that runs before individual agent
workflows. The meeting uses the `facilitate` execution mode from spec 440 to
bring all six agents together with a facilitator. The meeting produces and
maintains a **weekly plan** (`wiki/plan-W{VV}.md`) — a shared artifact that
individual agents consult during their Assess phase.

```
Current:  Agent wakes → reads wiki → assesses own domain → acts
Proposed: Meeting runs → team reviews/creates plan → agents wake → read plan → assess → act
```

### Meeting structure

The facilitator runs a structured agenda. The meeting has two modes depending on
whether a weekly plan already exists for the current ISO week.

**Monday (or first meeting of the week) — Planning meeting:**

1. **Roll call** — Facilitator uses `RollCall()` to discover participants.
2. **Status round** — Each agent shares a brief status via `Share()`: what they
   accomplished since last meeting, any blockers, and any observations for
   teammates. Agents read their own summary and the current week's log to
   prepare this.
3. **Review last week** — If a plan from the prior week exists
   (`plan-W{VV-1}.md`), the facilitator asks agents to assess which items were
   completed, deferred, or abandoned. Each agent responds for its own items via
   `Share()`.
4. **Identify priorities** — The facilitator asks each agent to propose its top
   priorities for the week based on current domain state. Agents share via
   `Share()`.
5. **Resolve dependencies** — The facilitator identifies cross-agent
   dependencies from the proposed priorities and uses `Tell()` to coordinate
   directly between affected agents. For example, if the staff-engineer plans to
   implement a spec that touches CI, the facilitator coordinates with the
   release-engineer on sequencing.
6. **Write the plan** — The facilitator synthesizes priorities into
   `wiki/plan-W{VV}.md` and concludes the meeting via `Conclude()`.

**Tuesday–Sunday — Daily review meeting:**

1. **Roll call** — Same as above.
2. **Status round** — Each agent shares brief status: what they did since
   yesterday, any new blockers.
3. **Plan review** — The facilitator reads the current `plan-W{VV}.md` and asks
   each agent to report progress on their items. Agents respond via `Share()`.
4. **Adjust** — If priorities have shifted (e.g., a critical vulnerability
   appeared, a blocking PR was merged), the facilitator updates the plan with
   adjustments and rationale.
5. **Conclude** — Facilitator writes any plan updates to the wiki and concludes
   via `Conclude()`.

### Weekly plan format

The weekly plan lives at `wiki/plan-W{VV}.md` (e.g., `plan-W16.md`) and follows
a fixed structure:

```markdown
# Team Plan — 2026-W16

ISO week 2026-W16 (Mon 2026-04-13 -- Sun 2026-04-19).

## Team Priorities

Ordered by impact. Items higher in the list take precedence when agents must
choose between competing actions during their individual Assess phase.

1. Land spec 440 implementation (staff-engineer; unblocks facilitate mode)
2. Cut releases for 6 packages pending on main (release-engineer)
3. Resolve protobufjs compatibility blocker (security-engineer)
4. Complete product evaluation for Basecamp (product-manager)

## Agent Focus Areas

### security-engineer
- [ ] Resolve protobufjs compatibility blocker (carry-forward from W15)
- [ ] Audit CI/CD topic (lowest coverage)

### technical-writer
- [ ] Review codegen internals for accuracy
- [ ] Follow up on stale teammate observations

### product-manager
- [ ] Complete Basecamp product evaluation
- [ ] Triage new issues from evaluation findings

### staff-engineer
- [ ] Implement spec 440 part 01 (infrastructure)
- [ ] Implement spec 440 part 02 (supervisor migration)

### release-engineer
- [ ] Cut pending releases after spec 440 lands
- [ ] Monitor CI health after implementation PRs merge

### improvement-coach
- [ ] Analyze staff-engineer traces from spec implementation
- [ ] Check decision-quality invariants from spec 450

## Dependencies

- staff-engineer spec 440 implementation blocks release-engineer releases
- security-engineer protobufjs resolution blocks technical-writer from
  clearing the stale observation

## Carry-Forward

Items deferred from prior week with rationale.

- (none) | (items from W15 plan review)

## Daily Notes

### Monday
Plan created. [summary of planning discussion]

### Tuesday
[Status updates, adjustments, rationale for changes]
```

### Agent profile changes

Each agent's **Assess** section gains a new top-level step before the existing
priority framework:

> 0. **Read the weekly plan.** Check `wiki/plan-W{VV}.md` for this ISO week. If
>    it exists, review your focus areas and the team priorities. Weight your
>    priority assessment toward items that appear in the plan. If no plan
>    exists, proceed with your standard priority framework.

This is advisory, not directive. The plan informs the agent's assessment but
does not override it. If an agent discovers an urgent condition during its
Assess phase (e.g., a critical CVE), it acts on that regardless of what the plan
says — urgency always wins. The agent notes the deviation in its decision log
with rationale.

The weekly plan is a _shared target condition_, not a task list. It tells agents
what the team agreed matters most, so that when an agent faces a choice between
two roughly-equal priority actions, it picks the one aligned with the team plan.

### Workflow scheduling

The daily meeting runs before all individual agent workflows:

| Workflow          | Schedule            | Mode       |
| ----------------- | ------------------- | ---------- |
| **daily-meeting** | Daily 03:00 UTC     | facilitate |
| security-engineer | Daily 04:07 UTC     | run        |
| technical-writer  | Daily 05:37 UTC     | run        |
| product-manager   | Daily 06:23 UTC     | run        |
| staff-engineer    | Daily 07:11 UTC     | run        |
| release-engineer  | Daily 08:43 UTC     | run        |
| improvement-coach | Wed & Sat 10:47 UTC | run        |

The meeting runs at 03:00 UTC — over an hour before the first individual
workflow. This gives the plan time to be committed and pushed to the wiki before
agents start reading it.

### Facilitator profile

A new agent profile `daily-meeting-facilitator.md` defines the facilitator role.
The facilitator is not a seventh team member — it is a coordination role that
runs only during the meeting. It has no domain, no skills, and no Assess
section. Its sole purpose is to:

1. Run the meeting agenda (planning or review, depending on whether a plan
   exists for the current week)
2. Elicit status and priorities from each agent
3. Identify and resolve cross-agent dependencies
4. Write or update the weekly plan in the wiki
5. Keep the meeting focused and time-bounded

The facilitator reads all agent summaries and the current week's logs before the
meeting starts, so it arrives with full context on what each agent has been
doing.

### What this is really about

The kata system is named after Toyota Kata because it follows the same
improvement pattern: understand the direction, grasp the current condition,
establish the next target condition, and experiment toward it. Spec 450 gave
individual agents the ability to grasp _their own_ current condition and choose
_their own_ next experiment. But Toyota Kata is a _team_ practice — the target
condition is shared, the experiments are coordinated, and the daily coaching
cycle keeps the team aligned.

The daily meeting is the team-level coaching cycle. The weekly plan is the
shared target condition. The individual agent runs are the experiments. The
meeting creates a feedback loop that is faster than passive wiki reading (hours,
not days) and more structured than "Observations for Teammates" (agenda-driven,
not ad hoc).

This is not about adding ceremony. The meeting is short — status round plus plan
review or creation. It is about giving the team a mechanism to _collectively
decide_ what matters, rather than having six agents independently guess. The
weekly plan makes implicit priorities explicit and implicit dependencies
visible.

### What does not change

- **Individual agent autonomy.** Agents still assess their own domain and choose
  their own action. The plan informs, it does not command.
- **Skills.** No kata skills are modified. The meeting is a new workflow using
  facilitate mode, not a new skill.
- **Fix-or-spec discipline.** Unchanged.
- **Trust boundary.** The product manager remains the sole external merge point.
- **Trace capture.** The meeting produces its own trace artifact.
- **Wiki file format.** Summaries and weekly logs are unchanged. The plan is a
  new file type added alongside them.
- **Decision logging.** Agents still log Surveyed/Alternatives/Chosen/Rationale.
  The plan becomes one of the things surveyed.

## Scope

### Affected

- `.github/workflows/` — new `daily-meeting.yml` workflow using facilitate mode
- `.claude/agents/daily-meeting-facilitator.md` — new facilitator agent profile
  (coordination role, no domain skills)
- `.claude/agents/security-engineer.md` — Assess step 0 (read weekly plan)
- `.claude/agents/technical-writer.md` — Assess step 0
- `.claude/agents/product-manager.md` — Assess step 0
- `.claude/agents/staff-engineer.md` — Assess step 0
- `.claude/agents/release-engineer.md` — Assess step 0
- `.claude/agents/improvement-coach.md` — Assess step 0
- `wiki/MEMORY.md` — document `plan-W{VV}.md` file convention
- `KATA.md` — add daily meeting to Workflows table, describe team planning

### Excluded

- Skill content (`kata-*/SKILL.md`) — no skill changes
- `kata-action` composite action — may need a facilitate mode variant, but that
  is an implementation detail for the design phase, not a spec concern
- `fit-eval` CLI — facilitate mode already specified in spec 440
- Individual agent scheduling — times unchanged
- Invariants — the improvement coach already audits decision quality; the
  meeting's contribution to decision quality is indirect (better-informed agents
  make better decisions) rather than a new invariant to check

## Dependencies

- **Spec 440 (facilitate mode)** — the meeting requires the `facilitate`
  execution mode, `RollCall()`, `Share()`, `Tell()`, and `Conclude()` tools.
  This spec cannot be implemented until spec 440 is implemented.
- **Spec 450 (agent-centered workflows)** — the Assess framework that the plan
  integrates into. Must be implemented first.

## Success Criteria

1. **Daily meeting workflow** exists at `.github/workflows/daily-meeting.yml`,
   scheduled at 03:00 UTC daily, using facilitate mode with all six agents and a
   facilitator.
2. **Facilitator profile** exists at
   `.claude/agents/daily-meeting-facilitator.md` with a structured meeting
   agenda covering both planning and review modes.
3. **Weekly plan file** (`wiki/plan-W{VV}.md`) is created on the first meeting
   of each ISO week with sections: Team Priorities, Agent Focus Areas (with
   checkboxes), Dependencies, Carry-Forward, Daily Notes.
4. **Plan review** occurs on subsequent daily meetings — progress is noted,
   checkboxes updated, adjustments recorded with rationale in the Daily Notes
   section.
5. **Agent profiles** each include an Assess step 0 that reads the weekly plan
   and weights priority assessment toward plan-aligned items.
6. **MEMORY.md** documents the `plan-W{VV}.md` convention alongside the existing
   summary and weekly log conventions.
7. **KATA.md** includes the daily meeting in the Workflows table and describes
   the team planning cycle.
8. **Meeting trace** is captured as an NDJSON artifact, giving the improvement
   coach visibility into meeting quality.
9. **`bun run check` and `bun run test` pass** with no regressions.

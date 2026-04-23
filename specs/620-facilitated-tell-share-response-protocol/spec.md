# Spec 620 — Facilitated Tell→Share Response Protocol for 1-on-1 Coaching

## Problem

1-on-1 coaching sessions (`.github/workflows/kata-coaching.yml`) end prematurely
after Q1. The improvement coach poses the first of the five coaching kata
questions via `Tell`, the participant agent produces a polished text answer
inside its own turn stream, and the session then stalls in silent deadlock — the
participant never calls `Share`, the facilitator waits forever on
`messageBus.waitForMessages`, and the Agent SDK reports `result: success` while
4 of 5 questions are never asked.

The same improvement-coach agent, using the same `kata-storyboard` skill, runs
team storyboard meetings successfully (all five questions, many Share round
trips, clean Conclude). The difference is not the agent or the skill; it is what
the coach's `Tell` message body contains, and what the participant's instruction
surface says about how to respond to a `Tell`.

### Evidence — two failing coaching runs, same pathway

Run
[`24850558182`](https://github.com/forwardimpact/monorepo/actions/runs/24850558182)
(2026-04-23, staff-engineer, opus 4.6, $0.90, 3m23s):

| Metric                              | Count      |
| ----------------------------------- | ---------- |
| `mcp__orchestration__Tell` (coach)  | 1          |
| `mcp__orchestration__Share` (agent) | **0**      |
| `mcp__orchestration__Conclude`      | **0**      |
| Coaching questions reached (Q1..Q5) | **1 of 5** |

The single `Tell` at turn 40 ended with:

> "Analyze the trace and come back with: 1. What the run was trying to
> accomplish 2. What actually happened (quote specific tool calls, errors, or
> token counts from the trace) 3. Any patterns you notice — good or concerning
> Take your time with the trace. Numbers over narratives."

The participant ran `kata-trace`, produced a 1 500-word analysis at turn 120
that ended with "Ready for the five questions whenever you are." — then emitted
`{"type":"result","subtype":"success","num_turns":29}` with no `Share` call.

Run
[`24844117144`](https://github.com/forwardimpact/monorepo/actions/runs/24844117144)
(2026-04-23, staff-engineer, opus 4.6, $0.21, 30s):

| Metric                              | Count      |
| ----------------------------------- | ---------- |
| `mcp__orchestration__Tell` (coach)  | 1          |
| `mcp__orchestration__Share` (agent) | **0**      |
| `mcp__orchestration__Conclude`      | **0**      |
| Coaching questions reached (Q1..Q5) | **1 of 5** |

The single `Tell` at turn 28 ended with:

> "What was the goal of your most recent workflow run? What outcome were you
> aiming for?"

The participant produced a polished three-paragraph answer at turn 46 — as plain
text. `result: success` at num_turns 5. No `Share`.

### Evidence — the successful baseline

Run
[`24824149683`](https://github.com/forwardimpact/monorepo/actions/runs/24824149683)
(2026-04-23, team storyboard, sonnet 4.6, $1.75, 8m4s):

| Metric                               | Count      |
| ------------------------------------ | ---------- |
| `mcp__orchestration__Tell` (coach)   | 18         |
| `mcp__orchestration__Share` (agents) | **34**     |
| `mcp__orchestration__Conclude`       | **1**      |
| Coaching questions reached (Q1..Q5)  | **5 of 5** |

Every Q2 `Tell` from the facilitator ends with the same closing clause. A
representative one, turn 317 to staff-engineer:

> "Record to `wiki/metrics/staff-engineer/specs/2026.csv`, **then Share**."

All five Q2 Tells in this run end with the two-word directive "then Share". All
five participants responded via `Share` within two turns. Q3, Q4 and Q5 Tells no
longer need the directive — by then the round-trip pattern is established in the
conversation.

Same agent. Same skill. The only thing that changed between coaching (0 Shares)
and storyboard (34 Shares) is whether the word "Share" appeared in the `Tell`
body. The protocol is being taught inline, per-message, and only by accident.

### Evidence — no participant-side instruction teaches the protocol

The participant has four possible sources of guidance about how to respond to a
`Tell`:

1. **The Agent SDK system prompt.** Silent — `Share` and `Tell` are not
   mentioned at the SDK layer.
2. **The facilitated-agent system prompt**
   (`libraries/libeval/src/facilitator.js:36`,
   `FACILITATED_AGENT_SYSTEM_PROMPT`). Reads: "Share broadcasts your message to
   all participants. Tell sends a direct message to one participant. Ask sends a
   question to the facilitator — you block until answered." Describes tool
   semantics; does not say "when the facilitator sends you a Tell, respond via
   Share before finishing your turn." No symmetric rule to the facilitator's own
   "do not proceed until you have received responses."
3. **The agent-side tool descriptions**
   (`libraries/libeval/src/orchestration-toolkit.js:196-206`). `Share`:
   "Broadcast a message to all participants." `Tell`: "Send a direct message to
   one participant." Neither names the Tell→Share response pattern.
4. **The `kata-storyboard` skill, Participant Protocol section**
   (`.claude/skills/kata-storyboard/SKILL.md` § Participant Protocol, lines
   140–162). Five steps, all scoped to team-storyboard Q2: "Prepare for Q2",
   "Record metrics to CSV", "Share measured data", "Ground obstacles in data",
   "Propose testable experiments". The "1-on-1 Coaching Adaptation" section
   lives in
   `.claude/skills/kata-storyboard/references/coaching-protocol.md:60-71` and is
   a question-rewording table ("Q1: What were you trying to achieve in this
   run?") with no participant-side steps. The sentence "In facilitated mode, the
   same tool pattern applies — Tell to pose, Share to respond" appears in that
   same reference, but only the coach reads `coaching-protocol.md` during its
   own Facilitator Process.

The participant does not load `kata-storyboard` at all. In the two failing runs,
the staff-engineer invoked `kata-trace` (its own trace-analysis skill); no
`Skill("kata-storyboard")` call exists in its session. So even the
team-storyboard Participant Protocol, such as it is, is not in its context.

### Evidence — the workflow task-text over-directs Q1

`.github/workflows/kata-coaching.yml` prescribes the coach's opening move in its
`task-text`:

> "Facilitate a 1-on-1 coaching session with the participant agent. Guide them
> through the five coaching kata questions. **Have them analyze their own most
> recent trace using kata-trace.** Help them identify obstacles and design their
> next experiment."

Contrast `.github/workflows/kata-storyboard.yml`, whose task-text is a single
sentence: "Facilitate the team storyboard meeting."

The coaching task-text drives the coach to front-load trace analysis into Q1 as
a work assignment rather than posing the kata question (Q1: "What were you
trying to achieve in this run?") and letting the participant reach for
`kata-trace` under Q2 ("What actually happened?") as the skill already
prescribes. In run `24850558182` this front-loading caused the participant to
spend 29 of its ~50-turn budget producing a trace analysis before any `Share`
could happen — even if the Tell→Share protocol had been honoured, Q2–Q5 would
have had no runway.

### Evidence — silent deadlock mechanism

`libraries/libeval/src/facilitator.js` models the session as two cooperating
loops:

- `#facilitatorLoop` (line 232) blocks on `eventQueue.dequeue()` and only
  resumes the coach when a participant has called `Share`/`Ask` or emitted a
  `lifecycle:turn_complete` that drains into a facilitator message.
- `#runAgent` (line 184) blocks on `messageBus.waitForMessages(agent.name)`
  until the coach sends a `Tell`/`Share`.

When an agent finishes its local turn loop without having called `Share`, the
facilitator receives a `lifecycle:turn_complete` event that drains zero messages
from the bus and falls through without advancing the coach. The facilitator's
own system prompt tells it "do not proceed to the next question or call Conclude
until you have received responses from participants" (`facilitator.js:30-33`),
so the coach correctly waits. The two loops now wait on each other.

The session can only exit via the workflow's `timeout-minutes: 30`. Worse, the
outer Agent SDK emits `result: success` for each participant whose own turn loop
terminated normally, so `bunx fit-trace overview` reports `"result":"success"`
on a run that completed 20 % of its goal. A kata-trace audit that trusts the
SDK's success flag reports a green run.

### Who is affected

- **Every kata-coaching workflow run.** The Tell→Share gap triggers on the first
  question of every 1-on-1 session.
- **Every agent that is ever a participant in a facilitated mode.** Today the
  gap is invisible in team-storyboard runs because the coach's Q2 Tell template
  contains "then Share"; any future facilitator that does not use that specific
  phrasing will reproduce the coaching failure.
- **The improvement-coach's coaching cadence as a whole.** Coaching is how
  domain agents reflect on their own traces. If it silently fails, agents do not
  reflect, improvements do not surface, and the Kata cadence is performative.
- **Anyone relying on workflow `result:success` for monitoring.** The SDK
  success flag does not reflect coaching completion.

## Proposal

Make the Tell→Share response protocol a first-class, mandatory contract in
facilitated mode — stated once at the lowest applicable layer, reinforced once
at the skill layer, and testable via an invariant. Remove the workflow task-text
that over-directs Q1 so the coaching procedure matches the skill.

### A symmetric participant protocol rule

The facilitator's system prompt already enforces a round-trip expectation on its
own side (`facilitator.js:30-33`). The participant side must gain the symmetric
rule: when the facilitator sends a `Tell`, the participant's turn is not
complete until the participant has called `Share` with its response. This rule
is generic to facilitated mode — not specific to storyboards or to coaching —
and therefore belongs at the lowest instruction layer that is universal to all
facilitated agents. Which exact layer carries the rule (tool description,
facilitated-agent system prompt, skill Participant Protocol, or several in
combination) is a design decision.

### Universal Participant Protocol in `kata-storyboard`

The `kata-storyboard` skill's Participant Protocol must apply to both team
storyboard and 1-on-1 coaching contexts. The protocol must state the Tell→Share
response rule in a form that is not conditional on the meeting mode. The "1-on-1
Coaching Adaptation" section must explicitly invoke the Participant Protocol
rather than implying its inheritance.

Participants in 1-on-1 coaching must load the `kata-storyboard` skill (today
they do not) so that the Participant Protocol is in their context. The mechanism
— whether the facilitator's opening `Tell` instructs the participant to load the
skill, whether the workflow task injects the skill directly into the agent
session, or whether the coach includes the protocol verbatim in its first `Tell`
— is a design decision.

### Reduced task-text for `kata-coaching.yml`

The coaching workflow's `task-text` must not prescribe Q1 content or dictate
tool usage on the participant's behalf. It should match the shape of the
storyboard workflow's task-text (one sentence, skill-dispatch only). The
trace-analysis step belongs inside Q2 as the skill already describes it
(`coaching-protocol.md:62-68`), not as a Q1 work assignment.

### Invariant that makes the hang loud

The kata-trace invariant catalogue must carry a named facilitated-mode
completeness invariant. The WHAT: a facilitated-mode run is incomplete when an
addressed participant never `Share`s or when `Conclude` is not called exactly
once. The WHY: the Agent SDK's `result: success` flag does not reflect coaching
completion, so monitoring that trusts it silently misses the failure mode
documented above.

## Scope

### Included

- `libraries/libeval/src/facilitator.js` — `FACILITATED_AGENT_SYSTEM_PROMPT`.
  Whether the Tell→Share rule lives here, elsewhere, or in several places is a
  design decision.
- `libraries/libeval/src/orchestration-toolkit.js` — agent-side `Share` and
  `Tell` tool descriptions (`createFacilitatedAgentToolServer`). Facilitator-
  side descriptions are unchanged.
- `.claude/skills/kata-storyboard/SKILL.md` — Participant Protocol
  universalisation and 1-on-1 Coaching Adaptation section.
- `.claude/skills/kata-storyboard/references/coaching-protocol.md` — if the
  Tell→Share rule is restated here for coach consumption, it must remain
  consistent with the Participant Protocol wording.
- `.github/workflows/kata-coaching.yml` — `task-text` input.
- `.claude/skills/kata-trace/references/invariants.md` — new invariant for
  facilitated-mode completeness.
- The repository artifact through which participants in 1-on-1 coaching obtain
  the `kata-storyboard` Participant Protocol in their context. Candidate
  surfaces, enumerated without ranking: the `kata-coaching.yml` workflow
  `task-text`, a new participant-profile addendum in `.claude/agents/`, the
  facilitator's opening-`Tell` template inside the skill, or a direct
  `Skill("kata-storyboard")` load from the participant's session. Which surface
  is chosen is a design decision.

### Excluded

- **Facilitator-side system prompt and tool descriptions.** The facilitator's
  "stop making tool calls and wait for responses" instruction
  (`facilitator.js:30-33`) is correct as written; its side of the contract is
  already enforced. This spec only adds the symmetric participant-side rule.
- **The `Facilitator` class orchestration logic.** Loop mechanics,
  `#facilitatorLoop`, `#runAgent`, and the `messageBus` are correct given a
  participant that honours the protocol. No behavioural change is required
  there.
- **The `kata-storyboard.yml` workflow.** Team storyboards work today; no change
  to their workflow is in scope.
- **Spec 490** (already `plan implemented`). That spec established the coach as
  a pure facilitator and added orchestration-awareness to the skill on the
  facilitator side. This spec is the complementary participant-side fix it did
  not cover.
- **A general redesign of facilitated-mode agent identity.** Spec 500
  (facilitated-agent identity) stays in scope for identity; this spec only adds
  a single protocol rule.
- **Automatic retry / timeout shortening on stalled coaching runs.** The
  completeness invariant in Success Criterion 3 makes the hang loud; behavioural
  recovery (shorter timeout, retry, redirect) is a separate concern.

## Dependencies

- **Spec 460** (`plan implemented`) — `kata-storyboard` skill exists.
- **Spec 490** (`plan implemented`) — facilitator-side orchestration awareness.
  This spec is the participant-side counterpart.
- **Spec 500** (`plan implemented`) — facilitated-agent identity, which
  determines how participants receive their initial instruction surface.

## Success Criteria

The spec is done when these **artifact properties** hold. Each criterion is a
property of a file in the repository after the change, checkable without
scheduling a workflow run. A validation run against `kata-coaching.yml` (see the
Validation note at the end of this section) is the one-time confirmation that
the artifact properties produce the intended runtime behaviour — it is not
itself a success criterion.

1. **Participant-side protocol rule exists in the instruction surface a
   facilitated participant is guaranteed to read before acting.** The rule
   states that a `Tell` from the facilitator requires a `Share` response before
   the participant's turn is complete, symmetric to the facilitator's existing
   "do not proceed until you have received responses" rule in
   `libraries/libeval/src/facilitator.js` `FACILITATOR_SYSTEM_PROMPT`. Checkable
   by reading the chosen surface(s) once the design is settled.

2. **`kata-storyboard` Participant Protocol applies to both meeting types.**
   `.claude/skills/kata-storyboard/SKILL.md` § Participant Protocol contains the
   Tell→Share response rule in mode-agnostic form, and the 1-on-1 adaptation in
   `references/coaching-protocol.md` § 1-on-1 Coaching Adaptation explicitly
   invokes the Participant Protocol. Checkable by reading the two files.

3. **Facilitated-mode completeness invariant is catalogued.** A named invariant
   exists in `.claude/skills/kata-trace/references/invariants.md` whose WHAT and
   evidence queries together detect a facilitated run in which an addressed
   participant has zero `Share` calls or in which `Conclude` was not called
   exactly once. Checkable by reading the invariant entry and running its own
   documented evidence query against the baseline artifacts listed in the entry.

4. **Coaching workflow task-text does not prescribe Q1 content.**
   `.github/workflows/kata-coaching.yml` `task-text` does not dictate which
   question to ask first, does not specify which tools the participant should
   use, and does not assign participant-side work. Checkable by reading the
   workflow file; the shape matches `.github/workflows/kata-storyboard.yml` in
   its delegation to the skill.

5. **Participants in 1-on-1 coaching are delivered the Participant Protocol.**
   The repository artifact responsible for participant context in 1-on-1 mode —
   whichever surface the design selects (workflow input, facilitator opening
   template, agent profile, or direct skill load) — contains or references the
   `kata-storyboard` Participant Protocol such that a participant reading its
   initial instruction surface has the Tell→Share rule in scope. Checkable by
   reading that one file; no live trace needed.

6. **The team-storyboard workflow artifacts are unchanged in shape.**
   `.github/workflows/kata-storyboard.yml` and the facilitator-side
   `FACILITATOR_SYSTEM_PROMPT`, Facilitator tool-server descriptions, and
   Facilitator Process steps in `kata-storyboard/SKILL.md` are unchanged except
   where this spec explicitly touches them (Participant Protocol and 1-on-1
   Coaching Adaptation). Checkable by diff of the workflow, `facilitator.js`,
   and the Facilitator Process section.

7. **Existing facilitated-mode tests pass.** `bun run check` and `bun run test`
   pass with no regressions. Tests under
   `libraries/libeval/test/orchestration-toolkit.test.js` and any test that
   exercises `FACILITATED_AGENT_SYSTEM_PROMPT` or the agent-side `Share`/`Tell`
   tool descriptions still pass; new tests cover any new behaviour the design
   introduces.

**Validation note (not a criterion).** Once the seven criteria above hold,
schedule one `kata-coaching.yml` run against the staff-engineer (same agent as
the two failing runs `24850558182` and `24844117144`) and one
`kata-storyboard.yml` run, download both combined traces, and confirm: (a) the
new invariant in criterion 3 reports no violation on either, and (b) the
coaching run contains at least one `Share` from the participant and exactly one
`Conclude`. This is a one-time check that the artifact properties compose into
the intended runtime behaviour. Persistent monitoring is handled by criterion
3's invariant, not by repeated manual runs.

# Design 620 — Request–Response Primitives for libeval Orchestration

## Problem (restated)

The Tell→Share stall is a symptom of messaging primitives that encode no
request-response obligation. Four-layer prose defence-in-depth was the prior
fix; it is brittle and survives only as long as every layer keeps restating the
rule. Reshape the primitives so the contract is structural, not taught, and
collapse the prose layers.

## Components

Changes span the runtime (L1), one renamed skill (L6/L7), one workflow (L4), and
one reference (L7). Layer numbers per
[KATA.md § Instruction layering](../../KATA.md#instruction-layering).

| Layer | Component                                                                               | Role                                                   |
| ----- | --------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| L1    | `OrchestrationToolkit` — tool-server factories, handler factories, `ctx.pendingAsks`    | Tool surface, pending-ask state, violation emission    |
| L1    | `Facilitator` / `Supervisor` — `#runAgent` turn-complete guard, system prompts, msg bus | Runtime enforcement; descriptive system-prompt framing |
| L6    | `kata-session/SKILL.md` (renamed from `kata-storyboard`)                                | Mode-agnostic five-question procedure + Ask/Answer     |
| L7    | `kata-session/references/{team-storyboard,one-on-one}.md`                               | Mode-specific overlays                                 |
| L4    | `.github/workflows/kata-coaching.yml` `task-text`                                       | Single-sentence skill dispatch                         |
| L7    | `kata-trace/references/invariants.md`                                                   | Two `protocol_violation` invariants (facil. + superv.) |

## Architecture

### New primitive vocabulary

Both modes share one vocabulary. Asymmetric cardinality (1:1 vs 1:N) is handled
by the `to` parameter, not by distinct tools.

| Tool                     | Side                            | Semantics                                                                                           |
| ------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `Ask(to?, question)`     | facilitator, supervisor         | Register pending-ask keyed by addressee; asker's turn ends; facilitator omits `to` → broadcast ask. |
| `Answer(message)`        | participant, supervised agent   | Resolve the pending-ask owed to the caller; delivers reply to the asker's queue.                    |
| `Announce(message)`      | both sides, both modes          | No-reply broadcast. Legitimate use of today's `Share`; never creates a pending-ask.                 |
| `Redirect(message, to?)` | facilitator, supervisor         | Unchanged: hard interrupt with replacement instructions.                                            |
| `Conclude(summary)`      | facilitator, supervisor         | Unchanged: close session.                                                                           |
| `RollCall()`             | facilitator, supervisor, agents | Unchanged: list participants.                                                                       |

`Tell`, `Share`, and the participant-side blocking `Ask` tool are removed — no
aliases. `ctx.pendingAsks: Map<addressee, {askId, askerName, question}>` lives
in the context built by `createOrchestrationContext()`.

**Rejected: keep `Tell`/`Share`, add `Ask`/`Answer` alongside.** Two
vocabularies re-introduce the "is this Tell a question or an announcement?"
ambiguity. **Rejected: distinct name for participant→facilitator Ask.**
Unnecessary asymmetry — the from/to arguments already distinguish roles.

### Pending-ask registry and turn-complete guard

The orchestrator's agent loop (`#runAgent` in `facilitator.js`, equivalent loop
in `supervisor.js`) becomes the enforcement site. Before emitting
`lifecycle:turn_complete`, it consults `ctx.pendingAsks`.

```mermaid
sequenceDiagram
    participant F as Facilitator
    participant R as #runAgent
    participant P as Participant
    participant T as Trace

    F->>R: Ask(to=P, question)
    Note over R: ctx.pendingAsks.set(P, ask)
    R->>P: deliver as user turn
    P->>P: produce text, no Answer
    Note over R: turn ends; pendingAsks.has(P)?
    R->>P: synthetic reminder (once)
    P->>P: still no Answer
    R->>T: emit protocol_violation
    Note over R: allow turn_complete
    R-->>F: null Answer via messageBus
```

If the participant calls `Answer(message)` at any point, the handler clears the
entry, routes the message to the asker via `messageBus`, and the runtime
short-circuits the reminder/violation path.

**Rejected: block `turn_complete` forever** (same deadlock, moved from prompt to
runtime). **Rejected: zero retries** (wastes a turn the LLM would have recovered
with a nudge). **Rejected: unbounded retries** (silent budget burn). One
reminder + one trace event is the bounded cost/signal balance.

### Supervisor parity

Supervision gets the same vocabulary. Today the supervisor has `Redirect` +
`Conclude` only; supervised agents have a blocking `Ask`. The new shape:

- **Supervisor:** `Ask`, `Announce`, `Redirect`, `Conclude`, `RollCall`.
- **Supervised agent:** `Ask`, `Answer`, `Announce`, `RollCall`.

Either side can ask; either side must answer. The supervised-agent's historic
blocking `Ask` (agent waits mid-tool-call for supervisor's text) becomes a
regular `Ask` that registers pending on the supervisor. The supervisor's
implicit text-relay reply becomes an explicit `Answer` call. This removes the
special-case blocking path in `agent-runner.js`; all replies flow through the
same `Answer` → `messageBus` route.

**Rejected: leave supervision untouched.** Two vocabularies across libeval is
worse than one. The runtime cost of parity is small (same handlers, different
wiring); the skill-authoring cost of two vocabularies is large (every future
skill must learn both).

### System-prompt framing

All four prompts (`FACILITATOR_`, `FACILITATED_AGENT_`, `SUPERVISOR_`,
`AGENT_SYSTEM_PROMPT`) become descriptive, not enforcing. They name
`Ask`/`Answer`/`Announce` in one sentence each and set the conversational frame
("you are in a coaching session" / "a supervisor watches your work"). Every
"then Share", "stop making tool calls", and "do not proceed until" phrase is
removed — the runtime holds the contract now.

**Rejected: keep enforcement phrases as belt-and-suspenders.** Creates
contradiction risk when runtime and prompt disagree, and preserves the pattern
the spec set out to dismantle.

### Participant Protocol delivery

Chosen: `FACILITATED_AGENT_SYSTEM_PROMPT` carries the Participant Protocol as a
short descriptive summary (two or three sentences), plus a pointer to
`kata-session` for detail. `systemPrompt` is set on the runner at construction
time (`facilitator.js:489-492`), so every participant receives it before any Ask
arrives — no bootstrap ordering problem, no coach-Tell circularity.

**Rejected:** coach's first `Ask` (circular — bootstraps with the very protocol
being bootstrapped); workflow `task-text` (reaches the facilitator only);
agent-profile addendum (bleeds into solo runs); synthetic bootstrap user message
(pollutes the trace with orchestrator-authored user turns). `systemPrompt`
append is trace-clean by construction.

### Skill restructure: `kata-storyboard` → `kata-session`

Directory rename with content redistribution:

```text
kata-session/
  SKILL.md                          mode-agnostic: five questions + Ask/Answer
  references/team-storyboard.md     storyboard artifact, XmR, CSV, planning
  references/one-on-one.md          participant-trace overlay
  references/storyboard-template.md unchanged
  references/metrics.md             unchanged
```

Front-matter `name: kata-session`. KATA.md skills table, agent profiles,
workflows, and website internals update in lockstep.

**Rejected: keep the name, add a mode-agnostic section.** Compounds the
instruction-layer kludge this spec dismantles.

### Coaching workflow task-text

`kata-coaching.yml` `task-text` becomes one sentence that dispatches to
`kata-session` with the target agent name. No Q1 prescription, no `kata-trace`
front-load, no participant-side work. Unchanged rationale from prior draft; spec
SC 8.

### Protocol-violation invariants

`kata-trace/references/invariants.md` gains two entries under a new
`## Orchestrator traces` table, one per mode:

| Mode        | Evidence signature                                                                  |
| ----------- | ----------------------------------------------------------------------------------- |
| Facilitated | Count of `protocol_violation` events in combined trace == 0; `Conclude` count == 1. |
| Supervised  | Count of `protocol_violation` events in combined trace == 0; `Conclude` count == 1. |

Both reduce to the same evidence function over distinct trace shapes; the
invariant catalogue writes it once and parameterises on trace source.

**Rejected: infer violations from tool-call set differences.** No longer
necessary — the runtime emits structured events that are a direct match.

## Key Decisions

| Decision                      | Chosen                                                                     | Rejected                                                      | Why                                              |
| ----------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| Primitive set                 | `Ask` / `Answer` / `Announce` (+ Redirect/Conclude/RollCall), shared modes | Keep `Tell`/`Share`; add alongside; mode-specific names       | One vocabulary; contract encoded structurally    |
| Enforcement site              | `#runAgent` turn-complete guard + `protocol_violation` event               | Prose in four layers; auto-repair that masks violation        | Structural contract; violation remains loud      |
| Retry policy                  | One synthetic reminder, then advance + trace event                         | Unbounded retry; no retry; block forever                      | Bounded cost, non-deadlocking, audible           |
| Supervision parity            | Same vocabulary as facilitation                                            | Leave supervision's `Redirect`+`Conclude`+blocking-Ask        | Single vocabulary across libeval                 |
| System-prompt posture         | Descriptive framing only                                                   | Keep "then Share" / "do not proceed" as belt-and-suspenders   | No contradiction risk; runtime owns the contract |
| Participant-Protocol delivery | `FACILITATED_AGENT_SYSTEM_PROMPT` append                                   | Coach first-Ask; task-text; profile; synthetic user bootstrap | Non-circular, trace-clean, bleeds into nothing   |
| Skill name                    | `kata-session`                                                             | `kata-storyboard` retained                                    | Name matches the skill's actual scope            |
| Invariant source              | `protocol_violation` events from runtime                                   | Set-difference inference over Ask/Answer calls                | Direct signal vs. inferred                       |

## Out of Scope

Per spec 620: facilitated-agent identity (spec 500), the pure-facilitator
posture itself (spec 490 — this spec refines its vocabulary, does not revert
it), behavioural recovery beyond the bounded single retry, `agent-runner.js`
per-turn mechanics, trace-format changes beyond the new `protocol_violation`
event type, and any new workflows or agent personas.

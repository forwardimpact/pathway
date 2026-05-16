# Design A — Orchestrator Uniform Robustness

## Architectural intent

Three thin primitives in `orchestrator-helpers.js` plus disciplined consumption
at every runner-result callsite. The orchestrators stay structurally the
same — they keep their internal state machines, their tool servers, their
turn-counting — but they delegate the parts that recur (drain-then-format,
last-text extraction, error attribution) to shared helpers. Failures
attribute through a single typed event and short-circuit the calling method
cleanly; nothing wraps a runner call in `try`/`catch`.

```mermaid
flowchart LR
    Supervisor[Supervisor] -- consumes --> Helpers[orchestrator-helpers.js]
    Facilitator[Facilitator] -- consumes --> Helpers
    Helpers --- ELT[extractLastText]
    Helpers --- DAR[drainAndFormat]
    Helpers --- PEE[participantErrorEvent]
    Helpers --- FM[formatMessages existing]
    Helpers --- AQ[createAsyncQueue existing]
```

## Components

| Component | Module | Role |
|---|---|---|
| `extractLastText(runner, fallback)` | `src/orchestrator-helpers.js` | Pure function — scans `runner.buffer` for the last assistant text block; returns `fallback` when none found. Moved from the two byte-identical copies. |
| `drainAndFormat(messageBus, name)` | `src/orchestrator-helpers.js` | Drains messages addressed to `name`; returns `formatMessages(drained)` when non-empty, `null` when empty. Caller branches on `null` to keep null-vs-non-null behaviour explicit at each site. |
| `participantErrorEvent(participant, error)` | `src/orchestrator-helpers.js` | Event builder — returns `{type: "participant_error", participant, message: error.message}`. Pure data; orchestrators decide when to emit and how to exit. |
| `Supervisor` | `src/supervisor.js` | Unchanged state machine. New: after every `runner.run`/`runner.resume`, branches on `result.error` and exits via the same paths it already uses for terminal failures (`#classifyAgentOutcome` and `supervisor.js:111`/`:226`). |
| `Facilitator` | `src/facilitator.js` | Unchanged state machine. New: after every `runner.run`/`runner.resume`, branches on `result.error`. Concurrent agent loops abort their siblings on failure (existing `currentAbortController.abort()` mechanism on `facilitator.js:124-128`). |

## Interfaces

```text
extractLastText(runner: AgentRunner, fallback: string): string
drainAndFormat(messageBus: MessageBus, name: string): string | null
participantErrorEvent(participant: string, error: Error): { type: "participant_error", participant: string, message: string }
```

`AgentRunner` and `MessageBus` types unchanged. The error-event shape matches
the orchestrators' existing event vocabulary (`type` + payload fields;
`session_start`, `agent_start`, `mid_turn_review`, `intervention_relayed`,
`redirect` — see `supervisor.js:276`, `facilitator.js:91`).

## Data flow on error

```mermaid
sequenceDiagram
    participant Caller as Orchestrator method
    participant Runner as runner.run/resume
    participant Helper as participantErrorEvent
    participant Stream as output stream
    Caller->>Runner: await runner.resume(prompt)
    Runner-->>Caller: { error, aborted, ... }
    alt result.error and not aborted
        Caller->>Helper: participantErrorEvent(name, error)
        Helper-->>Caller: { type, participant, message }
        Caller->>Stream: emitOrchestratorEvent(event)
        Caller->>Stream: emitSummary({ success: false, turns })
        Caller->>Caller: return early
    else success
        Caller->>Caller: continue normal flow
    end
```

Six Facilitator sites and two unchecked Supervisor sites (`:281`, `:340`)
adopt this shape. Supervisor's three already-checked sites (`:111`, `:225`,
`:321`) refactor to emit the same `participant_error` event before their
existing summary call, so all error paths share one event type.

## Key decisions

| Decision | Choice | Rejected alternative | Why |
|---|---|---|---|
| **Where shared primitives live** | Add to `orchestrator-helpers.js` alongside `formatMessages`/`createAsyncQueue`. | New `src/orchestrator-base.js` with a `BaseOrchestrator` class the two extend. | The two orchestrators already share only data utilities — they have different state machines, different tool servers, different concurrency models (Facilitator runs N agent loops in parallel; Supervisor runs one). A base class would either be near-empty or force unnatural unification of the state machines. Helpers keep the seam at the data boundary, where it actually is. |
| **Error-event vocabulary** | One event type `participant_error` with a `participant` field. | Two types `agent_error` and `facilitator_error`. | Trace consumers filter by `type` already. A single type lets a `--errors` view aggregate uniformly; the `participant` field carries the discrimination the consumer needs. Mirrors the existing `agent_start` event shape (one type, named participant). |
| **Helper return shape for drain** | `string \| null` from `drainAndFormat`. | `string` (empty when drained nothing) or `{relay: string, messages: Message[]}` tuple. | The 11 callsites today already branch on `length > 0` before deciding what to do (some return null, some return undefined, some skip the call). A nullable return preserves that branch point; the tuple shape would force callers to discard data. |
| **Failure semantics in Facilitator** | On any runner `.error`, emit `participant_error`, abort sibling agents via existing `currentAbortController.abort()`, emit summary `{success: false}`, return. | Let surviving agents continue; only fail the failed participant's loop. | A failed runner means the conversation's trace is corrupted from this point — surviving agents have nothing reliable to react to. Aborting matches the existing exception path at `facilitator.js:135-141`. |
| **No `try`/`catch` around runner calls** | Inspect `result.error` after `await`; never wrap the call. | Try/catch wrapper that converts thrown errors into `{error: e}` results. | `AgentRunner` already normalizes thrown errors into `.error` on the return value (verified at `agent-runner.js:184-189`). Wrapping again is the recovery-shim pattern this session removed in commits `d741da99` and `58da3961`. Carries the clean-break direction forward. |
| **Where `participant_error` events go relative to summary** | Event first, then `emitSummary({success:false})`, then return. | Single `summary` event with an `error` field. | Existing `summary` shape has no `error` field; trace consumers parse it positionally. Adding a sibling event preserves the contract and gives `fit-trace errors` a single line to surface. |

## What stays untouched

- `AgentRunner` (consolidated by `f9deed07`).
- Tool servers and Ask/Answer/Conclude/RollCall semantics
  (`orchestration-toolkit.js`).
- `messageBus` and `pending-ask` state.
- `Supervisor.extractTranscript` — used only by `#endOfTurnReview` at
  `supervisor.js:307`; has no Facilitator counterpart per spec § Scope.
- Existing trace event types — only `participant_error` is added.

## Risks

| Risk | Mitigation |
|---|---|
| Facilitator's parallel agent loops produce *concurrent* error events for the same root cause (one agent errors, sibling-abort triggers an `aborted: true` result on the others). | The `result.error && !result.aborted` predicate already exists in supervisor pattern (`supervisor.js:225`). Reusing it filters cascade noise — only the first failure emits `participant_error`. |
| `drainAndFormat` collapses the subtle prefix-decoration variations across the 11 sites (e.g. supervisor's `"Agent messages:\n${formatMessages(...)}"` at `supervisor.js:315`). | Helper returns the inner string; prefix decoration stays inline at each consumer. Helper only owns the drain-then-format kernel, not the surrounding template. |
| The new event changes the trace size for trace-analysis consumers. | Additive only; no existing event field changes. `fit-trace` filtering uses `type` (verified by `.claude/skills/fit-trace/SKILL.md`). |

## Verifies

- Spec § Success criteria row 1 ("typed failure event identifying the
  participant") → `participant_error` event with `participant` field.
- Spec § Success criteria row 2 (supervisor `:281`, `:340` parity) → same
  branch shape applied at all five supervisor sites.
- Spec § Success criteria row 3 (`extractLastText` single location) →
  `extractLastText` exported from `orchestrator-helpers.js`; supervisor's
  callsite imports it; facilitator's dead copy deleted.
- Spec § Success criteria row 4 (`drain` callsites ≤6 of 11) → 11 sites
  become calls to `drainAndFormat`; remaining direct `messageBus.drain`
  uses are the ones inside the helper itself plus any consumer that
  legitimately needs the raw array.
- Spec § Success criteria row 5 (no `try`/`catch` added) → branch-on-result
  pattern; helpers are pure functions.

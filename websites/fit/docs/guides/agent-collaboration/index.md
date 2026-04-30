---
title: Agent Collaboration
description: Run multi-agent sessions with fit-eval facilitate — specialists coordinate via Ask, Answer, and Announce, and the session is captured as a trace for fit-trace.
---

# Agent Collaboration

`fit-eval` is the plumbing for multi-agent collaboration. You write a
**facilitator profile** and one or more **participant profiles**, then
`fit-eval facilitate` runs them together over a message bus. Participants and
the facilitator pass targeted messages with `Ask` (replies via `Answer`) and
broadcast with `Announce`; the facilitator ends the session with `Conclude`. The
NDJSON trace captures every turn for inspection with `fit-trace`.

This guide walks from a single session definition to a working facilitated run
you can read end-to-end.

## Prerequisites

- Node.js 18+
- `ANTHROPIC_API_KEY` available to the shell or workflow
- A repository where the participants will work

## 1. Pick a session shape

A facilitated session has one **facilitator** and N **participants**. The
facilitator orchestrates the conversation; each participant contributes a
specialism.

A typical shape — release coordination across three specialists:

- `security-engineer` — reviews changes for security regressions
- `release-engineer` — confirms the release is mergeable
- `technical-writer` — verifies the changelog is accurate

The facilitator opens the session with the goal, asks each participant for
status, resolves conflicts between their reports, and concludes when the release
is either ready or blocked. Each participant only knows its own specialism — the
cross-cutting view emerges from the facilitator's orchestration.

## 2. Write the participant profiles

Each participant is an agent profile under `.claude/agents/<name>.md`. The
runtime appends an orchestration trailer that explains how to use `Ask`,
`Answer`, `Announce`, `RollCall`, and `Conclude` — your profile only needs to
describe the agent's specialism and how it should respond when asked.

```md
<!-- .claude/agents/security-engineer.md -->
---
name: security-engineer
description: Review changes for security regressions before release.
---

You are the security engineer for this release. When the facilitator asks
for status, audit the diff for:

- New external inputs without validation
- Secrets, tokens, or credentials added in plain text
- Changes to authentication, authorization, or session handling
- New dependencies with known advisories

Answer with a clear go/no-go and the specific lines or files that drove the
call. If you find blockers, `Announce` them so the other participants see
the same evidence. Do not edit code — your job is to assess.
```

Participants share `--agent-cwd` by default, so each one reads the same working
tree. Give each only the tools its specialism needs (typically `Read`, `Grep`,
`Bash`); restrict `Edit` and `Write` to participants whose job is to make
changes.

## 3. Write the facilitator profile

The facilitator is also a profile under `.claude/agents/<name>.md`, but it runs
against `--facilitator-cwd` and uses the orchestration tools to drive the
session.

```md
<!-- .claude/agents/release-facilitator.md -->
---
name: release-facilitator
description: Coordinate a release-readiness review across specialist agents.
---

You are facilitating a release-readiness review. The participants are
`security-engineer`, `release-engineer`, and `technical-writer`.

Run the session in this shape:

1. `Announce` the goal: confirm whether the current release is ready to ship.
2. `Ask` each participant for their go/no-go, one at a time.
3. If any participant reports a blocker, `Announce` the blocker so the
   others can react, then ask whether they want to revise their position.
4. `Conclude` with `success: true` if all three are go; otherwise
   `success: false` with a one-paragraph summary of the blocker.

If a participant strays off topic, re-`Ask` them with the original question
to bring them back (the facilitator does not have `Redirect`). Do not
do the participants' work yourself — your role is to sequence the
conversation, not to audit the code.
```

The facilitator profile is a system prompt, not a contract — design for graceful
degradation. If a participant returns an unclear answer, the facilitator should
ask again rather than guess.

## 4. Run the session locally

```sh
npx fit-eval facilitate \
  --task-file=sessions/release-review/task.md \
  --facilitator-profile=release-facilitator \
  --facilitator-cwd=. \
  --agent-profiles=security-engineer,release-engineer,technical-writer \
  --agent-cwd=. \
  --max-turns=20 \
  --output=trace.ndjson
```

`--max-turns=20` is the default for `facilitate` — bump it for larger sessions,
but always keep a budget so a stuck participant can't run the session forever.

`--task-file` describes the goal in a few sentences. The facilitator and the
participants all see it as the opening prompt; the facilitator's profile steers
how the goal is pursued.

Exit code `0` means the facilitator concluded with `success: true`; exit code
`1` means it concluded with `success: false`, ran out of turns, or errored.

## 5. Read the trace

The trace records every message and tool call from every participant, in order.
Start with the overview to orient, then drill into the message flow.

```sh
npx fit-trace overview trace.ndjson
npx fit-trace timeline trace.ndjson
npx fit-trace tool trace.ndjson Announce
npx fit-trace tool trace.ndjson Ask
npx fit-trace tool trace.ndjson Conclude
```

The `Conclude` call carries the facilitator's verdict. Walk backwards through
`Announce` (broadcasts) and `Ask`/`Answer` (targeted exchanges) to see how the
participants converged — or where they diverged.

## Notes

- **Participants share `--agent-cwd` by default.** If two participants might
  edit the same file, give each its own working directory or restrict their tool
  allowlists so only one can write.
- **Tool allowlists per participant matter.** A participant with `Edit` access
  can rewrite the others' work between turns. Limit each agent to what its
  specialism needs.
- **The facilitator profile steers, not constrains.** The participants are free
  agents; the facilitator's instructions are a system prompt, not a contract.
  Treat the session as a structured conversation, not a state machine.
- **Same plumbing as evaluations.** `facilitate` and `supervise` share the
  orchestration toolkit and the trace format. If your goal is a verdict on a
  single agent's work, see the
  [Agent Evaluations guide](../agent-evaluations/index.md) — it uses `supervise`
  and the same `Conclude` semantics.

## Related

- [Agent Evaluations](../agent-evaluations/index.md) — the verdict-driven
  sibling use case for `fit-eval`.
- [Trace Analysis](../trace-analysis/index.md) — read the NDJSON traces this
  guide produces, with worked examples including a stalled multi-agent session.
- [Agent Teams](../agent-teams/index.md) — how agent profiles are authored and
  what they contain.
- [fit-trace](../../reference/cli/index.md) — full `fit-trace` CLI command
  surface.

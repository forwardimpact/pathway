# 1-on-1 Coaching Overlay

Applies to `kata-coaching.yml` runs: the improvement coach facilitates a 1-on-1
session with one domain agent. The participant's framing arrives via libeval's
`systemPromptAmend`; the participant does not load this skill directly.

## Session Shape

The participant reflects on its most recent workflow trace. Under Q2 the
participant runs `kata-trace` on that trace; the five questions scope to the
trace's run-level findings. One facilitator, one participant, turn-taking
structure enforced by the libeval runtime's Ask/Answer contract.

## Question Wording (1-on-1)

1. **What were you trying to achieve in this run?** (Q1)
2. **What actually happened?** (Q2 — the participant runs `kata-trace` on its
   own most recent workflow trace and reports the numeric findings.)
3. **What obstacles prevented better outcomes?** (Q3 — grounded in the trace
   findings, not narrative.)
4. **What will you do differently next run?** (Q4 — small, testable, with
   expected outcome recorded before the experiment runs.)
5. **When will you see the effect?** (Q5 — typically the next scheduled workflow
   run.)

## Trace access

The participant runs `kata-trace` against its own agent's trace artifact. The
coach does not pre-load the trace content into the participant's context; the
participant fetches it under Q2.

## Participant-side summary (`systemPromptAmend`)

Use this template verbatim when populating the participant config:

> "You are in a 1-on-1 coaching session. The coach will Ask you five questions
> via the orchestration `Ask` tool. Reply to each with `Answer`. Under Q2, run
> `kata-trace` on your most recent workflow trace and include the numeric
> findings in your Answer."

## Memory

After the session, the participant writes its findings to its own weekly log.
The coach records session metrics per the Facilitator Process.

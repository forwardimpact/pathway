---
title: Trace Analysis
description: Read agent execution traces with fit-trace as qualitative research — orient, code, find patterns, and write grounded findings.
---

# Trace Analysis

Once `fit-eval` has produced an NDJSON trace, the work shifts from running to
understanding. `fit-trace` is the query interface — but the trace is qualitative
data, and the most useful analysis comes from reading it like a researcher, not
running a checklist.

This guide walks through the method: orient with summary commands, read the full
trace, code observations, look for patterns, and synthesize findings that are
grounded, testable, and actionable. Two worked examples — an eval that failed
and a multi-agent session that stalled — show the method on real-shaped data.

## Prerequisites

- Node.js 18+
- A trace file (either `--output` from `fit-eval`, or downloaded from CI with
  `fit-trace download`)
- Time to read the full trace — skimming produces shallow findings

## 1. Get the trace

Local runs already produce a trace at `--output`. For CI runs, list and
download:

```sh
npx fit-trace runs                    # find the run you want
npx fit-trace download <run-id>       # downloads to /tmp/trace-<run-id>/
```

For supervised or facilitated runs, split the combined trace into per-source
files so you can see what each agent saw:

```sh
npx fit-trace split /tmp/trace-<run-id>/structured.json --mode=facilitate
```

This produces `trace-facilitator.ndjson`, `trace-<participant>.ndjson`, etc.,
which is essential when participants disagreed — you can read each one's view
independently.

Either trace form works as input — `*.ndjson` files from `fit-eval --output` and
`structured.json` from `fit-trace download` are interchangeable for every
`fit-trace` query command.

## 2. Orient

Start with the bird's-eye view before drilling in:

```sh
npx fit-trace overview <file>     # metadata, summary, turn count, tool usage
npx fit-trace timeline <file>     # one line per turn
npx fit-trace stats <file>        # tokens and cost
```

`overview` tells you how the run ended; `timeline` shows the shape of the
session at a glance. If the timeline is dominated by one tool, that's a
hypothesis. If it shows clusters of errors, that's another. Note them — but
don't commit to them yet.

## 3. Read the full trace

The temptation is to jump to `errors` or `search` and confirm the obvious.
Resist it. Subtle agent failures live in interactions between turns that look
fine in isolation.

Open the trace and walk it turn by turn (or `batch <from> <to>` for chunks). As
you read, follow four practices borrowed from grounded-theory research:

- **Begin with no hypothesis.** Read before forming opinions about what went
  wrong. The trace will tell you something you didn't expect — but only if you
  let it.
- **Use the trace's own language.** Label observations with terms from the
  actual output — error messages, tool names, status codes — not abstract
  categories you bring to the analysis.
- **Write memos as you go.** Short notes on why something surprised you, or
  connections between observations. Memos written during analysis are far more
  valuable than retrospective summaries.
- **Read the full trace.** Every turn matters. The cause of a turn-30 failure is
  often visible at turn 8.

## 4. Look for patterns

As you read, assign short labels (codes) to meaningful events:
`claimed done without verification`, `silent retry`, `redirect ignored`,
`tool error swallowed`. Group related codes into categories by asking:

- What caused this? What happened? What was the context?
- How did the agent react?
- What were the consequences?

Then look across codes for:

- **Causal chains** — A failed at turn 8, which led B to assume X at turn 15,
  which produced the wrong result at turn 28.
- **Repeated patterns** — the same shape of mistake more than once.
- **Contrasts** — the same operation succeeded in one context but failed in
  another. The difference is the lever.
- **Temporal patterns** — early-run vs late-run behavior. Agents often degrade
  as context fills.

## 5. Synthesize findings

Strong findings share three traits:

- **Grounded** — traceable to specific turns. Cite turn indices.
- **Testable** — future traces can confirm or refute them.
- **Actionable** — they imply a concrete change to a profile, prompt, tool
  allowlist, or workflow.

Aim for a **central explanation** that connects multiple observations, not a bug
list. A bug list says what went wrong; a central explanation says _why_ this
kind of thing keeps going wrong.

## Worked example: supervised eval of a coding agent

A `supervise` run evaluated a coding agent on the task _"add input validation to
the user registration endpoint: reject empty emails and reject passwords shorter
than 8 characters; add tests."_ The agent finished, the judge concluded
`success: false`, and CI surfaced the failure. The question is why — the agent's
own tests passed.

```sh
npx fit-trace overview trace.ndjson
# 22 turns, Conclude success=false
npx fit-trace tool trace.ndjson Conclude
# "validation present on JSON path only; form-encoded path unchanged"
npx fit-trace filter trace.ndjson --tool Read
npx fit-trace filter trace.ndjson --tool Edit
```

Walking the trace, codes emerge:

- T2: agent reads the endpoint handler, sees a JSON body parser at the top.
- T3–T5: agent adds validation inside the JSON branch.
- T7: agent writes tests that POST JSON. All pass. (Code: _tests confirm what
  was changed, not what was needed_.)
- T9: agent calls `Conclude` proposing success.
- T10: judge inspects the route definition and finds the same handler registered
  for both `application/json` and `application/x-www-form-urlencoded`. The
  form-encoded branch is untouched.
- T11–T20: judge `Redirect`s, agent investigates, but never reads the form
  parser path before re-asserting the change is complete. (Code: _narrow scope
  of investigation_.)
- T22: judge concludes failure with the gap noted explicitly.

**Central explanation:** the agent treats the first input shape it encounters as
the full input surface. Its tests reinforce the narrowing because they exercise
only what the agent already considered. The agent is locally correct on the path
it explored but blind to parallel paths.

**Action:** add a judge criterion that requires enumerating the request content
types before implementing. Or, at the agent profile level, instruct the coder to
list every entry path into the handler before editing it. The fix isn't about
validation logic — it's about scope discovery before implementation.

## Worked example: facilitated triage of a support ticket

A `facilitate` session triaged an incoming support ticket: _"Login broken for
users on iOS Safari. Started this morning. 12 customers reporting."_ The
participants were `support-engineer` (assesses customer impact),
`platform-engineer` (checks recent deploys and infra), and `mobile-engineer`
(checks platform-specific issues). The session concluded by routing to the
mobile team for a Safari-version-specific workaround. Three days later the real
cause turned out to be a backend deploy that broke user-agent parsing for iOS
Safari specifically. The session had the right evidence; it reasoned to the
wrong cause.

```sh
npx fit-trace split trace.ndjson --mode=facilitate
npx fit-trace timeline trace-facilitator.ndjson
npx fit-trace tool trace-facilitator.ndjson Announce
npx fit-trace reasoning trace-platform-engineer.ndjson
```

Reading the per-source traces side by side:

- T3: `support-engineer` reports 12 affected customers, all iOS Safari, all
  reporting since 8am. P1 severity.
- T5: `mobile-engineer` notes Safari 18 was released yesterday with WebKit
  changes. Hypothesis: Safari regression. (Code: _first plausible cause becomes
  anchor_.)
- T7: `platform-engineer` reports a deploy to the auth service at 6am that
  morning. Notes the timing matches.
- T9: `mobile-engineer` responds that the iOS-specific symptom makes a Safari
  root cause more likely than a backend cause that would affect other browsers.
  (Code: _domain expertise dismisses cross-cutting evidence_.)
- T11: `platform-engineer` agrees and downgrades the deploy hypothesis. The
  reasoning trace shows the agent had not yet inspected what the deploy changed.
  (Code: _deferred to confidence, not evidence_.)
- T14: facilitator concludes — assign to mobile team, action is a user-agent
  workaround for Safari 18.

**Central explanation:** when one participant has obvious domain expertise, the
others defer to it even when their own findings carry equally strong evidence.
The session converges on the most-confident voice rather than the most-supported
hypothesis. Two independent signals (iOS-specific symptom _and_ matching deploy
time) collapsed into one because the participants deliberated sequentially
rather than independently.

**Action:** require participants to state their leading hypothesis with a
confidence level before deliberation begins, then surface disagreement
explicitly rather than letting it dissolve. In facilitator profiles, add a step
that asks each participant _what evidence would change your mind_ — a deploy
diff would have caught this one in the room.

## What to measure

When the question is quantitative — _is the agent getting better?_ — the metrics
are:

- **Token usage** — `stats` breaks down input vs. output tokens and cost.
- **Retry counts** — `search` for repeated identical tool calls.
- **Wasted turns** — turns that produced no useful progress; count them while
  reading.
- **Error recovery** — did the agent diagnose and adapt, or retry blindly?
  Compare `errors` against the immediately following turns.
- **Intent vs. execution** — `reasoning` shows what the agent said it would do;
  `tool` shows what it did. Mismatches are findings.

Track these across runs over time. A single trace is a snapshot; a series shows
whether changes are landing.

## Related

- [Agent Evaluations](../agent-evaluations/index.md) — produce traces with
  `fit-eval supervise`; the trace is what you analyze here.
- [Agent Collaboration](../agent-collaboration/index.md) — produce traces with
  `fit-eval facilitate`; the per-source split is essential for multi-agent
  traces.
- [CLI Reference](../../reference/cli/index.md) — the full `fit-trace` command
  surface.

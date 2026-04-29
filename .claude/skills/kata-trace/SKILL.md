---
name: kata-trace
description: >
  Go and see the work agents did by analyzing their execution traces. Select a
  workflow run, download its trace artifact, observe every turn via grounded
  theory, and produce a structured findings report with instruction-layer
  attribution.
---

# Agent Trace Analysis

Go and see the work agents did by analyzing execution traces. Select one run,
download its trace, study every turn via grounded theory, and produce findings
with instruction-layer attribution. Operates within the Kata Agent Team defined
in [KATA.md](../../../KATA.md).

## When to Use

- During a coaching cycle to analyze a single agent workflow run
- When investigating a specific workflow failure or unexpected behaviour
- When auditing trust boundaries in external merge workflows

## Checklists

<read_do_checklist goal="Internalize grounded theory before reading the trace">

- [ ] Begin with no hypothesis — let codes emerge from the data.
- [ ] Use in-vivo codes: the trace's own language ("403 forbidden"), not
      pre-defined categories ("authorization failure").
- [ ] Write memos during coding, not retroactively — memos are the engine of
      theory development.
- [ ] Read the full trace sequentially — every turn, tool call, and result.
      Skimming produces shallow codes.
- [ ] Seek a core category (a theory), not a list of bugs.

</read_do_checklist>

<do_confirm_checklist goal="Confirm analysis is complete before reporting">

- [ ] Entire trace read — every turn, tool call, and result observed.
- [ ] Open codes assigned using in-vivo labels from the trace's own language.
- [ ] Memos written during coding (not retroactively).
- [ ] Categories built with all five paradigm elements filled.
- [ ] Core category identified — integrates the most categories.
- [ ] Categories attributed to instruction layers where evidence supports it.
- [ ] Named invariants from `references/invariants.md` audited with PASS/FAIL.

</do_confirm_checklist>

## Process

### Step 0: Read Memory

Read memory per the agent profile (your summary, the current week's log, and
teammates' summaries). Extract workflow names and run IDs from previous cycles.

### 1. Select a Run

If a specific workflow name, run ID, or URL is provided, use that. Otherwise,
list recent runs and select using memory-informed rotation — see
[`references/run-selection.md`](references/run-selection.md). Announce which run
you selected and why.

```sh
bunx fit-trace runs                        # list recent agent workflow runs (default)
bunx fit-trace runs kata                   # filter by a different workflow name substring
```

### 2. Download and Process the Trace

Download the trace artifact and auto-convert to structured JSON:

```sh
bunx fit-trace download <run-id>           # → /tmp/trace-<run-id>/structured.json
```

If no artifacts exist, pick a different run and note why. Query with `fit-trace`
— `overview`, `count`, `timeline`, `batch`, `head`, `tail`, `search` (`--full`
for full content blocks), `tool`, `errors`, `reasoning`, `tools`, `stats`,
`init` (system/init event), `turn <index>`, `filter --role|--tool|--error`.
`thinking.signature` blobs strip by default — pass `--signatures` to keep them.

```sh
bunx fit-trace overview /tmp/trace-<run-id>/structured.json
```

### 3. Observe the Work (Open Coding + Memos)

Read the trace **in full** — every turn, tool call, and result. Assign a
**code** to each meaningful unit: a short label capturing what happened in the
data's own terms. **Use in-vivo codes** — labels from the trace's own language,
not pre-defined categories.

Focus on: what the agent did, what happened, how it reacted, and reasoning text
between tool calls (reveals intent). **Write memos as you code** — short notes
on why a code surprised you, connections between codes, or questions the data
raises. See `references/examples.md` for worked examples.

### 4. Build Categories and Core Category (Axial + Selective Coding)

Relate codes using the **paradigm model**: Causal conditions → Phenomenon →
Context → Actions/Interactions → Consequences. Group related codes into
**categories** with all five elements filled. Incomplete paradigms indicate
incomplete analysis.

Look for: causal chains, repeated patterns, contrasts (same operation
succeeded/failed in different contexts), temporal patterns (early vs late).

Identify the **core category** — the single central phenomenon integrating the
most categories. It is not the biggest bug; it is the conceptual thread
connecting the most findings. Derive **theoretical propositions** that are
grounded (traceable to turns), testable (future traces can confirm), and
actionable (implies concrete change). See `references/examples.md`.

### 5. Attribute to Instruction Layers

For each category, ask: which instruction layer is the root cause? See the
eight-layer model and per-layer fix shapes in
[KATA.md § Instruction layering](../../../KATA.md).

Attribute only when evidence supports it. Prefer the highest layer where the
defect originates. For L6 vs L7: "wrong procedure" is L6; "sound procedure,
stale/wrong data" is L7.

### 6. Categorize Findings

| Category        | Criteria                                   | Action         |
| --------------- | ------------------------------------------ | -------------- |
| **Trivial fix** | Root cause clear, fix mechanical, low risk | Implement + PR |
| **Improvement** | Requires design, touches multiple files    | Write spec     |
| **Observation** | Not actionable yet, or needs more data     | Note in report |

### 7. Audit Named Invariants

Verify the trace against per-agent invariants in
[`references/invariants.md`](references/invariants.md). For each applicable
invariant, search the trace and record PASS (with quoted tool call) or FAIL
(with what was searched for). High-severity failures must result in a fix PR or
spec — silent acceptance is itself a process failure.

### 8. Report and Act

Run the DO-CONFIRM checklist before producing the report. Use the template at
[`references/report-template.md`](references/report-template.md). Prefix with
run selection context; append invariant audit results by severity.

Act on findings:

- **Trivial fix** → branch `fix/coach-<name>` (or `fix/audit-<name>`), fix,
  commit, push, open PR. Batch related fixes sharing a root cause.
- **Improvement** → branch `spec/<name>`, write spec via `kata-spec`, push, open
  PR.

Every PR branches directly from `main`.

> **Writing under `.claude/`:** If a fix targets `.claude/`, follow
> [self-improvement.md](../../agents/references/self-improvement.md).

## Memory: what to record

Append to the current week's log (see agent profile for the file path):

- **Trace analyzed** — Workflow name, run ID, date, conclusion, branch
- **Actionable findings** — Severity, category, action taken (PR or spec)
- **Core category** — Central phenomenon and theoretical propositions
- **Invariant audit** — Each invariant with PASS/FAIL and evidence
- **Layer attributions** — Layers implicated and fix shapes
- **Saturation notes** — Patterns confirmed, refuted, or new vs prior cycles
- **Observations for teammates** — Callouts for specific agents
- **Metrics** — Record to `wiki/metrics/{agent}/{domain}/` per
  [`kata-metrics`](../kata-metrics/SKILL.md). These feed XmR analysis.

## Coordination Channels

This skill produces these non-wiki outputs (per
[coordination-protocol.md](../../agents/references/coordination-protocol.md)):

- **Discussion** — Open questions surfaced from analysis (e.g. "is this L7
  attribution the right fix shape?") needing cross-team input before a spec.

## Analysis Principles

READ-DO covers the fundamentals. Additional guidance:

- **Quote, don't paraphrase.** Exact errors, commands, token counts.
- **Distinguish symptoms from causes** via the paradigm model.
- **Count what matters.** Token usage, retry counts, wasted turns, cost.
- **Compare to intent.** Read skill docs, compare to actual execution.
- **Maintain traceability.** Proposition → category → code → turn.
- **Attribute to instruction layers.** Prefer upstream layers.

---
name: kata-grasp
description: >
  Walk the kata of an agent workflow run. Select a trace, download it, observe
  the work as it actually happened, apply grounded theory analysis, and produce
  a structured findings report. "Go see, ask why, show respect."
---

# Kata Walk for Agent Workflows

Go to where the work happens — the execution trace of a CI agent workflow run —
and observe it firsthand. Select one run, download its trace, study every turn
via grounded theory, categorize findings, and act on what you find. Depth over
breadth. This skill operates within the Kata system defined in
[KATA.md](../../../KATA.md), whose five-layer instruction model (§ Instruction
layering) and checklist design principles
([CHECKLISTS.md](../../../CHECKLISTS.md)) govern how findings translate into
system improvements.

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

If a specific workflow name, run ID, or URL is provided, use that run.
Otherwise, select a run using memory-informed rotation — see
[`references/run-selection.md`](references/run-selection.md) for the selection
algorithm. Announce which run you selected and why before proceeding.

### 2. Download and Process the Trace

Artifact names:

- **`combined-trace`** — Full interleaved agent + supervisor (supervised runs).
  **Prefer this.**
- **`agent-trace`** — Agent events only (all runs).
- **`supervisor-trace`** — Supervisor events only (supervised runs).

Download using the canonical shape from
[`kata-gh-cli` § Workflow run artifacts](../kata-gh-cli/SKILL.md#workflow-run-artifacts):

```sh
# Supervised runs:
gh run download <run-id> --name combined-trace --dir /tmp/trace-<run-id>
# Non-supervised runs:
gh run download <run-id> --name agent-trace --dir /tmp/trace-<run-id>
# Then process:
bunx fit-eval output --format=json < /tmp/trace-<run-id>/trace.ndjson > /tmp/trace-<run-id>/structured.json
```

If no trace artifacts exist, pick a different run and note why. For large
traces, use `scripts/trace-queries.sh` (`overview`, `count`, `batch N M`,
`tail N`, `errors`, `tools`).

### 3. Observe the Work (Open Coding + Memos)

Read the trace **in full** — every turn, every tool call, every result.
Sequentially assign a **code** to each meaningful unit (a tool call, a decision
point, a failure, a recovery): a short label that captures what happened in the
data's own terms.

**Use in-vivo codes** — labels drawn from the trace's own language (error
messages, command names, the agent's reasoning text). Do not use pre-defined
categories. Let codes emerge from the data.

Focus on: what the agent did, what happened, how the agent reacted, and what the
agent said (reasoning text between tool calls reveals intent).

**Write memos as you code.** A memo is a short analytical note recording your
thinking — why a code surprised you, a tentative connection between codes, or a
question the data raises. Memos are the engine of theory development — analysis
without memos is just sorting.

See `references/examples.md` for worked open coding and memo examples.

### 4. Build Categories and Core Category (Axial + Selective Coding)

Relate codes using the **paradigm model**:

```
Causal conditions → Phenomenon → Context → Actions/Interactions → Consequences
```

Group related codes into **categories**. For each category, fill in all five
paradigm elements: what triggered it, what it is, what context shaped it, what
was done, and what resulted. Incomplete paradigms indicate incomplete analysis.

Look for relationships across categories: causal chains, repeated patterns,
contrasts (same operation succeeded/failed in different contexts), and temporal
patterns (early vs. late in session).

Then identify the **core category** — the single central phenomenon that
integrates the most categories and explains the most variance. The core category
is not the biggest bug or the most expensive failure; it is the conceptual
thread that connects the most findings. Ask: which category do others orbit
around? What is the "story" this trace tells?

From the core category, derive **theoretical propositions** — testable
statements about agent behaviour. Each proposition must be **grounded**
(traceable to specific turns), **testable** (future traces can confirm or refute
it), and **actionable** (implies a concrete change).

See `references/examples.md` for worked axial and selective coding examples.

### 5. Attribute to Instruction Layers

For each category and proposition, ask: which instruction layer (if any) is the
root cause? See [KATA.md § Instruction layering](../../../KATA.md) for the
full model. Quick-reference key:

`L1 system prompt / L2 task / L3 profile / L4 skill / L5 checklist`

| Layer               | Typical fix shape                               |
| ------------------- | ----------------------------------------------- |
| L1 (system prompt)  | Infrastructure fix (relay code, supervisor.js)  |
| L2 (workflow task)  | Trivial fix (reword task text in workflow YAML) |
| L3 (agent profile)  | Trivial fix or improvement (edit profile .md)   |
| L4 (skill)          | Improvement or trivial fix depending on scope   |
| L5 (checklist)      | Trivial fix (add or edit checklist item)        |
| None (infra/config) | Depends on scope                                |

Not every finding maps to an instruction layer — infrastructure, SDK, and
external service failures are valid non-layer findings. Attribute only when the
evidence supports it. Prefer the highest layer where the defect originates — a
symptom in L4 (skill execution) may have a root cause in L2 (task text).

See `references/examples.md` for a worked attribution example.

### 6. Categorize Findings

Use the instruction-layer attribution from Step 5 to inform the action column —
the typical fix shape biases the trivial-fix vs improvement judgment.

| Category        | Criteria                                        | Action         |
| --------------- | ----------------------------------------------- | -------------- |
| **Trivial fix** | Root cause clear, fix mechanical, low risk      | Implement + PR |
| **Improvement** | Pattern requires design, touches multiple files | Write spec     |
| **Observation** | Not actionable yet, or needs more data          | Note in report |

### 7. Audit Named Invariants

In addition to open-ended observation, verify the trace against the named
per-agent invariants listed in
[`references/invariants.md`](references/invariants.md). For each invariant that
applies to the trace's owner, search the trace for the evidence listed and
record PASS (with a quoted tool call) or FAIL (with what was searched for and
not found). Group findings by severity.

High-severity invariant failures — especially the contributor-lookup invariant
on `product-manager` traces — must result in a fix PR or spec just like any
other kata finding. Silent acceptance of a high-severity failure is itself a
process failure.

### 8. Report and Act

Run the DO-CONFIRM checklist above before producing the report.

Produce the analysis report using the template at
[`references/report-template.md`](references/report-template.md). Prefix with
run selection context, and append the invariant audit results grouped by
severity.

Then act on findings — both kata findings and audit findings flow through the
same fix-or-spec discipline:

- **Trivial fix** (mechanical, obvious, low risk) → branch from `main` as
  `fix/coach-<name>` (or `fix/audit-<name>` for audit-originated fixes), fix,
  commit, push, open PR. Batch related fixes into one PR when they share a root
  cause.
- **Improvement** (requires design, touches multiple files) → branch from `main`
  as `spec/<name>`, write a spec via `kata-spec`, push, open PR. Each distinct
  improvement gets its own branch and PR.

Every PR must branch directly from `main` — never from another fix or spec
branch.

## Memory: what to record

Append to the current week's log (see agent profile for the file path):

- **Trace analyzed** — Workflow name, run ID, date, conclusion, branch
- **Actionable findings** — Each finding with severity, category (trivial fix /
  improvement / observation), and action taken (PR number or spec name)
- **Core category** — The central phenomenon and theoretical propositions
- **Invariant audit results** — Each invariant checked with PASS/FAIL and quoted
  evidence
- **Instruction-layer attributions** — Which layers were implicated and what fix
  shapes resulted
- **Saturation notes** — Patterns confirmed, refuted, or newly emerged compared
  to prior cycles
- **Observations for teammates** — Callouts for specific agents

## Analysis Principles

The READ-DO checklist covers grounded theory fundamentals (no hypothesis,
in-vivo codes, memos during coding, full trace read, core category). These
principles add practical guidance:

- **Quote, don't paraphrase.** Exact error messages, commands, token counts.
- **Distinguish symptoms from causes.** The paradigm model forces you to trace
  causal conditions.
- **Count what matters.** Token usage, retry counts, wasted turns, cost.
- **Compare to intent.** Read the skill docs, compare to actual execution.
- **Maintain traceability.** Proposition → category → code → turn number.
- **Trace findings back to instruction layers.** When a failure's root cause is
  an instruction defect, name the layer. Attributed findings lead to layer
  fixes; unattributed findings lead to vague improvements.
- **Prefer upstream layers.** A symptom in L4 (skill execution) may have a root
  cause in L2 (task text). Fix the highest layer where the defect originates.

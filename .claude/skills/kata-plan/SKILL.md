---
name: kata-plan
description: >
  Write implementation plans (HOW/WHEN) for approved designs. Translate an
  approved design into concrete steps, file changes, sequencing, and risks
  for a trusted agent to execute. Sets plan phase to draft in specs/STATUS.
---

# Write and Review Plans

A plan defines HOW to implement and WHEN to sequence changes. Pair with the
[`kata-spec`](../kata-spec/SKILL.md) and
[`kata-design`](../kata-design/SKILL.md) skills — the spec captures WHAT/WHY,
the design captures WHICH/WHERE, the plan captures HOW/WHEN.

**A plan requires an existing approved design.** Without an approved design
there is no architectural direction to translate into implementation steps.

## When to Use

- Turning an approved design (`design approved` in STATUS) into an
  execution-ready plan
- Reviewing a plan before approval ("review plan NNN", "is plan NNN ready?")
- Creating an alternative plan variant for the same spec

## Checklists

<read_do_checklist goal="Internalize plan-writing boundaries before starting">

- [ ] Read `specs/STATUS` from main via `git show main:specs/STATUS` — confirm
      this spec is at `design approved`. Do not read the working-tree file:
      branch checkouts reflect branch state, not the authoritative lifecycle. Do
      not rely on the wiki, prior session memory, or PR descriptions.
- [ ] A plan requires an approved design — if no approved design exists, stop.
- [ ] Do not write or revise the spec — return it to `draft` if it needs
      changes.
- [ ] Do not implement — this skill writes the plan; `kata-implement` executes
      it.
- [ ] One plan per spec — do not bundle multiple specs into one plan.
- [ ] Read the spec and design end-to-end before writing. Restate problem,
      scope, success criteria, and architectural direction without referring
      back.

</read_do_checklist>

<do_confirm_checklist goal="Verify plan quality before recommending approval">

- [ ] One-paragraph approach. More rationale than that belongs in the design.
- [ ] Changes are concrete — exact file paths, functions, before/after.
- [ ] Blast radius visible — created, modified, and deleted files clear.
- [ ] Ordering explicit with stated dependencies.
- [ ] No per-step rationale paragraphs.
- [ ] Risks list only items the implementer cannot see from the plan itself.
- [ ] Libraries used is one line (packages + exports, or `none`).
- [ ] Execution recommendation present (which agents, sequential vs parallel).
- [ ] Clean sub-agent review panel of `plan-a.md` (and any parts) via
      [`kata-review`](../kata-review/SKILL.md) completed (fresh context, no
      prior bias, panel size per caller protocol) and every **blocker**,
      **high**, and **medium** finding addressed.

</do_confirm_checklist>

## Naming Convention

Plans live alongside their spec in `specs/{NNN}-{name}/`.

### Default plan

The first (and usually only) plan is always **`plan-a.md`**. Do not use
`plan.md` or other shorthands — the letter suffix keeps naming consistent
whether one plan or several exist.

### Alternative plans

When exploring competing approaches for the same spec, create additional
variants using sequential letters:

```
plan-a.md    ← default (always created first)
plan-b.md    ← alternative approach
plan-c.md    ← another alternative
```

Each variant should open with a brief rationale explaining how it differs from
plan-a. When the plan reaches `plan approved`, **plan-a is the plan that will be
implemented** unless the approver explicitly selects a different variant.

### Large plan decomposition

When a plan is too large to implement as a single unit — many files, multiple
independent phases, or risk of exceeding context — decompose it into numbered
parts:

```
plan-a.md       ← overview, strategy, and part index
plan-a-01.md    ← part 1 (independently executable)
plan-a-02.md    ← part 2 (independently executable)
plan-a-03.md    ← part 3 (independently executable)
```

**Rules for decomposition:**

- `plan-a.md` holds the approach, cross-cutting concerns, and a numbered index
  with a one-line summary per part.
- Each `plan-a-NN.md` is independently executable (its own scope, files,
  ordering, verification) and numbered in execution order. State inter-part
  dependencies explicitly.
- Decompose only when there is concrete benefit (size, independence,
  parallelism).
- `plan-a.md` includes an **Execution** section: which parts run in parallel vs
  sequentially, and which agent each part routes to (`staff-engineer` for code,
  `technical-writer` for docs). A plan may use both.

Alternative plans can also be decomposed (`plan-b.md`, `plan-b-01.md`, etc.).

## Writing a Plan (HOW + WHEN)

The plan translates an approved design into concrete implementation steps.

- **No re-introduction.** A plan's job is to let a trusted agent execute without
  re-reading the spec or design. Reference them by link; do not restate them.
  The "Approach" section is one paragraph — if more rationale is needed, the
  decisions belong in the design.
- **Per-step shape.** Each step is a heading plus: one sentence of intent; a
  file list (created / modified / deleted); the concrete change (code block,
  table, or bullet list); one line of verification. No per-step rationale
  paragraphs — decisions live in the Approach paragraph or the design.
- **Libraries used.** One line: `Libraries used: libfoo (a, b), libbar (c).` or
  `Libraries used: none.` No section heading, no paragraph.
- **Risks.** List risks the implementer cannot see from reading the plan. If the
  mitigation is "do the plan correctly", it is not a risk.
- **Execution recommendation.** Route parts to matching agents —
  `staff-engineer` for code, `technical-writer` for docs. For decomposed plans,
  state which parts can run in parallel vs sequentially.

**Form follows content.** Prefer tables for lists with shared structure (files,
steps, parts). Prefer bullets for flat facts. Use prose only for the narrative
thread between them. If a paragraph could be a row, make it a row. Do not
restate what the artifact already shows.

## Reviewing a Plan

Evaluate the plan against the DO-CONFIRM checklist. If all criteria are met,
recommend approval. If any falls short, request changes — the plan stays at
`plan draft` until resolved.

When multiple variants exist, note which is recommended (plan-a is the default).
Approval is a human action — report clearly.

## Process

### Step 0: Read Memory

Read memory per the agent profile (your summary, the current week's log, and
teammates' summaries). Extract specs previously planned and any deferred work
from prior `staff-engineer` entries.

### Steps

1. **Find the spec.** Requires `design approved` in `specs/STATUS`; otherwise
   stop.
2. **Study the spec and design.** Read both end to end.
3. **Research the codebase.** Read the files the plan will target.
4. **Write the plan.** Create `plan-a.md`. Each step independently verifiable.
   Decompose into parts if large (see § Large plan decomposition).
5. **Clean sub-agent review panel.** Follow the
   [`kata-review` caller protocol](../kata-review/references/caller-protocol.md).
   Tell each reviewer not to invoke `kata-plan`. Address every confirmed
   blocker/high/medium finding before advancing.
6. **Present the plan.** Iterate until satisfied.
7. **Update STATUS.** Set the spec to `plan draft` in `specs/STATUS`.

## Memory: what to record

Append to the current week's log (see agent profile for the file path):

- **Specs planned** — Spec number, name, and status transition
- **Plan decisions** — Key approach choices and why (so the implementer has
  context)
- **Deferred specs** — Specs skipped and why (not approved, missing info, etc.)
- **Metrics** — Record at least one measurement to
  `wiki/metrics/{agent}/{domain}/` per the
  [`kata-metrics`](../kata-metrics/SKILL.md) protocol. If no CSV exists, create
  it with the header row. These feed XmR analysis in the storyboard meeting.

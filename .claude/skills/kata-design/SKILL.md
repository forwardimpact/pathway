---
name: kata-design
description: >
  Create design documents (WHICH/WHERE) for approved specs. A design is a
  max-200-line architectural sketch — components, interfaces, data flow, and
  key decisions with trade-offs — that gives reviewers a high-leverage point
  to redirect architecture before the full plan is written. Design is approved
  when its PR carries the `design:approved` label or an APPROVED review.
---

# Write and Review Designs

A design defines WHICH components exist, WHERE they interact, and what
interfaces connect them. It sits between the
[`kata-spec`](../kata-spec/SKILL.md) skill (WHAT/WHY) and the
[`kata-plan`](../kata-plan/SKILL.md) skill (HOW/WHEN). The spec captures the
problem and scope; the design captures components, interfaces, and data flow;
the plan translates those into file-level changes and execution ordering.

**A design requires an existing approved spec.** Without an approved spec there
is no commitment to implement, and a design has nothing to shape.

## When to Use

- Turning a merged spec (`specs/NNN/spec.md` on `origin/main`, not just a
  `spec:approved` label on an open PR) into an architectural design
- Reviewing a design before approval ("review design NNN", "is design NNN
  ready?")
- Revisiting a design whose direction needs rethinking before planning

## Checklists

<read_do_checklist goal="Internalize design-writing boundaries before starting">

- [ ] Confirm `specs/NNN/spec.md` exists on `origin/main` after
      `git fetch origin main`. A `spec:approved` label on an open PR is not
      sufficient — wait for the merge.
- [ ] Do not write or revise the spec — return it to `draft` if it needs
      changes.
- [ ] Do not write the plan — this skill writes the design; `kata-plan`
      translates it into implementation steps.
- [ ] One design per spec — do not bundle multiple specs into one design.
- [ ] Read the spec end-to-end before writing. Restate problem, scope, and
      success criteria without referring back.

</read_do_checklist>

<do_confirm_checklist goal="Verify design quality before recommending approval">

- [ ] Components, interfaces, and data flow stated before detail.
- [ ] Each key decision names a rejected alternative and why.
- [ ] Mermaid diagrams used where they clarify structure.
- [ ] Stays within spec scope — no scope expansion.
- [ ] Stays at the architectural level — names components, classes, interfaces,
      and data structures but not file-level changes, execution ordering, or
      implementation steps (those belong in the plan).
- [ ] Under 200 lines total.
- [ ] Clean sub-agent review panel of `design-a.md` via
      [`kata-review`](../kata-review/SKILL.md) completed (fresh context, no
      prior bias, panel size per caller protocol) and every **blocker**,
      **high**, and **medium** finding addressed.
- [ ] Run `bun run format:fix` before pushing — commit any changes the formatter
      makes.

</do_confirm_checklist>

## Naming Convention

Designs live alongside their spec in `specs/{NNN}-{name}/`.

### Default design

The first (and usually only) design is always **`design-a.md`**. Do not use
`design.md` or other shorthands — the letter suffix keeps naming consistent
whether one design or several exist.

### Alternative designs

When exploring competing architectural approaches for the same spec, create
additional variants using sequential letters:

```
design-a.md    ← default (always created first)
design-b.md    ← alternative approach
design-c.md    ← another alternative
```

Each variant should open with a brief rationale explaining how it differs from
design-a. When the design is approved, **design-a is the design that will be
planned** unless the approver explicitly selects a different variant.

No decomposition — if a design cannot fit in 200 lines, narrow the spec instead.

## Writing a Design (WHICH + WHERE)

The design answers: which components exist, where they interact, and what
interfaces connect them — and why this architecture over alternatives.

- **Architecture, not execution.** Name components, interfaces, data flow. Do
  not specify file-level changes or execution ordering — those belong in the
  plan.
- **Decisions with trade-offs.** Each architectural choice names at least one
  rejected alternative and why.
- **One home per decision.** If a decision has a `## Key Decisions` table row,
  do not also write a `Rejected:` paragraph under its section. Table or prose,
  not both.
- **Visual when possible.** Mermaid diagrams for component relationships, data
  flow, state machines, sequence diagrams.
- **Scope-faithful.** Stay within the spec's scope. If scope should change,
  return the spec to draft rather than expanding silently.

**Form follows content.** Prefer tables for lists with shared structure
(components, decisions). Prefer bullets for flat facts. Use prose only for the
narrative thread between them. If a paragraph could be a row, make it a row. Do
not restate what the artifact already shows.

## Approval

A design is approved when its PR carries the `design:approved` label **or** has
an APPROVED review by a trusted account. Once the design PR merges,
`specs/NNN/design-a.md` exists on `main` and the phase is by definition
complete. See
[`coordination-protocol.md` § Approval signal](../../agents/references/coordination-protocol.md#approval-signal).

## Reviewing a Design

Evaluate `design-a.md` against the qualities listed in "Writing a Design" above,
then run the DO-CONFIRM checklist at the top of this skill.

If all criteria are met, apply the approval signal:

```sh
gh pr edit <number> --add-label design:approved
```

If any criterion falls short, request changes via PR comment — do not apply the
label.

## Process

### Step 0: Read Memory

Read memory per the agent profile (your summary, the current week's log, and
teammates' summaries). Extract specs previously designed and any deferred work
from prior `staff-engineer` entries.

### Steps

1. **Find the spec.** Run `git fetch origin main`, then require
   `specs/NNN/spec.md` on `origin/main`; otherwise stop. An open spec PR with
   `spec:approved` does not satisfy this — wait for the merge.
2. **Study the spec.** Read `spec.md` end to end.
3. **Research the codebase.** Read the code areas the spec targets.
4. **Write the design.** Create `design-a.md`. Stay under 200 lines. Each
   architectural choice names a rejected alternative.
5. **Open a `design(NNN): …` PR.** The PR title carries the spec id.
6. **Clean sub-agent review panel.** Follow the
   [`kata-review` caller protocol](../kata-review/references/caller-protocol.md).
   Tell each reviewer not to invoke `kata-design`. Address every confirmed
   blocker/high/medium finding before advancing.
7. **Apply approval signal.** When the panel passes, run
   `gh pr edit <number> --add-label design:approved`.

## Memory: what to record

Append to the current week's log (see agent profile for the file path):

- **Specs designed** — Spec number, name, and status transition
- **Design decisions** — Key architectural choices and why (so the planner has
  context)
- **Deferred specs** — Specs skipped and why (not approved, missing info, etc.)

This skill produces a design document — work-in-progress for the downstream plan
and implementation — so it does not record metrics. See
[`kata-metrics`](../kata-metrics/SKILL.md) for the recording-eligibility rule.

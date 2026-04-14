---
name: kata-design
description: >
  Create design documents (DIRECTION) for approved specs. A design is a
  max-200-line architectural sketch — components, interactions, key decisions
  with trade-offs, and Mermaid diagrams — that gives reviewers a high-leverage
  point to influence direction before the full plan is written. Sets design
  phase to draft in specs/STATUS.
---

# Write and Review Designs

A design defines DIRECTION — the architectural approach for an approved spec.
It sits between the [`kata-spec`](../kata-spec/SKILL.md) skill (WHAT/WHY) and
the [`kata-plan`](../kata-plan/SKILL.md) skill (HOW). The spec captures the
problem and scope; the design captures the architectural direction; the plan
translates that direction into concrete implementation steps.

**A design requires an existing approved spec.** Without an approved spec there
is no commitment to implement, and a design has nothing to shape.

**200-line limit.** A design document must not exceed 200 lines of markdown text
or Mermaid diagrams. This constraint is the point — it forces the author to
communicate direction, not detail. If a design genuinely needs more space, the
spec's scope is too broad and should be narrowed.

## When to Use

- Turning an approved spec (`spec approved` in STATUS) into an architectural
  design
- Reviewing a design before approval ("review design NNN", "is design NNN
  ready?")
- Revisiting a design whose direction needs rethinking before planning

## Checklists

<read_do_checklist goal="Internalize design-writing boundaries before starting">

- [ ] A design requires an approved spec — if no approved spec exists, stop.
- [ ] Do not write or revise the spec — return it to `draft` if it needs
      changes.
- [ ] Do not write the plan — this skill writes the design; `kata-plan`
      translates it into implementation steps.
- [ ] One design per spec — do not bundle multiple specs into one design.
- [ ] Read the spec end-to-end before writing. Restate problem, scope, and
      success criteria without referring back.

</read_do_checklist>

<do_confirm_checklist goal="Verify design quality before recommending approval">

- [ ] Direction and rationale stated before detail.
- [ ] Each key decision names a rejected alternative and why.
- [ ] Mermaid diagrams used where they clarify structure.
- [ ] Stays within spec scope — no scope expansion.
- [ ] No file-level implementation detail — file paths, function signatures, and
      before/after code belong in the plan.
- [ ] Under 200 lines total.
- [ ] Clean sub-agent review of `design.md` via
      [`kata-review`](../kata-review/SKILL.md) completed (fresh context, no
      prior bias) and every **blocker**, **high**, and **medium** finding
      addressed.

</do_confirm_checklist>

## Naming Convention

The design is always **`design.md`**. There are no variants and no
decomposition — a design that cannot fit in 200 lines signals that the spec
should be narrowed, not that the design should be split.

## Writing a Design (DIRECTION)

The design answers: what architectural direction are we heading, and why this
direction over alternatives?

Structure and format are up to you — match the complexity of the change. The
DO-CONFIRM checklist verifies these qualities; the guidance below explains what
each one means in practice:

- **Direction over detail.** Describe components, interactions, and data flow.
  Do not name file paths, function signatures, or code patterns — those belong
  in the plan. The design should survive implementation-level changes without
  needing revision.
- **Decisions with trade-offs.** Each architectural choice should name at least
  one rejected alternative and why it was rejected. This is the primary review
  leverage point — a reviewer can redirect a decision here at low cost, versus
  after a full plan is written.
- **Visual when possible.** Use Mermaid diagrams for component relationships,
  data flow, state machines, and sequence diagrams. A diagram that replaces two
  paragraphs of prose is always a win.
- **Scope-faithful.** Stay within the spec's declared scope. If the design
  reveals that the scope should change, return the spec to draft rather than
  expanding silently.
- **Plan-enabling.** After reading the design, a planner should be able to write
  the plan without ambiguity about architectural direction. If the planner would
  need to make architectural decisions, the design is incomplete.

## Status

This skill sets `design draft` in `specs/STATUS`. A human advances it to
`design approved` during review. See `specs/STATUS` header for the full
lifecycle.

## Reviewing a Design

Evaluate `design.md` against the qualities listed in "Writing a Design" above,
then run the DO-CONFIRM checklist at the top of this skill.

If all criteria are met, recommend approval. If any criterion falls short,
request changes — the design stays at `design draft` until issues are resolved.

Approval is a human action — report your recommendation clearly. See
`specs/STATUS` header for the full lifecycle.

## Process

### Step 0: Read Memory

Read memory per the agent profile (your summary, the current week's log, and
teammates' summaries). Extract specs previously designed and any deferred work
from prior `staff-engineer` entries.

### Steps

1. **Find the spec.** A design requires `spec approved` in `specs/STATUS`. If
   the spec is still at `spec draft` or missing, stop — it must be approved
   first.
2. **Study the spec.** Read `spec.md` end to end. You should be able to restate
   the problem, scope, and success criteria without referring back.
3. **Research the codebase.** Read the code areas the spec targets. Understand
   current architecture, patterns, and constraints that will shape the design.
4. **Write the design.** Create `design.md` in the spec directory. Focus on
   direction, decisions, and diagrams. Stay under 200 lines. Each architectural
   choice should name a rejected alternative.
5. **Clean sub-agent review.** Follow the
   [`kata-review` caller protocol](../kata-review/references/caller-protocol.md)
   to launch a fresh sub-agent that grades `design.md`. Tell the reviewer not to
   invoke `kata-design`. Verify findings, address all confirmed
   blocker/high/medium issues before advancing.
6. **Present the design.** Share it for feedback. Iterate until satisfied. The
   design stays at `design draft` until a human approves it.
7. **Update STATUS.** Set the spec to `design draft` in `specs/STATUS`.

## Memory: what to record

Append to the current week's log (see agent profile for the file path):

- **Specs designed** — Spec number, name, and status transition
- **Design decisions** — Key architectural choices and why (so the planner has
  context)
- **Deferred specs** — Specs skipped and why (not approved, missing info, etc.)

## What NOT to Do

The READ-DO checklist covers the core boundaries (no spec writing, no plan
writing, one design per spec). Additionally:

- **Do not write a design whose spec is not yet approved.** The spec must show
  `spec approved` in STATUS before designing begins.
- **Do not exceed 200 lines.** If the design needs more, narrow the spec.
- **Do not include file-level implementation detail.** File paths, function
  signatures, and code snippets belong in the plan.

---
name: kata-spec
description: >
  Write specifications (WHAT/WHY) for features, changes, and improvements.
  Sets spec phase to draft in specs/STATUS. Use when proposing changes,
  capturing findings as actionable specs, or evaluating spec quality.
  Pair with the `kata-plan` skill for the HOW side.
---

# Write and Review Specs

A spec defines WHAT to build and WHY. Pair with the
[`kata-plan`](../kata-plan/SKILL.md) skill — once a spec is approved, the staff
engineer turns it into a plan that translates the WHAT/WHY into HOW.

**Spec and plan are independent deliverables.** Only produce the one the user
asked for. If they ask for a spec, write the spec and stop.

## When to Use

- Capturing a finding (audit, kata walk, product feedback) as actionable work
- Documenting a proposed feature, change, or improvement with rationale
- Reviewing a spec before it advances to planning ("review spec NNN", "is spec
  NNN ready?")

## Checklists

<read_do_checklist goal="Ensure the WHAT/WHY boundary when writing a spec">

- [ ] Only produce the deliverable asked for — if asked for a spec, stop after
      the spec. Do not also write a plan.
- [ ] No implementation details in the spec — file paths, function signatures,
      and code patterns belong in the plan.
- [ ] When reviewing: evaluate, do not rewrite. If changes are needed, return to
      `draft`.
- [ ] Clarify motivation, scope, and success criteria with the user before
      writing.

</read_do_checklist>

<do_confirm_checklist goal="Verify spec quality before recommending approval">

- [ ] Problem is stated first, backed by evidence (errors, metrics, examples).
- [ ] Scope names specific files, APIs, or entities — and states what is
      excluded.
- [ ] Success criteria are verifiable (a command, observable behaviour, or
      testable property).
- [ ] No implementation details have leaked in (HOW belongs in the plan).
- [ ] Clean sub-agent review via [`kata-review`](../kata-review/SKILL.md)
      completed (fresh context, no prior bias) and every **blocker**, **high**,
      and **medium** finding addressed.

</do_confirm_checklist>

## Directory Structure

```
specs/{NNN}-{kebab-case-name}/
  spec.md      WHAT and WHY      (this skill)
  plan-a.md    HOW               (the `kata-plan` skill)
```

Number directories sequentially. Use the next available number.

## Writing a Spec (WHAT and WHY)

The spec answers two questions: what are we changing, and why does it matter?

Structure and format are up to you — adapt to whatever best serves the content.
Focus on these qualities:

- **Problem first.** The reader should feel the pain or see the opportunity
  before encountering any proposal. Back it up with evidence — errors, metrics,
  audit findings, examples of current behaviour.
- **Specific scope.** Name the files, APIs, entities, or behaviours affected.
  Make clear what is and is not included. Vague specs produce vague work.
- **Verifiable success.** Define what "done" looks like in terms someone can
  test — a command to run, a behaviour to observe, a property to check.
- **No HOW.** If you find yourself describing implementation steps, stop and
  save it for the plan. The spec should remain stable as implementation details
  change.

## Status

This skill sets `spec draft` in `specs/STATUS`. A human advances it to
`spec approved` during review. See `specs/STATUS` header for the full lifecycle.

## Reviewing a Spec

Evaluate `spec.md` against the qualities listed in "Writing a Spec" above, then
run the DO-CONFIRM checklist at the top of this skill.

If all criteria are met, recommend approval. If any criterion falls short,
request changes — the spec stays at `spec draft` until issues are resolved.

Approval is a human action — report your recommendation clearly. If you cannot
commit changes, report your decision so the caller can act on it.

## Process

1. **Clarify first.** Ask the user (or upstream finding source) questions before
   writing anything. Understand the motivation, desired scope, constraints, and
   what success looks like. A brief conversation up front prevents major
   rewrites later.
2. **Research.** Read relevant code, data files, and existing specs. Understand
   the current state before proposing changes.
3. **Write the spec.** Focus on WHAT and WHY. Do not include implementation
   details — those go in the plan.
4. **Update STATUS.** Add the spec to `specs/STATUS` with `spec draft`.
5. **Clean sub-agent review.** Follow the
   [`kata-review` caller protocol](../kata-review/references/caller-protocol.md)
   to launch a fresh sub-agent that grades `spec.md`. Tell the reviewer not to
   invoke `kata-spec`. Verify findings, address all confirmed
   blocker/high/medium issues before advancing.
6. **Present the spec.** Share it for feedback. Iterate until satisfied. The
   spec stays at `spec draft` until a human approves it. Stop here — the plan
   is the staff engineer's job.

## What NOT to Do

The READ-DO checklist covers the core boundaries (spec only, no implementation
details, evaluate don't rewrite). Additionally:

- **Do not approve without reading.** Every criterion must be checked against
  the actual content.

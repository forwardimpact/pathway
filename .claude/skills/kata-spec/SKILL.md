---
name: kata-spec
description: >
  Write specifications (WHAT/WHY) for features, changes, and improvements.
  Spec is approved when its PR carries the `spec:approved` label or an
  APPROVED review by a trusted account. Use when proposing changes, capturing
  findings as actionable specs, or evaluating spec quality. Pair with the
  `kata-plan` skill for the HOW side.
---

# Write and Review Specs

A spec defines WHAT to build and WHY. Pair with the
[`kata-design`](../kata-design/SKILL.md) and
[`kata-plan`](../kata-plan/SKILL.md) skills — once a spec is approved, the staff
engineer shapes it into an architectural design (WHICH/WHERE) and then a
concrete plan (HOW/WHEN).

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
- [ ] Clean sub-agent review panel of `spec.md` via
      [`kata-review`](../kata-review/SKILL.md) completed (fresh context, no
      prior bias, panel size per caller protocol) and every **blocker**,
      **high**, and **medium** finding addressed.

</do_confirm_checklist>

## Directory Structure

```
specs/{NNN}-{kebab-case-name}/
  spec.md      WHAT and WHY      (this skill)
  design-a.md  WHICH and WHERE   (the `kata-design` skill)
  plan-a.md    HOW and WHEN      (the `kata-plan` skill)
```

Number directories sequentially. Use the next available number.

## Writing a Spec (WHAT and WHY)

The spec answers two questions: what are we changing, and why does it matter?

- **Problem first.** Evidence before proposal — errors, metrics, examples.
- **Specific scope.** Name affected files, APIs, entities; state what is
  excluded.
- **Verifiable success.** Each criterion is a claim plus the command or path
  that verifies it. One sentence each. No rationale, no alternatives considered.
- **No HOW.** Name what each component does, not which mechanism implements it.
  Tool selection and sequencing belong in the design and plan.

**Form follows content.** Prefer tables for lists with shared structure (files,
criteria, alternatives). Prefer bullets for flat facts. Use prose only for the
narrative thread between them. If a paragraph could be a row, make it a row. Do
not restate what the artifact already shows.

## Approval

A spec is approved when its PR carries the `spec:approved` label **or** has an
APPROVED review by a trusted account (top-7 contributor or `kata-agent-team`).
Phase progression is derived from `main`: once a spec PR merges,
`specs/NNN/spec.md` exists on `main` and the spec is by definition approved. See
[`coordination-protocol.md` § Approval signal](../../agents/references/coordination-protocol.md#approval-signal).

## Reviewing a Spec

Evaluate `spec.md` against the qualities listed in "Writing a Spec" above, then
run the DO-CONFIRM checklist at the top of this skill.

If all criteria are met, apply the approval signal:

```sh
gh pr edit <number> --add-label spec:approved
```

If any criterion falls short, request changes via PR comment — do not apply the
label.

## Process

1. **Clarify first.** Ask about motivation, scope, constraints, and success
   before writing.
2. **Research.** Read relevant code, data, and existing specs.
3. **Write the spec.** WHAT and WHY only.
4. **Open a `spec(NNN): …` PR.** The PR title carries the spec id; merge of that
   PR is what advances the phase.
5. **Clean sub-agent review panel.** Follow the
   [`kata-review` caller protocol](../kata-review/references/caller-protocol.md).
   Tell each reviewer not to invoke `kata-spec`. Address every confirmed
   blocker/high/medium finding before advancing.
6. **Apply approval signal.** When the panel passes and the DO-CONFIRM checks
   are met, run `gh pr edit <number> --add-label spec:approved` so
   `kata-release-merge` lets the PR through. Stop at the spec — the plan is the
   staff engineer's job.

## Memory: what to record

Append to the current week's log (see agent profile for the file path):

- **Specs written** — Spec number, name, and status
- **Review results** — Specs reviewed and disposition (approved/changes needed)
- **Deferred work** — Findings not yet captured as specs
- **Metrics** — Record at least one measurement to
  `wiki/metrics/{skill}/` per the
  [`kata-metrics`](../kata-metrics/SKILL.md) protocol. If no CSV exists, create
  it with the header row. These feed XmR analysis in the storyboard meeting.

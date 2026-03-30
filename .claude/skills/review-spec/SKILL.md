---
name: review-spec
description: >
  Review a spec (and plan, if present) against quality criteria, then approve it
  or request changes. Use when a spec is in draft or review status and needs
  formal evaluation before implementation.
---

# Review Spec

Evaluate a specification and its plan against quality criteria, then advance it
toward implementation or send it back for revision. This is the gate between
writing and implementing.

## When to Use

- A spec exists and the user wants it reviewed before implementation
- The user says "review spec NNN" or "is spec NNN ready?"
- A spec's STATUS is `draft` or `review` and needs a decision

## Process

### 1. Read the spec directory

Read every file in `specs/{NNN}-*/` — `spec.md`, all `plan*.md` files, and any
supporting documents.

### 2. Evaluate the spec

Assess `spec.md` against these criteria:

- **Problem is clear.** The reader can feel the pain or see the opportunity.
  Evidence is provided — errors, metrics, audit findings, examples.
- **Scope is specific.** Affected files, APIs, entities, or behaviours are
  named. What is and is not included is explicit.
- **Success is verifiable.** "Done" is defined in terms someone can test — a
  command to run, a behaviour to observe, a property to check.
- **No implementation leakage.** The spec describes WHAT and WHY, not HOW. If
  implementation details have crept in, flag them.

### 3. Evaluate the plan (if present)

Assess `plan.md` (or plan variants) against these criteria:

- **Approach is stated.** The overall strategy and rationale come before
  individual changes.
- **Changes are concrete.** Exact file paths, functions, and before/after code
  are shown where they clarify intent.
- **Blast radius is visible.** Which files are created, modified, or deleted is
  easy to see.
- **Ordering is explicit.** Dependencies between changes are stated and the
  order is justified.
- **Decisions are explained.** Non-obvious choices include brief rationale.

### 4. Decide

If all criteria are met, approve. If any criterion falls short, request changes.

| Situation                  | Decision | Target status |
| -------------------------- | -------- | ------------- |
| Spec + plan approved       | Approve  | `planned`     |
| Spec approved, no plan yet | Approve  | `review`      |
| Changes requested          | Revise   | `draft`       |

### 5. Update STATUS

Update `specs/STATUS` to reflect the decision from Step 4.

If you are operating in a context where you cannot commit changes (e.g.,
evaluating a spec PR for another workflow), report your decision and target
status clearly — the caller is responsible for acting on it.

## What NOT to Do

- **Do not rewrite the spec or plan.** This skill evaluates — it does not
  author. If changes are needed, return the status to `draft` for `write-spec`.
- **Do not approve without reading.** Every criterion must be checked against
  the actual content.

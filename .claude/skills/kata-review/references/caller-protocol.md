# Sub-Agent Review Protocol

Shared protocol for callers of `kata-review`. Used by:

- `kata-spec` Step 5, `kata-design` Step 5, `kata-plan` Step 5 — panel of 3
- `kata-implement` Step 7 — panel of 5

## Why a panel

Sub-agent reviewers spawn cold and can misread intent, miss surrounding code, or
flag false positives. Independent reviewers produce uncorrelated errors: a
finding flagged by ≥⌈N/2⌉ reviewers is high-signal; a singleton is likely noise
but must still be verified. Odd N enables majority voting.

## Panel size

| Caller           | Artifact                    | Reviewers |
| ---------------- | --------------------------- | --------- |
| `kata-spec`      | `spec.md`                   | 3         |
| `kata-design`    | `design.md`                 | 3         |
| `kata-plan`      | `plan-a.md` (+ parts)       | 3         |
| `kata-implement` | diff (`origin/main...HEAD`) | 5         |

Implementation diffs get 5 because the artifact is larger, the step is
irreversible (code lands on `main`), and the surface area for subtle bugs and
security regressions is largest. Spec/design/plan artifacts are bounded and have
an implicit second pass at the next phase.

## How to invoke

1. **Launch N fresh sub-agents in parallel** via a single message with N `Agent`
   tool calls — parallelism is required; sequential calls waste wall-clock time
   and tempt context leakage. Each sub-agent:
   - Starts cold with no prior conversation context.
   - Loads the [`kata-review`](../SKILL.md) skill.
   - Receives the **identical** prompt: artifact type, artifact path, spec path
     (for design/plan/diff), design path (for plan/diff), plan path (for diff),
     and branch name (for diff).
   - Is told not to invoke the parent skill (e.g., "do not invoke `kata-spec`")
     — defense in depth on top of the structural recursion fix.

2. **Do not share a scratchpad or cross-feed reviewer output.** Correlated
   errors collapse the ensemble back to one reviewer's signal.

3. **Collect all N findings reports** before merging. A missing report is not a
   pass — re-spawn that reviewer.

## How to merge findings

`kata-review` emits findings in a structured format:
`<file:line> — <criterion> — <one-sentence reason>`.

1. **Group by `(file:line, criterion)` key.** Findings that match on both fields
   are duplicates regardless of severity phrasing or reason wording.

2. **Record the vote count** per unique finding (how many of N reviewers flagged
   it).

3. **Pick severity by consensus, not by max.** Take the median severity across
   reviewers who flagged the finding — a Blocker flagged once and a Low flagged
   four times is a Low/Medium concern, not a Blocker.

4. **Partition the merged list** into three buckets:
   - **Consensus (≥⌈N/2⌉ votes)** — treat as the panel's verdict. Verify and
     address all confirmed blocker/high/medium findings before advancing.
   - **Minority (between singleton and consensus)** — verify with extra care; a
     2-of-5 finding on an implement diff is often a real edge case only some
     reviewers spotted.
   - **Singleton (1 vote)** — likely false positive, but not dismissed silently.
     Verify each; address or record the rationale for dismissal.

5. **Scope-creep guard.** If reviewers flag issues outside the artifact's stated
   scope, dismiss by default with a one-line note — scope is set by the spec,
   not the review panel.

## Why this is safe

`kata-review` never spawns sub-agents — that is the structural property that
prevents the spec / plan / implement review loop from recursing. Panel size does
not change this invariant; each reviewer is still a leaf. See
[KATA.md § Recursion-safe self-review](../../../../KATA.md#recursion-safe-self-review).

## How to handle findings

- **Verify** every unique finding against the actual artifact before acting on
  it. The caller is accountable, not the panel.
- After verification, address every confirmed **blocker**, **high**, and
  **medium** finding before advancing (approving, pushing, or merging).
- **Low** findings are optional. Document if dismissed.
- If reviewers raise blockers you disagree with — including consensus blockers —
  resolve the disagreement explicitly: revise the artifact, or record the
  rationale for dismissal. Silent dismissal is not allowed.

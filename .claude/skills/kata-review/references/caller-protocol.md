# Sub-Agent Review Protocol

Shared protocol for callers of `kata-review`. Used by:

- `kata-spec` Step 5, `kata-design` Step 5, `kata-plan` Step 5 — panel of 3
- `kata-implement` Step 7 — panel of 5

## Why a panel

Cold sub-agents produce uncorrelated errors. A finding flagged by ≥⌈N/2⌉
reviewers is high-signal; singletons get verified but often prove noise. Odd N
enables majority voting.

## Panel size

| Caller           | Artifact                    | Reviewers |
| ---------------- | --------------------------- | --------- |
| `kata-spec`      | `spec.md`                   | 3         |
| `kata-design`    | `design-a.md`               | 3         |
| `kata-plan`      | `plan-a.md` (+ parts)       | 3         |
| `kata-implement` | diff (`origin/main...HEAD`) | 5         |

Implementation diffs get 5 because the artifact is larger, the step is
irreversible (code lands on `main`), and the surface area for subtle bugs and
security regressions is largest. Spec/design/plan artifacts are bounded and have
an implicit second pass at the next phase.

## How to invoke

1. **Launch N fresh sub-agents in parallel** via a single message with N `Agent`
   tool calls. Parallelism is required for two reasons: wall-clock time, and so
   the caller cannot (accidentally or otherwise) cross-feed one reviewer's
   output into another's prompt. Each sub-agent:
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

Findings arrive under `### Blocker` / `### High` / `### Medium` / `### Low`,
each row shaped `<file:line> — <criterion> — <one-sentence reason>` (or a commit
hash in place of `file:line` for diffs).

1. **Group semantically.** Merge findings citing the same `file:line` (or nearby
   lines in the same hunk) that raise the same concern, even if worded
   differently. When in doubt, merge.
2. **Record vote count and each flagging reviewer's severity.**
3. **Pick severity by mode; tie-break high.** Vote count reflects reach;
   severity reflects seriousness.
4. **Partition by vote count:**
   - **Consensus (≥⌈N/2⌉):** verify and address all confirmed blocker/high/
     medium findings in the same turn.
   - **Minority (>1, <⌈N/2⌉):** empty for N=3. For N=5, verify with extra care.
   - **Singleton (1):** verify each; address or record dismissal rationale.
5. **Scope-creep guard.** Dismiss findings raising concerns outside the
   artifact's declared scope (spec scope for design/plan, plan scope for diffs;
   user intent for specs). Exception: consensus "scope-creep in the diff"
   findings stand.

## Why this is safe

`kata-review` never spawns sub-agents — that is the structural property that
prevents the spec / plan / implement review loop from recursing. Panel size does
not change this invariant; each reviewer is still a leaf. See
[KATA.md § Recursion-safe self-review](../../../../KATA.md#recursion-safe-self-review).

## How to handle findings

- **Verify** every unique finding against the actual artifact before acting on
  it. The caller is accountable, not the panel.
- **Proceed without pausing.** After verification, address every confirmed
  consensus **blocker**, **high**, and **medium** finding in the same turn — do
  not stop to ask the user for permission to fix them. Acting on the panel's
  verdict is part of this Process step, not a separate approval gate. Fix the
  artifact, re-run the panel if the fix is substantial, then advance.
- **Low** findings are optional. Document if dismissed.
- **False positives.** If you verify a finding and judge it a false positive,
  record a one-line rationale in the commit message or artifact and continue.
  Silent dismissal is not allowed.
- **Disagreement with a consensus blocker.** Revise the artifact to address the
  underlying concern, or record a rationale — in the same turn, without
  stopping.

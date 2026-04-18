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

`kata-review` emits findings grouped under `### Blocker` / `### High` /
`### Medium` / `### Low` headers, with each row shaped
`<file:line> — <criterion> — <one-sentence reason>` (or `<commit-hash>` in place
of `file:line` when a reviewer cites a commit).

1. **Group semantically, not by string equality.** Two findings are the same
   when they cite the same `file:line` (or commit hash, or nearby lines in the
   same hunk) _and_ raise the same underlying concern. The `<criterion>` phrase
   is free-form; merge findings that describe the same defect in different
   words. When in doubt, merge — a combined finding is easier to verify than two
   near-duplicates.

2. **Record the vote count** per unique finding (how many of N reviewers flagged
   it) and the severity each flagging reviewer assigned (read from the
   `### <Level>` section header the finding appeared under in that reviewer's
   report).

3. **Pick severity by mode, tie-breaking high.** Use the most common severity
   among the reviewers who flagged the finding. If two severities tie, pick the
   higher one to stay cautious. A Blocker flagged by 1 of 5 with four silent
   reviewers is a Blocker at vote 1 — the vote count, not the severity, reflects
   how many reviewers saw it.

4. **Partition the merged list** by vote count:
   - **Consensus (≥⌈N/2⌉ votes)** — the panel's verdict. Verify and address
     every confirmed blocker/high/medium finding in the same turn, without
     pausing; see `How to handle findings` below.
   - **Minority (>1 and <⌈N/2⌉ votes)** — for N=5 this is the 2-vote band; for
     N=3 panels this bucket is empty and findings are either Consensus or
     Singleton. Verify with extra care — a 2-of-5 finding is often a real edge
     case only some reviewers spotted.
   - **Singleton (1 vote)** — likely false positive, but not dismissed silently.
     Verify each; address or record the rationale for dismissal.

5. **Scope-creep guard.** Dismiss by default any finding that raises a concern
   outside the artifact's declared scope (spec scope for design/plan, plan scope
   for diffs). For a spec review there is no prior scope document — use the
   user's stated intent instead. This guard does **not** override kata-review's
   own scope-creep criterion for diffs ("the diff refactors or adds unrelated
   changes"); consensus findings of that kind remain Consensus and must be
   addressed.

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

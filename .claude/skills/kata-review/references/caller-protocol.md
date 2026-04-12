# Sub-Agent Review Protocol

Shared protocol for callers of `kata-review`. Used by `kata-spec` (Step 5),
`kata-plan` (Step 5), and `kata-implement` (Step 8).

## How to invoke

1. **Launch a fresh sub-agent** via the `Agent` tool with no prior conversation
   context. Instruct it to load the [`kata-review`](../SKILL.md) skill and
   grade the artifact (spec, plan, or diff).

2. **Tell the reviewer not to invoke the parent skill** (e.g., "do not invoke
   `kata-spec`") — defense in depth on top of the structural recursion fix.

3. **Provide enough context** for the reviewer to act independently — artifact
   path, spec path (for plans and diffs), plan path (for diffs), and branch name
   (for diffs).

## Why this is safe

`kata-review` never spawns sub-agents — that is the structural property that
prevents the spec / plan / implement review loop from recursing. See
[KATA.md § Recursion-safe self-review](../../../../KATA.md#recursion-safe-self-review).

## How to handle findings

- **Verify** every finding against the actual artifact before acting on it.
  Sub-agent reviewers operate without prior conversation context and can misread
  intent, miss surrounding code, or flag false positives.
- After verification, address every confirmed **blocker**, **high**, and
  **medium** finding before advancing (approving, pushing, or merging).
- **Low** findings are optional. Document if dismissed.
- If the reviewer raises blockers you disagree with, resolve the disagreement
  explicitly — revise the artifact, or record the rationale for dismissal.
  Silent dismissal is not allowed.

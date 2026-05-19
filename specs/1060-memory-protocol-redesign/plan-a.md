# Plan 1060 — Memory Protocol Redesign

## Approach

`fit-wiki` becomes the agent's memory surface before the protocol cites it.
Land the CLI primitives first (Part 01), then rewrite the protocol and seed
`MEMORY.md ## Active Claims` so the contracts have implementations
(Part 02), then update every citation across agent profiles and skills so
the read/write asymmetry that fed F11 cannot reappear (Part 03), then wire
mechanical enforcement and the trace-sample verification (Part 04). The
spec mandates the protocol and the CLI ship together — they share one PR
series on a single `feat/memory-protocol-redesign` branch with commits
matching Parts 01–04.

Libraries used: `@forwardimpact/libcli` (createCli),
`@forwardimpact/libutil` (Finder), `@forwardimpact/libharness` (test
helpers). No new dependencies.

## Parts Index

| Part | Title | Depends on | Scope |
|---|---|---|---|
| [01](plan-a-01.md) | libwiki CLI primitives | — | Add `boot`, `log {decision\|note\|done}`, `claim`, `release`, `inbox {list\|ack\|promote\|drop}`, `rotate`, `audit`; modify `init`; extend `refresh`. Tests for each. |
| [02](plan-a-02.md) | Protocol rewrite and MEMORY.md schema | 01 (primitive names must exist) | Rewrite `memory-protocol.md` to specify CLI contracts; add `## Active Claims` and `## Cross-Cutting Priorities` symmetry to `wiki/MEMORY.md`; update `KATA.md`, `CONTRIBUTING.md`, and `coordination-protocol.md` cross-references; produce citation inventory. |
| [03](plan-a-03.md) | Agent profile + skill citation updates | 02 (protocol headings must be final) | Update Step 0 in 6 agent profiles to mandate `Read MEMORY.md` then `fit-wiki boot`; update 11 skills citing memory-protocol; update `fit-wiki` SKILL and `kata-wiki-curate` SKILL. |
| [04](plan-a-04.md) | CI wiring, Stop-hook install, verification | 01–03 (and re-invokes Part 01's `init`) | Wire `fit-wiki audit` into pre-merge CI; install Stop-hook via `init`; delete `scripts/wiki-audit.sh`; file follow-up issue for JTBD gap; collect 8-run trace sample for spec § Success Criteria row 4. **No pre-emptive rotation of pre-cutover weekly logs** — spec § Success Criteria row 5 exempts them. |

## Cross-Cutting Concerns

- **Stable digest contract.** Part 01 freezes the `boot` JSON schema; Parts
  02 and 03 rely on it. Schema changes after this redesign require a
  follow-up spec (design § Trade-offs).
- **Cutover date 2026-W23 (Mon 2026-06-01).** Pre-cutover weekly logs are
  exempt from the 500-line cap. The `audit` cap check skips files whose
  ISO week predates 2026-W23. Part 04 ships before the boundary so the
  rotation primitive is in place when the first post-cutover write fires.
- **First-run audit grace (design § CLI Surface).** `audit` reports
  existing violations on its first run but does not fail the gate; 7-day
  remediation window begins on PR merge. Part 04 wires this with an
  environment variable read at audit time so the grace window is
  observable in trace.
- **Append-only audit preserved.** Part 01's `log` and `rotate` only
  append or rename — no in-place edits. Tests in each subcommand assert
  no `writeFileSync` to existing file content other than appends or the
  rename-then-create rotation.
- **Run-from-anywhere via Finder.** Every new subcommand resolves
  `projectRoot` via `Finder.findProjectRoot(process.cwd())` before any
  filesystem access (design § Cross-cutting choices). Tests assert
  invocation from a subdirectory works.
- **No changes to `memo`, `push`, `pull`.** Design retains them
  unchanged. Tests for these commands stay untouched.

## Risks

- **Stop-hook entry installation touches `.claude/settings.json`.** A
  manual entry already exists for `just wiki-push`. `init` must merge,
  not overwrite. Part 01's `init` change uses a structured read-modify-
  write of the JSON; a hook with the same `command` string is treated as
  present and skipped. The settings file may also be absent on a fresh
  install — `init` creates a minimal `{ "hooks": { "Stop": [...] } }`
  shell in that case.
- **Per-run audit cost.** The Stop-hook installed by Part 01 runs
  `fit-wiki audit` on every agent run, materially adding to per-run
  cost. The audit is pure-JS (Part 01 Step 6) and reads <100 small
  files; benchmarked at <500ms locally. Surface this regression in the
  PR description so reviewers see it.
- **`boot` reading large `{self}.md`.** A summary at 106 lines (current
  `release-engineer.md`) sits well under the Read-cap, but the digest
  parser must tolerate files with non-standard H2 ordering (audit-grace
  cohort). Test the digest against a pre-redesign 106-line summary.
- **Active Claims write race.** Two `claim` calls within the same second
  can produce duplicate rows. Mitigation: `claim` reads, checks for an
  existing row with the same `(agent, target)`, and refuses with exit
  code 2 if one is present. `release` is idempotent — absence is
  success.
- **`refresh` against an unreachable `gh`.** Design § Trade-offs accepts
  empty marker blocks with stderr warning. Test the empty-`gh` path so
  XmR rendering stays intact when `gh issue list` fails.
- **`AUDIT_GRACE_UNTIL` propagation into CI.** Part 04 Step 1 sets the
  variable at workflow `env:` scope; if the workflow file has no
  pre-existing `env:` block, the step must add one. A missing var
  resolves to empty, silently disabling the grace — Part 04 includes a
  CI dry-run that asserts the var is present before merge.
- **Trace sample (success criterion row 4) is post-merge.** The 8-run
  trace sample is a verifier commitment, not a code artifact. Part 04
  defines the collection protocol; the implementation PR does not merge
  until the sample is posted. If the post-merge window fails to
  accumulate ≥3 React-mode runs in 48h, Part 04's Risks describe the
  manual-dispatch fallback.

## Execution Recommendation

Sequential on a single `feat/memory-protocol-redesign` branch, one
commit per Part, executed by `staff-engineer` via `kata-implement`.
Parallelism within Part 01 (independent subcommand files) is acceptable
inside one commit. Parts 02 and 03 are smaller and can compress into one
commit if Part 02's review surfaces no architectural rework. Part 04 is
the only part that interacts with CI and the wiki content — it ships
last and gates the PR's mergeability via the new audit gate it just
installed (first-run grace lets the PR pass).

The `technical-writer` agent is the natural reviewer for Part 02's
protocol rewrite via `kata-review`; engineering reviewers cover Parts
01, 03, and 04.

## References

- [Spec 1060](spec.md)
- [Design A](design-a.md)
- [Current memory-protocol.md](../../.claude/agents/references/memory-protocol.md)
- [libwiki](../../libraries/libwiki/)
- [scripts/wiki-audit.sh](../../scripts/wiki-audit.sh) — absorbed by Part 04

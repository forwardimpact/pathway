# Spec 770 — Terrain cache contract for uncacheable keys

## Problem

`bun run data:prose` (which invokes `bunx fit-terrain check`) exits non-zero on
every commit since `54e11c02 data(synthetic): regenerate prose cache against
current pipeline` on 2026-05-02. The signature is identical run after run:

```
Cache report
Keys  Hits  Misses  Rate
────────────────────────
283   235   48      83%
```

`fit-terrain check` exits 1 whenever `result.stats.prose.misses > 0` (see
[`libraries/libterrain/bin/fit-terrain.js:232`](../../libraries/libterrain/bin/fit-terrain.js)).
A single miss fails the gate.

The 48 misses persist after the persistence fix in PR #684 (`c9d101f9`,
`proseCacheSink.flush()` after enrichment/pathway) and the regeneration in PR
#685 (`54e11c02`, 421 entries committed). The regeneration commit message
acknowledged two `enrich_drug_*` keys "consistently return empty LLM responses
and remain uncached" — but `check` reports 48, not 2, leaving 46 unexplained.

The 46 unexplained misses surface a real architectural question on
`fit-terrain`'s cache contract: **how should `check` represent
intentionally-uncacheable keys** (keys whose generator returns empty / null /
falsy and therefore never get written to the cache)?

[`libraries/libsyntheticprose/src/engine/generator.js:62`](../../libraries/libsyntheticprose/src/engine/generator.js)
guards the cache write — `if (prose) this.cache.set(key, prose);` — so an empty
LLM response is never persisted. On the next `check` run the same key misses
again, and `check` cannot distinguish "cache wasn't generated" from "generator
intentionally returned empty for this key". Today the `check` gate conflates
both cases as failure.

The carve-out in
[`kata-release-merge` § Step 5](../../.claude/skills/kata-release-merge/SKILL.md)
is being narrowed by spec 750 to no longer mask the verb-mapping signature, but
spec 750 leaves the prose-red exception in place because the cache contract is
the property under question. While that exception stands, every PR's `Data`
status carries a known-red signal — the same erosion of the merge-gate signal
that led to spec 750 in the first place.

The 46 unexplained misses are also possibly DSL/seed drift: the regeneration
ran against a pipeline state that differs from what CI replays. Without
enumerated miss keys, this is indistinguishable from the empty-LLM-response
class above. The diagnostic instrumentation step is a precondition for the
contract decision.

## Goal

Make `bun run data:prose` exit zero on `main` HEAD with a written cache
contract — `fit-terrain check` distinguishes "key isn't cached" (real failure)
from "key is intentionally absent" (passes the gate). The
`kata-release-merge` prose-red exception that spec 750 left in place
disappears, restoring the `Data` workflow as a trusted merge-gate signal.

## Scope (in)

- **`fit-terrain check` diagnostic output.** When the gate fails (or surfaces
  miss keys), the CI log enumerates the miss keys (or a representative
  sample), not just the count. Without the key list, the contract decision is
  uninformed.
- **Cache contract for uncacheable keys.** A written rule for which keys are
  permitted to be absent from `data/synthetic/prose-cache.json` without
  failing `check`. The mechanism (allowlist file vs. negative-cache sentinel
  vs. other) is design's choice; the contract is the spec's deliverable.
- **`fit-terrain check` exit-code rule.** The condition that makes
  `check` exit non-zero is updated to honor the contract — keys covered by
  the contract count as "intentionally absent" and do not fail the gate;
  uncovered misses still fail.
- **`data/synthetic/prose-cache.json` regeneration discipline.** If the
  contract requires a reproducibility step (e.g., a one-shot regen against a
  pinned seed/DSL), the spec names the property the regen must satisfy. The
  exact command sequence is design's choice.
- **The `kata-release-merge` prose-red carve-out.** When this spec ships, the
  carve-out is removed; the `Data (prose)` job is a hard gate again.

## Scope (out)

- The cache file format itself (`_schema` versioning, JSON shape,
  `ProseCache.save()` behavior) — only the read/contract surface is in scope.
- `enriched` and `pathway` cache entries (content-hash-keyed via
  `generateStructured()`) — the misses in question are in the prose-key set
  (`stats.prose.{hits,misses}`), not the structured-response set.
- The `fit-terrain` verb surface (`check`, `validate`, `build`, `generate`,
  `inspect`) and the cache-lookup DAG — those are spec 750's premise and this
  spec's premise.
- Cross-product cache contracts (Map's seed cache, Pathway's job cache, etc.)
  — scope is the prose cache only.
- Logging / log-level policy — spec 750 removed `LOG_LEVEL=error` from the
  CI invocation; that change persists. This spec does not re-touch logging.
- The `e2e` job and the verb-mapping fix in spec 750 — orthogonal regression,
  already merged via PR #686.

## Success criteria

| #   | Claim                                                                                                                                              | Verification                                                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The `Data (prose)` job passes on `main` HEAD after the change merges.                                                                              | Most recent `Data` workflow run on `main` reports `prose` `success`.                                                                                                                                                                                                                                                                                        |
| 2   | When `fit-terrain check` reports any miss (covered or uncovered), the failing key set is enumerated in the CI log.                                 | Static inspection of the `check` output path: when `result.stats.prose.misses > 0`, the miss key set (or a documented representative sample) is written to stdout/stderr in addition to the count. The output is keyed and grep-able, not free-form prose.                                                                                                 |
| 3   | The cache contract for intentionally-absent keys is documented in the repository.                                                                  | A single artifact (file path is design's choice — e.g., `libraries/libterrain/README.md` or a dedicated contract doc) names the rule: which keys may be absent, where the registration lives, and how `check` resolves the absence to "pass".                                                                                                              |
| 4   | `fit-terrain check` exits zero on `main` HEAD when (and only when) every miss is covered by the contract.                                          | Static inspection of the exit-code rule in the `check` verb path: the `ok` condition no longer reduces to `misses === 0`; it reduces to "every miss key is covered by the contract". Plus: the workflow run on `main` HEAD reports `success` (verifies the contract genuinely covers today's 48 misses, not just that the rule was relaxed unconditionally). |
| 5   | The `kata-release-merge` prose-red carve-out is removed once `Data (prose)` is a trusted gate.                                                     | Static inspection of `kata-release-merge` § Step 5: the carve-out language permitting prose-red on trusted-author PRs is removed. The `Data` workflow's `prose` job is treated as a hard required check.                                                                                                                                                    |
| 6   | If the contract is "allowlist-shaped" (keys named explicitly), an attempt to add a new prose key without registering it fails locally and in CI.   | Static inspection of the failure path: a contributor who introduces a new prose key whose generator returns empty cannot land it without an explicit contract entry; the failure surfaces with the same enumerated-key diagnostic as criterion 2. (If design picks a non-allowlist mechanism — e.g., negative-cache sentinel — this criterion is restated by the design author against the chosen mechanism's failure mode.) |

## Notes

### Closure path for spec 750 success criterion #2

Spec 750 success criterion #2 (`Data (prose)` passes on main HEAD) was unmet at
PR #686's merge and was tracked here for closure. When this spec's criterion 1
is verified on `main` HEAD, spec 750 criterion #2 closes in the same act.
PR #686's merge note flagged this dependency.

### Architectural question stated for the design phase

The contract has a tension the design author needs to resolve, not the spec:

- **Allowlist** (named keys may be absent) keeps the gate sharp — adding a new
  uncacheable key is an explicit registration step. Cost: a failure mode where
  forgetting to register an empty-response key is a contributor footgun.
- **Sentinel / negative-cache** (cache stores an explicit "this key returns
  empty" marker) keeps the gate semantic — the cache is the source of truth
  for "what was tried, what came back". Cost: cache file grows; regen
  discipline must include sentinel-write on empty responses.
- **Class-of-key rule** (e.g., all `enrich_drug_*` keys are exempt because the
  drug enrichment prompt is intentionally permissive of empty output)
  trades coarseness for ergonomics.

The spec is intentionally agnostic — pick one in design-a.md with the
trade-offs documented.

### Relationship to existing keys producing empty responses

Commit `54e11c02` named two `enrich_drug_*` keys that consistently return
empty. Criterion 2's enumerated output will reveal whether the remaining 46
fall into the same class (suggesting the `enrich_drug_*` prompt or a sibling
prompt is structurally permissive of empty output) or split across classes
(suggesting DSL/seed drift). The design author uses that enumeration to size
the contract surface — a single class is allowlist-friendly; a wide drift is
sentinel-friendly.

### Why criterion 4 has two verification clauses

A naive implementation could pass criterion 4's first clause by relaxing the
exit-code rule to "always pass" — the second clause (workflow run on `main`
HEAD reports success with the contract genuinely covering today's misses)
prevents that. Both clauses must hold.

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

`fit-terrain check` exits 1 whenever `result.stats.prose.misses > 0`
(`libraries/libterrain/bin/fit-terrain.js` lines ~232/338). A single miss fails
the gate.

The 48 misses persist after the persistence fix in PR #684 (`c9d101f9`,
`proseCacheSink.flush()` after enrichment/pathway) and the regeneration in PR
#685 (`54e11c02`, 421 entries committed). The regeneration commit message
acknowledged two `enrich_drug_*` keys "consistently return empty LLM responses
and remain uncached" — but `check` reports 48, not 2, leaving 46 unexplained.

The 46 unexplained misses surface a real architectural question on
`fit-terrain`'s cache contract: **how should `check` represent
intentionally-uncacheable keys** (keys whose generator returns empty / null /
falsy and therefore never get written to the cache)? `ProseGenerator.generate`
guards the cache write so empty LLM responses are never persisted, which means
on the next `check` run the same key misses again, and `check` cannot
distinguish "cache wasn't generated" from "generator intentionally returned
empty for this key". Today the gate conflates both cases as failure.

The 46 unexplained misses may also reflect DSL/seed drift between the
regeneration run and CI's replay (different pipeline state produces a different
key set). Without enumerated miss keys, this is indistinguishable from the
empty-LLM-response class above. **Diagnostic instrumentation is a precondition
for the contract decision** — without the key list, the contract author is
guessing about what the contract must cover.

The wider consequence: spec 750 (PR #686, S4) removed the
`kata-release-merge` "missing `data/pathway/`" carve-out outright, so
`Data (prose)` is a hard required gate again. Until `prose` exits zero on
`main` HEAD, every PR rebased onto `main` inherits that redness and is blocked
by the gate. PR #686 itself was merged via an out-of-band orthogonality
judgement on the basis that its branch did not touch `libraries/libterrain/`.
That escape hatch is not codified, is not durable, and is exactly the kind of
informal exception that `kata-release-merge` exists to remove.

## Goal

Make `bun run data:prose` exit zero on `main` HEAD with a written cache
contract — `fit-terrain check` distinguishes "key isn't cached" (real failure)
from "key is intentionally absent" (passes the gate). Once `Data (prose)` is
green, the hard gate restored by spec 750 actually gates, and the orthogonality
judgement that PR #686 relied on is no longer needed for subsequent PRs.

## Scope (in)

- **`fit-terrain check` diagnostic output.** When the gate fails (or surfaces
  miss keys), the CI log enumerates the miss keys, not just the count. Without
  the key list, the contract decision is uninformed.
- **Cache contract for uncacheable keys.** A written rule for which keys are
  permitted to be absent from `data/synthetic/prose-cache.json` without
  failing `check`. The mechanism (allowlist file vs. negative-cache sentinel
  vs. other) is design's choice; the contract is the spec's deliverable.
- **`fit-terrain check` exit-code rule.** The condition that makes
  `check` exit non-zero is updated to honor the contract — keys covered by
  the contract count as "intentionally absent" and do not fail the gate;
  uncovered misses still fail.
- **Prevent reintroduction of the prose-red carve-out.** The spec ships
  without re-adding any `kata-release-merge` exception for `Data (prose)`
  redness; whatever made `prose` green stays in the cache contract, not in
  the gate.

## Scope (out)

- **The cache file format itself** (`_schema` versioning, JSON shape,
  `ProseCache.save()` behavior) — only the read/contract surface is in scope.
- **`enriched` and `pathway` cache entries** (content-hash-keyed via
  `generateStructured()`) — the misses in question are in the prose-key set
  (`stats.prose.{hits,misses}`), not the structured-response set.
- **The `fit-terrain` verb surface** (`check`, `validate`, `build`, `generate`,
  `inspect`) and the cache-lookup DAG — those are spec 750's premise and this
  spec's premise.
- **Cross-product cache contracts** (Map's seed cache, Pathway's job cache,
  etc.) — scope is the prose cache only.
- **Logging / log-level policy** — spec 750 removed `LOG_LEVEL=error` from
  the CI invocation; that change persists. This spec does not re-touch
  logging.
- **The `e2e` job and the verb-mapping fix in spec 750** — orthogonal
  regression, already merged via PR #686.
- **Prose-cache regeneration discipline** — re-anchoring the regen procedure
  against a pinned seed/DSL is plausible follow-up but not in this spec; the
  contract decision plus the diagnostic enumeration is the unit of work here.

## Success criteria

| #   | Claim | Verification |
| --- | ----- | ------------ |
| 1   | The `Data (prose)` job passes on `main` HEAD after the change merges. | Most recent `Data` workflow run on `main` reports `prose` `success`. |
| 2   | When `fit-terrain check` reports any miss (covered or uncovered), every miss key is enumerated in the CI log. | Static inspection of the `check` output path: when `result.stats.prose.misses > 0`, every miss key (no truncation, no sampling) is written to stdout/stderr in addition to the count. The output is one key per line and grep-able, not free-form prose. |
| 3   | The cache contract for intentionally-absent keys is documented in the repository. | A single artifact (file path is design's choice — e.g., `libraries/libterrain/README.md` or a dedicated contract doc) names the rule: which keys may be absent, where the registration lives, and how `check` resolves the absence to "pass". |
| 4   | `fit-terrain check` exits zero on `main` HEAD when (and only when) every miss is covered by the contract. | (a) Static inspection of the exit-code rule in the `check` verb path: the `ok` condition no longer reduces to `misses === 0`; it reduces to "every miss key is covered by the contract". (b) The workflow run on `main` HEAD reports `success` (verifies the contract genuinely covers today's 48 misses, not just that the rule was relaxed unconditionally). Both clauses must hold. |
| 5   | No `kata-release-merge` exception for `Data (prose)` redness is reintroduced as part of this work. | Static inspection of `.claude/skills/kata-release-merge/SKILL.md` after the spec's implementation PR merges: no carve-out / exception language for `Data (prose)`, `prose-red`, `prose-cache`, or "missing `data/pathway/`" is present in §§ 4–6 of the SKILL. |
| 6   | A new prose key whose generator returns empty cannot land on `main` without the contract recognizing it. | Static inspection of the failure path: introducing a new prose key with no contract entry and no cache entry causes `fit-terrain check` to exit non-zero locally and in CI, with that key listed in the criterion-2 diagnostic. The verification is mechanism-agnostic — whether the contract is allowlist-shaped, sentinel-shaped, or class-of-key-shaped, the failure mode is the same. |

## Notes

### Closure path for spec 750 success criterion #2

Spec 750 success criterion #2 (`Data (prose)` passes on main HEAD) was unmet
at PR #686's merge and was tracked here as one possible closure path. When this
spec's criterion 1 is verified on `main` HEAD, spec 750 criterion #2 closes in
the same act. Other paths (e.g., a one-shot regen against a pinned seed that
happens to produce zero misses) could in principle also close it, but the
contract this spec defines is the durable closure — without it, the underlying
empty-LLM-response problem recurs the next time a generator returns falsy.

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
  drug enrichment prompt is intentionally permissive of empty output) trades
  coarseness for ergonomics.

The spec is intentionally agnostic — pick one in design-a.md with the
trade-offs documented. Criterion 6's verification is identical across the
three: an unrecognized empty-response key fails locally and in CI.

### Relationship to existing keys producing empty responses

Commit `54e11c02` named two `enrich_drug_*` keys that consistently return
empty. Criterion 2's enumerated output will reveal whether the remaining 46
fall into the same class (suggesting the `enrich_drug_*` prompt or a sibling
prompt is structurally permissive of empty output) or split across classes
(suggesting DSL/seed drift). The design author uses that enumeration to size
the contract surface — a single class is allowlist-friendly; a wide drift is
sentinel-friendly.

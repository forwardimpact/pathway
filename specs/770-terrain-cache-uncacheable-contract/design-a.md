# Design 770a — Terrain cache contract for uncacheable keys

Spec: [`spec.md`](spec.md). Closes spec 750 success criterion #2 once criterion
1 holds on `main` HEAD.

## Architectural input

Spec criterion 2 names the enumerated-miss diagnostic as the input that tells
design whether today's misses cluster into one class or split. Manual
enumeration on `main` HEAD (`f1576f2d`) — set-difference of `collectProseKeys`
against the keys present in `data/synthetic/prose-cache.json`, the same
comparison the to-be-built diagnostic will perform — gives:

| Class                 | Misses | Class size today | Cached entries |
| --------------------- | -----: | ---------------: | -------------: |
| `snapshot_comment_*`  |     48 |              147 |             99 |
| every other prose key |      0 |              136 |            136 |

All 48 misses are in one class. The cached `snapshot_comment_*` values are
non-empty and substantive — these are not empty-LLM-response keys. The cause is
**seed/shuffle drift**: `generateCommentKeys` shuffles candidates with
`rng.shuffle`, so a regen run produces a partly different key set than today's.
The `enrich_drug_*` keys named in commit `54e11c02` are `generateStructured()`
content-hash entries, not prose keys, and are out of this spec's scope.

Drift, not empty generators, eliminates two of the spec's three options:
allowlist-by-name fails because names rotate; negative-cache sentinel fails
because no LLM call was attempted, so there is nothing to mark empty.
Class-of-key is the only mechanism that fits.

This empirical premise is a design precondition: if the to-be-built diagnostic
later produces a materially different distribution (e.g., misses split across
multiple classes, or non-`snapshot_comment_*` misses appear), the class-of-key
choice must be re-evaluated against the spec's three options.

## Components

| #   | Component                             | Role                                                                                                                                                                                                |
| --- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Cache contract registry (data file)   | Single source of truth for which key classes may be absent and a per-class miss-budget upper bound; doubles as the criterion-3 single artifact via embedded `_doc` and per-class `rationale` fields |
| 2   | Contract loader (`libsyntheticprose`) | Parses the registry and exposes `coverMisses(missKeys) → { covered, uncovered, classCounts }`                                                                                                       |
| 3   | Diagnostic enumeration (`libterrain`) | Emits every miss key (no truncation, no sampling) whenever `result.stats.prose.misses > 0`                                                                                                          |
| 4   | `check` exit-code rule (`libterrain`) | Returns `ok = (every miss key is covered)`, where "covered" carries the K2 definition; no second gate                                                                                               |

The `kata-release-merge` §§ 4–6 invariant for criterion 5 is a cross-skill
constraint verified by static inspection of the SKILL (per the spec), not a
component this design builds — see
[Cross-skill coordination](#cross-skill-coordination).

## Data flow

```mermaid
flowchart LR
  A[story.dsl + entities] --> B[collectProseKeys → 283 keys]
  B --> C[ProseCache.has?]
  C -- hit --> D[hits++]
  C -- miss --> E[record miss key]
  E --> F[Contract.coverMisses]
  F --> G{"uncovered = 0?<br/>(K2: cap blow → uncovered)"}
  G -- yes --> H[exit 0 + report covered misses]
  G -- no --> I[exit 1 + enumerate every miss key]
  H --> J[Cache report]
  I --> J
```

## Contract data structure

A contract entry is `{ classPattern, maxMisses, rationale }`. `classPattern` is
a glob anchored at the start of a key. `maxMisses` is an integer cap; misses
beyond it fail the gate even if the prefix matches. `rationale` is human prose
explaining why the class drifts and what to do if the cap is hit.

The registry lives at `data/synthetic/prose-cache-contract.json`, a sibling of
`prose-cache.json`. Top-level `_doc` describes the registration procedure and
the resolution rule (criterion 3's single-artifact requirement). Shape:

```json
{
  "_schema": 1,
  "_doc": "Lists prose-key classes whose absence from prose-cache.json is permitted up to maxMisses. fit-terrain check covers a miss when its key matches a classPattern and the class's miss count is within cap. Register a class by appending to classes[] with a rationale; raising maxMisses is a registry edit reviewed by humans, not a CI fix.",
  "classes": [
    {
      "classPattern": "snapshot_comment_*",
      "maxMisses": "<plan-set integer; see K3 formula>",
      "rationale": "RNG shuffle in generateCommentKeys can elect a different actor set per run; misses above this cap signal that regen drifted faster than the cache covers and a fresh `fit-terrain generate` is needed."
    }
  ]
}
```

## Interfaces

`CacheContract` (new class in `libsyntheticprose`) — the surface the verb sees:

- `load(contractPath, logger) → CacheContract` — parse and `_schema`-validate
  the registry.
- `coverMisses(missKeys) → { covered: string[], uncovered: string[], classCounts: Map<string, { matched, cap, ok }> }`
  — `string` keys in `classCounts` are `classPattern` values.

The miss-key list flows from cache to verb to report: `ProseCache.stats` carries
`missKeys: string[]` alongside `hits` / `misses`, threaded through
`cache-lookup` so the verb receives ordered keys (not just a count). The
cache-report stage receives both `stats` and `contractCoverage` and emits every
miss key with its coverage state in a grep-able form whenever
`stats.prose.misses > 0`. Exact argument signatures, output strings, and
ordering are plan-level.

## Key Decisions

| Key | Decision                                                                                                                                                                                                                  | Trade-off vs. rejected                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| K1  | Class-of-key registry, with **glob anchored at key start** as the pattern grammar — not allowlist, not sentinel, not regex, not exact-prefix-only                                                                         | Allowlist-by-name fails against drift (names rotate). Sentinel fails against drift (no LLM call attempted, nothing to mark empty). Among class-of-key grammars: regex is over-expressive for class membership and invites misuse (back-references, lookarounds) that hide intent; exact-prefix-only forecloses multi-segment patterns the keyspace may need (e.g., `snapshot_*_comment`). Anchored glob is the minimal sufficient grammar. |
| K2  | Per-class `maxMisses` cap, not unbounded class exemption; the cap is part of "covered" — a key is covered iff `classPattern` matches AND class miss count ≤ cap. **This is the single home of the "covered" definition.** | Unbounded exemption hides structural change in the keyspace. Folding the cap into "covered" keeps spec criterion 4's "every miss covered by the contract" semantically coherent with the cap mechanism (one definition, one home — Components row 4 and the data-flow diagram both reference K2 rather than restating the rule).                                                                                                           |
| K3  | Static cap formula — `maxMisses ≥ today's measured class miss count + headroom for one rotation cycle`; never auto-ratcheted by CI                                                                                        | "Rotation cycle" = one fresh `generateCommentKeys` run with a different RNG state, which can swap any subset of the candidate-list permutation. The integer instantiation is plan-set against the diagnostic's actual numbers. Auto-tightening adds mechanism for no clear gain — the cap is a structural-change tripwire, not a miss-count optimizer. Cap moves are registry edits reviewed by humans.                                    |
| K4  | Registry file is JSON beside `prose-cache.json`, not in code                                                                                                                                                              | A code-resident allowlist is invisible to non-JS reviewers. JSON next to the cache makes the contract diff-readable, makes `_schema` versioning consistent with the cache itself, and centralizes "what may be absent."                                                                                                                                                                                                                    |
| K5  | Diagnostic enumeration always fires when `misses > 0`                                                                                                                                                                     | Spec criterion 2 wording is unconditional. Enumerating only on uncovered miss would hide drift growth approaching the cap; emitting on every miss-bearing run keeps the data point visible in CI without requiring a failure.                                                                                                                                                                                                              |
| K6  | The registry JSON itself is the single criterion-3 artifact (`_doc` + per-class `rationale`); no separate README                                                                                                          | Spec criterion 3 says "single artifact". Registry + README is two sources readers reconcile. Registry-with-embedded-doc keeps data and explanation in lockstep — registering a class without its rationale becomes structurally impossible because the schema requires the field.                                                                                                                                                          |

## Cross-skill coordination

Criterion 5 is verified by static inspection of `kata-release-merge` SKILL.md
after the implementation PR merges (per the spec) — there is no runtime guard
component in this design. The plan chooses how to operationalize the static
inspection (literal-string match for the four spec-named exception strings,
structural-qualifier check, or both); release-engineer's pre-design confirmation
that §§ 4–6 are clean today is a plan input, not an architectural commitment.

## Risks (architecture-level)

| #   | Risk                                                                                                     | Why visible only at design                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Cap drift over time as scenarios add quarters → silent cap raises                                        | Cap is a static registry value, never auto-tightened or auto-raised by CI. Raising it is a contributor PR edit reviewed by humans; the registry `_doc` must repeat this rule, and the plan must call it out explicitly. |
| R2  | A new prose-key generator returning empty would not match an existing class — falls through as uncovered | Criterion 6 verifiable: such a key fails locally and in CI with that key listed in the diagnostic.                                                                                                                      |

## Out of scope

- Making `generateCommentKeys` cache-aware (true determinism fix) — follow-up
  spec. The right long-term fix is to re-elect cached actors first; that is a
  behavioural change to `libsyntheticgen`.
- The cache file format / `_schema` versioning of `prose-cache.json` — per spec
  scope (out).
- `enriched` / `pathway` content-hash cache entries — per spec scope (out).

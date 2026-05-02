# Plan — Spec 770 (terrain cache contract for uncacheable keys)

Spec: [`spec.md`](spec.md). Design: [`design-a.md`](design-a.md).

## Approach

Thread an ordered `missKeys: string[]` through `ProseCache.stats`, ship a JSON
registry at `data/synthetic/prose-cache-contract.json` plus a `CacheContract`
class in `libsyntheticprose`, change `fit-terrain check`'s `ok` rule to
`coverMisses(missKeys).uncovered.length === 0`, and emit every miss key with its
coverage state to stdout whenever `stats.prose.misses > 0` (K5). Criterion 5 is
verified by static inspection of `kata-release-merge` SKILL.md §§ 4–6 — no
source change to that SKILL.md is in the implementation diff. The plan adds one
machine-checkable guard for the residual concern release-engineer flagged: a
`kata-review` rubric entry that fails the SKILL.md grading on any `data/`-shaped
or `prose`-shaped string in §§ 4–6.

Libraries used: `@forwardimpact/libsyntheticprose` (new `CacheContract` export),
`@forwardimpact/libterrain` (consumer). No new dependencies.

## Steps

### S1 — Thread `missKeys` through `ProseCache`

- **Modified:** `libraries/libsyntheticprose/src/engine/cache.js`.
- **Change:** add `missKeys: string[]` to `this.stats`; on miss (`get(key)`
  else-branch and `has(key) === false` paths the cache-lookup node walks), push
  the key in iteration order. `hits`/`misses` integer counters keep their
  existing increments.
  ```diff
  -    this.stats = { hits: 0, misses: 0 };
  +    this.stats = { hits: 0, misses: 0, missKeys: [] };
  ```
  `get(key)` else-branch:
  ```diff
       this.stats.misses++;
  +    this.stats.missKeys.push(key);
       return undefined;
  ```
- **Verify:** `bun test libraries/libsyntheticprose/test/prose-cache.test.js`
  passes including a new case asserting `stats.missKeys` ordering matches the
  order of `get` calls that miss.

### S2 — Add `CacheContract` to `libsyntheticprose`

- **Created:** `libraries/libsyntheticprose/src/engine/contract.js`.
- **Modified:** `libraries/libsyntheticprose/src/index.js`
  (`export { CacheContract } from "./engine/contract.js";`).
- **Created test:** `libraries/libsyntheticprose/test/cache-contract.test.js`.
- **Surface (the design's interface, made concrete):**
  ```js
  export class CacheContract {
    static load(contractPath, logger) { /* sync read, _schema=1 validate */ }
    constructor({ classes, doc, logger }) { /* freeze */ }
    coverMisses(missKeys) {
      // returns { covered: string[], uncovered: string[],
      //          classCounts: Map<string, { matched, cap, ok }> }
    }
  }
  ```
  `classPattern` grammar (K1): glob anchored at key start; `*` matches `[^/]*`;
  no other metacharacters (escape with `\\`). Compile to a `RegExp` once at
  construction. Apply patterns in registry order — first match wins so
  `classCounts` keying stays unambiguous. A miss with no matching pattern goes
  to `uncovered`. After matching, the per-class cap (K2) is checked: if
  `matched > cap`, every miss in that class above the cap goes to `uncovered`;
  the first `cap` misses (in iteration order) go to `covered`. `_schema !== 1`
  throws.
- **Verify:** new test covers six cases — pattern miss, single pattern hit,
  multi-class split, cap-blow overflow into `uncovered`, `_schema` mismatch
  throw, missing-file throw.

### S3 — Ship the contract registry file

- **Created:** `data/synthetic/prose-cache-contract.json`.
- **Content (K3 picks `maxMisses = 72`: `ceil(48 × 1.5)`, well below the current
  class size of 147):**
  ```json
  {
    "_schema": 1,
    "_doc": "Lists prose-key classes whose absence from prose-cache.json is permitted up to maxMisses. fit-terrain check covers a miss when its key matches a classPattern and the class's miss count is within cap. Register a class by appending to classes[] with a rationale; raising maxMisses is a registry edit reviewed by humans, not a CI fix. CI must never auto-tighten or auto-raise this cap.",
    "classes": [
      {
        "classPattern": "snapshot_comment_*",
        "maxMisses": 72,
        "rationale": "RNG shuffle in generateCommentKeys can elect a different actor set per run; misses above this cap signal that regen drifted faster than the cache covers and a fresh `fit-terrain generate` is needed."
      }
    ]
  }
  ```
- **Verify:** `bunx fit-terrain check` exits 0 against the committed
  `prose-cache.json` (after S4);
  `jq '._schema' data/synthetic/prose-cache-contract.json` prints `1`.

### S4 — Wire the contract into `fit-terrain check`

- **Modified:** `libraries/libterrain/bin/fit-terrain.js`,
  `libraries/libterrain/src/cli-helpers.js`,
  `libraries/libterrain/src/pipeline.js`.
- **Pipeline:** in `Pipeline.run`, after the existing `proseCacheSink.flush()`,
  thread `missKeys` from `proseCache.stats` into the result so it sits at
  `result.stats.prose.missKeys`:
  ```diff
       stats: {
         prose: {
  -        ...this.proseCache.stats,
  +        ...this.proseCache.stats,
  +        missKeys: [...this.proseCache.stats.missKeys],
           generated: this.proseGenerator.stats.generated,
         },
  ```
- **CLI helpers:** `createPipeline` accepts a `contractPath` option. The caller
  (`fit-terrain.js`) resolves it to
  `<monorepoRoot>/data/synthetic/prose-cache-contract.json` and passes it
  through. `printCacheReport` accepts a `coverage` argument
  (`{ covered, uncovered, classCounts }`); when `result.stats.prose.misses > 0`,
  it emits the existing table plus a section listing every miss key, one per
  line, prefixed `[covered] ` or `[uncovered] ` and grouped by class. No
  truncation, no sampling. The output is grep-able (criterion 2).
- **Verb:** `runVerb` for `verb === "check"` loads the contract once via
  `CacheContract.load(contractPath, logger)`, calls
  `contract.coverMisses(result.stats.prose.missKeys)`, sets
  `ok = coverage.uncovered.length === 0` (criterion 4a), and passes both
  `result` and `coverage` to `printCacheReport`. The previous
  `ok = result.stats.prose.misses === 0` line is removed.
- **`generate` and `build`:** unchanged — they ignore the contract; the warning
  banner still fires on any miss because the contract is a `check`-verb concept,
  not a regen concept.
- **Verify:** `bunx fit-terrain check` against today's `prose-cache.json` prints
  `Cache report` then a `Misses` block enumerating 48 keys all marked
  `[covered] snapshot_comment_*` and exits 0; introducing a new prose key with
  no cache entry and no contract match (e.g. `snapshot_comment_*` cap exceeded,
  or a fabricated `unrecognized_*` key) makes `check` exit 1 with that key on a
  `[uncovered]` line (criterion 6).

### S5 — `fit-terrain check` snapshot test

- **Modified:** `libraries/libterrain/test/pipeline.test.js` (or new
  `check-contract.test.js` sibling — implementer's choice).
- **Change:** add a Pipeline-level test that builds a `ProseCache` with a
  pre-populated `stats.missKeys` list, a stub `CacheContract` matching one
  pattern, and asserts the resulting `ok` reduces to
  `coverage.uncovered.length === 0`. A second case asserts cap-blow produces a
  non-empty `uncovered` even when every key matches a pattern.
- **Verify:** `bun test libraries/libterrain/test/` passes.

### S6 — `kata-review` rubric entry against future `data/`-shaped carve-outs

- **Modified:** `.claude/skills/kata-review/SKILL.md` (Implementation diff
  criteria section).
- **Change:** add one bullet under `### Implementation diff`:
  > - `kata-release-merge` SKILL.md §§ 4–6 contain no `data/`-shaped or
  >   `prose`-shaped exception language. Treat any introduction of
  >   `data/pathway/`, `data/synthetic/`, `prose-cache`, `Data (prose)`,
  >   `prose-red`, or `prose:` carve-out wording in §§ 4–6 of
  >   `.claude/skills/kata-release-merge/SKILL.md` as at minimum a **High**
  >   finding.
- **Out of scope:** `.claude/skills/kata-release-merge/SKILL.md` itself — the
  source must remain unchanged (criterion 5). This step writes guidance for the
  reviewer skill so a future PR re-introducing the carve-out is caught at review
  time.
- **Verify:**
  `git diff origin/main -- .claude/skills/kata-release-merge/SKILL.md` is empty
  after the implementation branch is built;
  `git diff origin/main -- .claude/skills/kata-review/SKILL.md` shows exactly
  the new bullet under `### Implementation diff`.

### S7 — Update `libraries/libsyntheticprose/README.md` and `libterrain/README.md` exports list

- **Modified:** `libraries/libsyntheticprose/README.md`,
  `libraries/libterrain/README.md` (only if either currently enumerates exports
  — verify before editing; if the file is a stub, this step is a no-op for that
  file). Add a one-line mention of `CacheContract` and the registry path.
- **Verify:** `bun run lib:fix` regenerates the catalog cleanly; `bun run check`
  passes.

### S8 — Run the prose gate end-to-end

- **Verify (no source changes):**

  ```sh
  bun run check
  bun run test
  bun run data:prose            # exits 0; report shows 48 covered misses
  bunx fit-terrain check        # same; both criterion 1 and 4 satisfied
  ```

  Then build the cross-skill verification matrix the reviewer will check at
  implementation review:

  | Criterion | Verification                                                                                                             |
  | --------- | ------------------------------------------------------------------------------------------------------------------------ |
  | 1         | `bun run data:prose` exits 0 on the implementation branch                                                                |
  | 2         | Output of `bunx fit-terrain check` lists 48 miss keys, one per line, grep-able                                           |
  | 3         | `data/synthetic/prose-cache-contract.json` carries `_doc` and per-class `rationale`                                      |
  | 4         | `ok` rule is `coverage.uncovered.length === 0` (S4); workflow run on branch is green                                     |
  | 5         | `git diff origin/main -- .claude/skills/kata-release-merge/SKILL.md` is empty                                            |
  | 6         | Local repro: append `snapshot_comment_unrecognized` to `prose-keys.js` test fixture, observe `[uncovered]` line + exit 1 |

## Ordering and dependencies

S1 → S2 → S3 → S4 → S5 → S6 → S7 → S8.

- S1 introduces the `missKeys` field S2's tests rely on.
- S2 adds the `CacheContract` S4 imports.
- S3 must land before S4 because S4's `runVerb` reads the registry path.
- S4 must land before S5 because S5 asserts the new `ok` rule.
- S6 and S7 are independent of S1–S5 but route through the same implementation
  branch; sequence them last so the diff for the reviewer reads code → docs →
  rubric.
- S8 runs after every other step lands.

## Risks

| #   | Risk                                                                                                       | Mitigation                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `missKeys` array grows unbounded for huge keyspaces, increasing memory at runtime                          | The keyspace is bounded by `collectProseKeys` output (low hundreds). No mitigation needed today; revisit if a future spec inflates the keyspace by 100×              |
| R2  | Glob pattern grammar (S2) accidentally permits `*` to span `_` and over-match adjacent classes             | Compile patterns to anchored RegExp (`^...$`) at construction; pattern test asserts `snapshot_comment_*` does not match `note_alice_0`                               |
| R3  | S6's rubric entry depends on a reviewer reading SKILL.md — same surface as criterion 5's static inspection | This is the residual gap release-engineer flagged. The rubric entry is best-effort; the durable fix is criterion 5's static inspection at implementation-review time |

## Execution recommendation

Single `staff-engineer` agent, sequential. The plan is small (<300 LoC diff) and
the steps share enough state that parallelization buys nothing. Implementation
review is `release-engineer` — they re-verify criterion 5 (`kata-release-merge`
SKILL.md §§ 4–6 unchanged) and criterion 1 (`bun run data:prose` exits 0 on the
branch).

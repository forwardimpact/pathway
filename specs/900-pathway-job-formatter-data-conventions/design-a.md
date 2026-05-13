# Design 900 — Pathway Job Formatter Data Conventions

## Restate the problem

Two of #874's rendering bugs are symptoms of a contract the pathway job
formatter relies on but never writes down. `generateJobTitle`
(`libraries/libskill/src/derivation.js:264`) silently assumes
`professionalTitle` is a rank prefix; `buildAutonomySentence`
(`products/pathway/src/formatters/job/description.js:32`) silently assumes
`autonomyExpectation` opens with a base-form verb. The starter happens to
satisfy both; BioNova does not. v1 must (a) name the contract for these two
fields in one canonical location, (b) bring every emitter into alignment,
(c) catch violations before render — at the render path itself, not only at
opt-in `fit-map validate`.

## Components

```mermaid
flowchart LR
  Author[Standard author] -->|writes YAML| Levels[levels.yaml]
  Prose[libsyntheticprose<br/>level prompt] -->|emits| Levels
  DSL[story.dsl<br/>parser-standard] -->|seeds prose| Prose
  Levels --> Validator[validation/level.js<br/>rule predicates]
  Validator -. exports .-> Loader[map/loader.js<br/>loadStandardConfig]
  Validator -->|errors| Author
  Levels --> Loader
  Loader --> Formatter[generateJobTitle<br/>buildAutonomySentence<br/>--list, progress, interview]
  Formatter --> Render[rendered job markdown]
  Guide[authoring-standards/index.md<br/>canonical contract] -. read by .-> Author
  Guide -. read by .-> Prose
  Schema[levels.schema.json<br/>description points to Guide] -. read by .-> Author
```

One canonical contract document is read by authors and the prose prompt and
pointed at by the schema. One module owns the rule predicates
(`validation/level.js`). Two call sites invoke them: `validateLevels` for
`fit-map validate`, and `createDataLoader().loadStandardConfig`
(`products/map/src/loader.js`, the single function every render command —
`fit-pathway dev`/`build`/`update`/`job` — funnels through) for the render
path. Failing the contract at load time prevents non-compliant data from ever
reaching any `generateJobTitle` or `buildAutonomySentence` call site,
including `--list` and the progress/interview formatters that bypass
`deriveJob`.

## Key Decisions

| Decision                                  | Chosen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Rejected                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **K1. Canonical home**                    | `websites/fit/docs/products/authoring-standards/index.md` — a new `## Level field conventions` subsection after Step 1, with one compliant + one non-compliant example for each field and a stable anchor `#level-field-conventions` the schema and validator point at.                                                                                                                                                                                                                                                                                                                                                                              | Schema `description` strings — too cramped for compliant/non-compliant pairs and rationale. Starter YAML inline comments — can't carry a non-compliant example without confusing the example.                                                                                                                                                                                                                          |
| **K2. `professionalTitle` shape**         | **Rank token** — a single capitalised seniority word (`Associate`, `Senior`, `Staff`) or the form `Level <numeral>`. The formatter composes it with the discipline's `roleTitle`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | **Role-complete** (`Senior Engineer`) — drops the `{roleTitle}` join; obsoletes the starter shape and the existing else-branch in `generateJobTitle`. **Marker-distinguished** — adds a per-level flag for an inconsistency we are removing.                                                                                                                                                                            |
| **K3. `professionalTitle` rule**          | Two predicate checks, both required. **(a) Shape:** `^(?:Level [IVX]+\|Level \d+\|[A-Z][a-z]+)$` — `Level <roman>`, `Level <digit>`, or one capitalised word (no spaces). Rejects `"Senior Engineer"` (two words) and `"engineer"` (lower-case). **(b) Disjointness:** the case-folded, whitespace-split token set of `professionalTitle` (excluding the literal `Level`) must be disjoint from the token set of **every** discipline's `roleTitle` in the same standard, where tokenisation splits on `\s+` after stripping `[^A-Za-z0-9]+`. Rejects `"Engineer"` when any discipline carries `roleTitle: "Software Engineer"` — `{engineer}` ∩ `{software, engineer}` ≠ ∅. The cross-check needs all disciplines; (a) and (b) live as two separate exports, and the validator surfaces them through orchestration (see Interfaces).                                                                                                            | Shape-only — a single word like `"Engineer"` passes a shape regex but still ships the bug. Allow-list of exact rank words — couples the rule to a closed vocabulary the author cannot extend. Cross-check skipping `Level` literal — `Level I` versus discipline `roleTitle: "Software Engineer Level"` is contrived; excluding `Level` keeps the rule's surface small.                                                  |
| **K4. `autonomyExpectation` shape**       | **Base/imperative verb** — opens with an infinitive (`Work…`, `Lead…`, `Define…`). Composes into `"You will " + lowercase(value)` without normalisation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | **Third-person** (`Works…`) — requires verb-form normalisation in the formatter, hiding the bug. **Either, formatter normalises** — normalisation across irregulars and elided subjects is brittle; the contract is cheaper.                                                                                                                                                                                            |
| **K5. `autonomyExpectation` rule**        | One regex check on the first whitespace-delimited token. Reject when the token matches `^[A-Z][a-z]*[^s]s$` — a capitalised word ending in lowercase `s` preceded by a non-`s` letter (catches `Works`, `Owns`, `Drives`, `Leads`, `Defines`, `Manages`, `Coordinates`, `Builds`, `Develops`, `Implements`, `Architects`, `Reviews`, `Runs`, `Tests`, `Steers`, `Directs`, …; also catches `Has`). Also reject the exact two-character token `Is` (copular subject-omission too short for the regex). Subject-led sentences (`The team…`, `You…`) pass the first-token check; spec scope does not include subject detection. | Closed verb stop-list — incomplete by construction; reviewers had to grow it ad-hoc. JSON-schema `pattern` — cannot express "not -s after non-s" cleanly across all third-person verbs. Allow-list of permitted verbs — couples the rule to a closed vocabulary.                                                                                                                                                       |
| **K6. Enforcement substrate**             | `products/map/src/validation/level.js` owns the **rule predicates** (`checkProfessionalTitleShape(value)`, `checkProfessionalTitleDisjoint(level, disciplines)`, `checkAutonomyExpectation(value)`). Two call sites invoke them. (1) `validateLevels` in `products/map/src/validation.js` for `fit-map validate` — collects errors, does not throw. (2) `loadStandardConfig` in `products/map/src/loader.js` for the render path — throws a structured `Error` keyed by field path before returning the standard, so non-compliant data never reaches `runJobCommand`, `--list`, `dev`, `build`, or any other consumer. Loader-side enforcement covers every leaf formatter (`generateJobTitle`, `buildAutonomySentence`, progress, interview, slide) without modifying each. | **Validator-only at `fit-map validate`** — `fit-pathway job` does not invoke `fit-map validate` today; the render path bypasses the gate and ships the bug. **Gate inside `deriveJob`** — `generateJobTitle` is also called outside `deriveJob` (`products/pathway/src/commands/job.js:49` `printJobList`, progress/interview formatters), so the gate would not cover `--list`. **Gate inside each leaf formatter** — multiplies the call into ~5 sites, each with its own error-handling surface. **Formatter-side normalisation** — spec forbids ("contract is the contract"). **Schema `pattern`** — cannot express disjointness. |
| **K7. Synthetic-prose prompt**            | `libraries/libsyntheticprose/src/prompts/pathway/level.js` is the single emitter of these fields. The "use the provided title or generate one" instruction (line 49) is replaced by two explicit branches: (a) when the DSL skeleton supplies `professionalTitle`, the prompt passes it through verbatim; (b) when it does not, the prompt instructs `Level <roman>` derived from `rank`. `autonomyExpectation` instructions inline the contract: "one sentence opening with a base-form verb (`Work…`, `Lead…`, `Define…`); never third-person (`Works…`)."                                                                                                | Post-processing pass — parallel enforcement path that drifts. Schema-driven generation — overkill for two fields. Leaving the prompt unchanged — drops the contract on the LLM with no instruction.                                                                                                                                                                                                                  |
| **K8. DSL seed alignment**                | `data/synthetic/story.dsl` levels block (lines 570–576) rewrites the six `title` strings as single-word rank tokens, one per level: **`J040: Associate, J060: Mid, J070: Senior, J080: Staff, J090: Principal, J100: Distinguished`**. The DSL `title` field semantically becomes "rank token" only; the existing `rank` integer remains the schema's `ordinalRank`. A comment in `story.dsl` above `levels {` names the contract and links to the canonical home. The parser at `libraries/libsyntheticgen/src/dsl/parser-standard.js:66` is unchanged — it still maps DSL `title` → `professionalTitle` verbatim; only the *values* the DSL writes change.                                                                                                                       | Derive `professionalTitle` from `rank` only — locks every standard to `Level <N>` and drops named seniority words the spec admits. Leave DSL role-complete and reshape downstream — keeps the bug source alive; any future regen reintroduces "Engineer Engineer".                                                                                                                                                     |
| **K9. BioNova regeneration command**      | `bunx fit-terrain build --only=pathway` against `data/synthetic/story.dsl` at the `seed 42` directive embedded in the DSL (line 6). No separate pin file; the seed is in the DSL the command consumes.                                                                                                                                                                                                                                                                                                                                                                                                                                                | Separate seed-pin file — duplicates the DSL's own `seed` directive. Regenerating the entire terrain — slow; only `pathway` output is needed for the spec's BioNova parity test.                                                                                                                                                                                                                                       |
| **K10. Starter migration**                | `products/map/starter/levels.yaml` already uses rank-only (`Level I`, `Level II`) and base-verb (`Work with supervision`, `Work independently…`) — no data change. Starter is the reference exemplar in the contract document; additional examples in the contract (`Senior`, `Staff`) come from the DSL's new tokens (K8), not the starter.                                                                                                                                                                                                                                                                                                          | Add more levels to the starter to cover non-`Level` rank tokens — out of spec scope (starter is the introductory exemplar; new levels need their own design).                                                                                                                                                                                                                                                          |
| **K11. Schema description update**        | `professionalTitle.description` becomes `"Rank token for the professional/IC track. Must be 'Level <numeral>' or a single seniority word (e.g. 'Senior'); see <https://www.forwardimpact.team/docs/products/authoring-standards/index.md#level-field-conventions>."`. `autonomyExpectation.description` becomes `"One sentence opening with a base-form verb (e.g. 'Work…', 'Lead…'); see <same anchor>."`. The misleading existing examples (`Engineer I, Senior Engineer`) are removed.                                                                                                                                                                | Keep the existing description prose unchanged and append a link — leaves the misleading examples in place. Use schema `pattern` instead of description — covered by K6.                                                                                                                                                                                                                                               |

## Data Flow

```mermaid
sequenceDiagram
  participant A as Author / Prose
  participant L as levels.yaml
  participant V as validateLevels<br/>(fit-map validate)
  participant Ld as loadStandardConfig<br/>(render path)
  participant F as generateJobTitle<br/>buildAutonomySentence<br/>list / progress / interview
  A->>L: write fields
  L->>V: batch run
  V-->>A: INVALID_VALUE errors
  L->>Ld: render command starts
  Ld->>Ld: invoke check* predicates
  Ld-->>A: throw with field path + anchor URL on first violation
  Ld->>F: pass standard (predicates passed)
  F-->>A: rendered markdown
```

The loader-side gate is what makes the spec's "caught before render" claim
true. Every render command — `npx fit-pathway job [--list]`, `dev`, `build`,
`update` — funnels through `loadStandardConfig`; failing fast there
structurally cannot be bypassed by a leaf formatter.

## Interfaces

**Validator** (`products/map/src/validation/level.js`)

Three exported pure predicates:

- `checkProfessionalTitleShape(value): { ok, reason? }` — K3(a)
- `checkProfessionalTitleDisjoint(level, disciplines): { ok, reason? }` — K3(b)
- `checkAutonomyExpectation(value): { ok, reason? }` — K5

`validateLevel(level, index)` keeps its signature and invokes the
non-cross-discipline checks (K3(a), K5). The K3(b) cross-check lives in
`validateLevels` (the orchestrator in `validation.js:126`, which already holds
the full disciplines array), which iterates levels and calls
`checkProfessionalTitleDisjoint` once per level. The orchestrator converts
predicate output into `INVALID_VALUE` errors with `path` and a `hint`
pointing at the canonical-home anchor.

**Loader** (`products/map/src/loader.js`)

`loadStandardConfig` invokes the same three predicates after parsing YAML and
before returning the standard object. On the first failure it throws an
`Error` shaped `{ field, value, reason, contractUrl }`; callers
(`runJobCommand`, `dev`, `build`, `update`) surface it as a non-zero exit
with a clear message and the URL.

**Schema** — `description` strings updated per K11. No `pattern` added.

**Formatter** — no interface change. Inputs are pre-validated.

**Prompt** — `buildLevelPrompt` keeps its signature; prompt body updated per K7.

## Out of Scope (named in spec)

`impactScope`, `complexityHandled`, `influenceScope`, `managementTitle`, and
`qualificationSummary` are not covered. The two new predicates are namespaced
in the same module so a follow-up spec can add parallel rules cleanly.

## Risks

- **Loader-side throw changes user-visible behaviour.** `loadStandardConfig`
  currently returns even when validation would flag issues; this design
  makes it throw on contract violations. **Mitigation:** the throw carries
  the field path and the contract URL — clearer than the current "job
  renders garbage" silent failure; the existing `--validate` subflag still
  runs `validateLevels` for fuller diagnostics.
- **K5 regex false positives.** A rare base-form imperative ending in
  lowercase `s` after a non-`s` letter (`Focus on…`) would be rejected.
  **Mitigation:** the contract document carries the English rule for novel
  cases; the regex lives behind one named export so a future revision can
  add an allow-list head without changing call sites.
- **K8 ladder reshuffle is observable.** Renaming `J080 Lead Engineer` →
  `J080 Staff` (and so on) changes the seniority words the BioNova-derived
  pathway artifacts emit, including any cached prose. **Mitigation:** the
  DSL is internal; `fit-terrain build --only=pathway` is fast; consumers
  that hold prior outputs (kata-interview corpora) regenerate as a routine
  part of the spec's BioNova parity test (K9). The plan names a
  cache-invalidation step.

— Staff Engineer 🛠️

# Design 940-a — Pathway `agent` Dry-Run and Drift Validation

## Architectural Intent

Open one new resolution-check seam on the `fit-pathway agent` command and reach
it from three CLI surfaces (a no-write inputs preview, an iterating standalone
validate, and a row-state annotation on `--list`) plus one always-on pre-write
gate on generation. The check inspects what entity-level validation does not:
the resolution outcome of a specific discipline×track at the reference level.

The seam is a single pure library function over already-derived data
(`evaluateResolution`). The existing derivation pipeline
(`deriveAgentSkills` → `deriveToolkit`) feeds it; every new CLI surface
consumes it. No existing call site of `validateAllData`, `validateAgentProfile`,
or `validateAgentSkill` changes — those address different drift classes and
must remain distinguishable in error output.

## Components

```mermaid
graph LR
  argv[argv] --> libcli[libcli parser]
  libcli --> cmd[runAgentCommand]
  cmd --> branch{mode}
  branch -- --list --> listPath[for each pair: derive + evaluate → render row+state]
  branch -- --validate --> valPath[for each pair: derive + evaluate → emit blocks → exit code]
  branch -- --dry-run --> dryPath[resolve pair → derive → preview formatter]
  branch -- generation --> genPath[resolve pair → derive → evaluateResolution]
  genPath -- error --> failClose[exit !=0 before write]
  genPath -- warning --> warnContinue[stderr warning → existing validators → write]
  genPath -- clean --> existingPath[existing validators → write]
  listPath & valPath & dryPath -.uses.-> evalLib
  genPath -.uses.-> evalLib[evaluateResolution]
```

| Component                       | Module                                                                 | Change                                                                                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent` CLI definition          | `products/pathway/bin/fit-pathway.js`                                  | Add `--dry-run` and `--validate` boolean options on the `agent` command (`--list` is currently a global option, not `agent`-local — these three are intentionally `agent`-scoped) |
| `runAgentCommand`               | `products/pathway/src/commands/agent.js`                               | Recognises the three new modes (dry-run, validate, gated generation); each mode routes through derivation + `evaluateResolution`; mode sequencing within the function is plan-scope                                                  |
| `evaluateResolution`            | `libraries/libskill/src/agent.js` (new export)                         | **New.** Pure function over `{ skillMatrix, toolkit }` returning `{ state, drifts }` — see Interface Contract                                                       |
| Resolved-inputs formatter       | `products/pathway/src/formatters/agent/dry-run.js` (new)               | **New.** Render every SC1-named field as bulleted markdown; emit JSON when global `--json` is set                                                                   |
| `--list` row-state annotation   | `products/pathway/src/commands/agent-list.js`                          | Each row on the rendered `--list` output carries one of three mutually-distinct state indicators (SC4); placement, glyph set, and reach into the verbose mode are rendering decisions deferred to plan |
| Drift error formatter           | `products/pathway/src/commands/agent.js`                               | Reuse `formatError`/`formatBullet`; one stderr block per failing pair carrying discipline ID, track ID, drift-class name (SC2/SC5)                                  |
| `deriveAgentSkills` / `deriveToolkit` / `deriveAgentBehaviours` | `libraries/libskill/src/`                              | **Unchanged.** New consumers call them once per pair through the same signatures                                                                                    |
| `findValidCombinations`         | `products/pathway/src/commands/agent-list.js`                          | **Unchanged.** Defines the pair set the validate and `--list` surfaces iterate                                                                                      |
| Help reflection                 | libcli rendering                                                       | Implicit — new option entries surface in `--help` automatically when added to the libcli definition above (spec scope row 6)                                        |
| Guide cascade                   | `websites/fit/docs/products/agent-teams/index.md` + libcli `documentation` array + `.claude/skills/fit-pathway/SKILL.md` `## Documentation` | Add a "Validate before generating" step between Preview and Generate in the guide; libcli/SKILL doc-link parity holds (SC6)                                         |

Out of scope per spec: `interview`/`progress`/`job`/`dev`/`serve`/`build`/`update`
commands; schema changes; generated artefact contents on `--output`; new check
on `--skills`/`--tools`.

## Data Flow

```mermaid
graph TD
  pair[pair: discipline x track] --> derive[deriveAgentSkills + deriveToolkit]
  derive --> matrix[(skillMatrix)]
  derive --> toolkit[(toolkit)]
  matrix --> eval[evaluateResolution]
  toolkit --> eval
  eval --> state["{ state, drifts[] }"]
  state -- '--dry-run' --> preview[bulleted markdown / JSON to stdout, no write, exit 0]
  state -- '--validate' --> agg[accumulate per-pair → exit non-zero on any error]
  state -- '--list' --> annotate[row indicator on rendered output]
  state -- generation --> gate{state}
  gate -- error --> noWrite[stderr block → exit 1 before any file write]
  gate -- warning --> warn[stderr warning line → continue to existing validators]
  gate -- clean --> through[existing validators → write/print as today]
```

`evaluateResolution` is the single arrow every new surface routes through. The
generation path retains its existing `validateAgentProfile` /
`validateAgentSkill` step **after** the new gate — entity-level checks remain
the second tier; resolution-level checks are the new first tier.

## Key Decisions

| #  | Decision                                                                                                              | Alternative rejected                                                                                            | Why                                                                                                                                                                                                                                            |
| -- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 | Dry-run flag spelling: `--dry-run`                                                                                    | `--preview`; `--validate` on `agent`                                                                            | `--preview` overloads the existing "no `--output`" preview that already prints rendered markdown; `--validate` is reserved for D2's standalone surface and is a distinct shape (iterating, no positional)                                       |
| D2 | Standalone validate surface: `agent --validate` (no `<discipline>`, no `--track`)                                     | New top-level `fit-pathway validate` subcommand; top-level global `--validate`                                  | A top-level `validate` collides with the entity-level validation `validateAllData` already runs on every command (and any future user-facing surfacing of that result); symmetric with `agent --list` (also no positional, also pair-iterating) |
| D3 | Resolved-inputs output format: bulleted markdown by default; JSON when the existing global `--json` flag is set       | JSON-only; new `--format` option; rendered markdown profile                                                     | Reuses the global `--json` already declared (`fit-pathway.js:201`); rendered profile is the surface spec § Scope explicitly excludes from dry-run output                                                                                       |
| D4 | Drift-check function lives in `libraries/libskill/src/agent.js` (sibling to `deriveAgentSkills`) as a new pure export `evaluateResolution({ skillMatrix, toolkit })` | New `@forwardimpact/libpathway-validation` package; `libraries/libskill/src/agent-validation.js` (sibling to `validateAgentProfile`); pathway-private `src/commands/` function | Caller imports the resolved-matrix producer and the resolution evaluator from the same module; `agent-validation.js` houses entity-level checks (`validateAgentProfile`/`validateAgentSkill`) and resolution-level checks are intentionally distinguishable from those, per D5; pure over already-library types so `build-packs` and the web preview can call it later without cross-package coupling |
| D5 | The resolution check is a new first-tier gate on generation; the existing entity-level `validateAgentProfile`/`validateAgentSkill` remain the second tier  | Wrap `validateAgentProfile` to fold in drift; emit drift from inside library `generateAgentProfile`              | Entity-level and resolution-level checks address different drift classes (spec § Out of scope: re-implementing entity-level checks); folding them blurs the error contract SC2/SC5 specify; sequencing within `runAgentCommand` is plan-scope                                                  |
| D6 | `agent --list` row-state annotation: three mutually-distinct indicators on the rendered `--list` output (SC4) | Leading-symbol only; trailing-tag only; new column                                                              | SC4 binds three mutually-distinct strings on a single rendered run; placement, glyph set, and reach into the verbose mode are rendering details with no spec-binding constraint, deferred to plan                                              |
| D7 | Drift error contract: one stderr block per failing pair, each carrying discipline ID, track ID, and drift-class name | Single rolled-up error per run; JSON-only on stderr                                                             | SC2 + SC5 require all three identifiers in stderr; per-pair block reads sensibly under both `agent --output=…` (one pair) and `agent --validate` (many pairs)                                                                                  |

## Interface Contract — `evaluateResolution`

Signature: `evaluateResolution({ skillMatrix, toolkit }) → { state, drifts }`

| `state`     | `drifts`                                                                       | Caller behaviour                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `"clean"`   | `[]`                                                                           | Generation proceeds; `--validate` row absent from failure set; `--list` indicator = clean                                                  |
| `"warning"` | `[{ class: "empty-toolkit", severity: "warning", detail }]`                    | Generation emits stderr warning line and continues; `--validate` exit code unaffected; `--list` indicator = warning                       |
| `"error"`   | `[{ class: "empty-skill-set", severity: "error", detail }]`                    | Generation emits stderr block and exits 1 **before any file write**; `--validate` accumulates and exits non-zero; `--list` indicator = error |

Drift classes (spec § Drift classes) are stable string IDs the plan owns:
`empty-skill-set` (error) when `skillMatrix.length === 0`; `empty-toolkit`
(warning) when `skillMatrix.length > 0 && toolkit.length === 0`. The two
classes are mutually exclusive today, so `drifts.length ≤ 1`; the array shape
is preserved so future classes can append without a contract change. Each
entry also carries a `detail: string` field — a short stable phrase the
stderr block renders verbatim (e.g. `"no skills admitted at the reference
level"`); the plan owns the exact strings, but the field's presence is the
contract surface SC5's "bulleted detail line" reads from.

## Error Shape Contract (SC2 / SC5)

One block per failing pair on stderr, in the same shape `requireEntity` already
emits:

- exit code: `1` for any error-class drift; `0` when every pair is clean or
  warning-only
- stderr: `error: Resolution check failed for <discipline> × <track>: <drift-class>`
  followed by one bulleted detail line per drift entry
- never writes any file when the gating pair is in the error state (SC2 verifies
  `./out` not created)

`--validate` aggregates: every failing pair gets its block; clean pairs are
silent; warning-only pairs emit a single-line warning preceded by `warning:`
(distinct from `error:`) so the row state on `--list` and the per-pair stderr
under `--validate` agree.

## Risks

- **R1 — `--list` pipe stability.** Adding state annotation changes the row
  shape consumers currently pipe. The plan owns placement, the exact indicator
  strings, and a changelog note; this design commits only to "three mutually
  distinct strings on the rendered `--list` output" (SC4).
- **R2 — Per-pair derivation cost.** `--validate` and `--list` both call
  `deriveAgentSkills`/`deriveToolkit` once per pair. Pair count is bounded by
  the published `findValidCombinations` set (≤ tens, not thousands); no
  caching layer required. Plan owns sequencing.
- **R3 — Settings merge-target labelling.** `claudeSettings` and
  `vscodeSettings` are loaded at agent-data top level, not per-pair; the
  dry-run preview must label them as such so the persona does not infer
  per-pair settings. Plan owns the labels.

— Staff Engineer 🛠️

# Plan: 290 — Pathway Graph Indexing

## Approach

Two independent work streams share a directory but can land in either order.
Stream A (Map export) produces HTML microdata from pathway YAML so the
existing resource/graph pipeline picks up base entities. Stream B (Pathway
service) wraps libskill derivation as a gRPC service and wires it into
fit-guide. Only one small shared change connects them: a parser filter
widening so `fit:` typed microdata items are accepted as main items.

Order: land Stream A's parser change first (it is the only cross-cutting
edit), then Stream A and Stream B can proceed independently. Integration and
the `just` wiring land last.

### Key decisions

- **Reuse existing pathway microdata formatters as the rendering engine**,
  rather than building Mustache templates from scratch.
  `products/pathway/src/formatters/{skill,behaviour,capability,discipline,track,level,stage,driver,tool}/microdata.js`
  already emit HTML keyed to the `fit:` vocabulary via
  `products/pathway/src/formatters/microdata-shared.js` (which pins
  `VOCAB_BASE = "https://www.forwardimpact.team/schema/rdf/"` and expands
  every `itemtype` to the full IRI). These formatters are promoted from
  `products/pathway/` into the `fit-map export` pipeline so Map becomes
  the single owner of the HTML-microdata representation. The `pathway`
  product consumes the same code path via a cross-package import (or the
  code is moved into `libskill` / `@forwardimpact/map`). The current
  `products/pathway/src/formatters/*/microdata.js` files are **removed**
  in this spec — there is one renderer, owned by Map.
- **One HTML file per entity** written to `data/knowledge/pathway/<type>/<id>.html`.
  The subdirectory isolates generated files from hand-authored knowledge
  and makes `data-clean`-then-regenerate idempotent. The exporter deletes
  the `data/knowledge/pathway/` tree at the start of each run so stale
  entries left over from deleted YAML entries do not leak into the
  resource processor.
- **Widen the microdata parser's prefix filter**, not rebuild the resource
  processor. The spec's "Not Included" list excludes processor changes, but
  `libraries/libresource/parser.js` currently rejects any typed item that
  does not start with `https://schema.org/` (see `isMainItem`, parser.js:59).
  Since the spec mandates `fit:` vocabulary in templates *and* requires
  `fit:Skill` etc. to appear in `just cli-subjects` output (success criterion
  2), a targeted filter widening is unavoidable. This is a two-line change,
  not a refactor, and is called out explicitly below.
- **Pathway service mirrors `services/graph/` exactly** — same class
  layout, same composition-root shape, same ToolCallResult return pattern.
  No new service framework primitives.
- **Service is a thin transport** — each RPC method delegates directly to
  libskill exports. No new derivation logic. The composition root uses the
  same three-call load sequence as `products/pathway/src/commands/agent.js`:
  `loadAllData` + `loadAgentData` + `loadSkillsWithAgentData`. Using
  `loadAllData` alone would strip the per-skill `agent` sub-object and
  break `generateStageAgentProfile`.
- **RPCs return Turtle RDF in the `content` field**, not markdown. This
  matches the existing `GetOntology` pattern and gives Guide graph-compatible
  vocabulary in every derived response, so it can chain into
  `query_by_pattern` calls against the base entities Stream A indexes. See
  B3 for the rationale in detail.
- **No new SHACL vocabulary file in this spec.** An earlier revision of
  this plan proposed `products/map/schema/rdf/derivations.ttl` so
  `get_ontology` would describe `fit:Job`, `fit:AgentProfile`, etc. That
  is built on a false premise: `libraries/libgraph/processor/ontology.js`
  derives `ontology.ttl` statistically from observed quads at processing
  time — nothing reads TTL files from `products/map/schema/rdf/`, and the
  spec explicitly forbids materializing derived entities into the graph.
  Adding a TTL file would be invisible to `get_ontology`. The pathway
  service will therefore emit `fit:Job` / `fit:AgentProfile` /
  `fit:Progression` IRIs in its Turtle responses using an ad-hoc but
  documented vocabulary, and Guide will learn those types from the tool
  descriptions in `tools.yml` rather than from `get_ontology`. A proper
  fix (merging hand-authored TTLs into `ontology.ttl`) is deferred to a
  follow-up spec.
- **Tool names are frozen by the spec's terminology section.** Do not
  re-abbreviate or shorten in implementation: `pathway_list_jobs`,
  `pathway_describe_job`, `pathway_list_agent_profiles`,
  `pathway_describe_agent_profile`, `pathway_describe_progression`,
  `pathway_list_job_software`.
- **Codegen prerequisite for Stream B.** All gRPC service packages in this
  monorepo depend on generated bases produced by `bunx fit-codegen --all`
  (a.k.a. `just codegen`). Running `bun run test` in `services/pathway/`
  before codegen will fail with `PathwayBase is undefined` because
  `services.PathwayBase` does not exist yet. The implementation sequence
  is therefore: `bun install` → `just codegen` → tests. This is already
  true for `services/graph/` etc.; it is called out here because
  `services/pathway/` is new and first-time contributors commonly miss it.

## Stream A — Map HTML export

### A1. Widen microdata parser prefix filter (shared)

**File:** `libraries/libresource/parser.js`

- In `isMainItem` (line 59), accept both `https://schema.org/` and
  `https://www.forwardimpact.team/schema/rdf/` prefixes.
- In `#groupQuadsByItem` / the matching filter at line 181, apply the same
  widening.
- Extract the allowed prefixes into a single private constant so both sites
  stay in sync.

**Tests:** `libraries/libresource/test/parser.test.js` — add a fixture with a
`fit:Skill` microdata item and assert it is returned by the parser. Run the
existing schema.org fixtures to confirm no regression.

### A2. Relocate microdata formatters to Map

The rendering engine already exists in
`products/pathway/src/formatters/*/microdata.js`. These files are the
source of truth for how framework entities become HTML with `fit:`
microdata — they pull `VOCAB_BASE` from
`products/pathway/src/formatters/microdata-shared.js` and produce full
`itemtype="https://www.forwardimpact.team/schema/rdf/<Type>"` attributes
that the resource processor (after A1's widening) will accept as main
items.

**Move the formatters into Map** so there is one renderer, owned by the
data product:

- New directory: `products/map/src/formatters/` containing the moved
  files:
  - `microdata-shared.js`
  - `shared.js` (if imported by any microdata formatter)
  - `skill/microdata.js`
  - `behaviour/microdata.js`
  - `capability/microdata.js` (if present; else skills nest inline)
  - `discipline/microdata.js`
  - `track/microdata.js`
  - `level/microdata.js`
  - `stage/microdata.js`
  - `driver/microdata.js`
  - `tool/microdata.js`
- Add a barrel `products/map/src/formatters/index.js` exporting one
  function per entity type, e.g. `formatSkillMicrodata(skill)`,
  `formatCapabilityMicrodata(capability, skills)`, etc.
- **Delete** the corresponding files under
  `products/pathway/src/formatters/*/microdata.js` and any `microdata-shared.js`
  that is now duplicated in Map. Update all pathway imports to
  `@forwardimpact/map/formatters` (the new barrel, re-exported from
  `products/map/src/index.js`). Run `grep -rn "formatters/.*microdata\|microdata-shared" products/pathway/` to find consumers.
- If any pathway code consumes the microdata formatter at runtime (not
  just at build time), keep the public function names identical so the
  import rewrite is mechanical.

Before moving, check for close relatives: `dom.js`, `markdown.js`, and
`shared.js` siblings in each formatter dir are part of the pathway
product's rendering stack and **stay** in
`products/pathway/src/formatters/`. Only `microdata.js` and
`microdata-shared.js` relocate.

**Tests:** move the microdata-specific portions of
`products/pathway/test/formatters/*` that correspond to the relocated
files to `products/map/test/formatters/`. Tests that exercise the
non-microdata siblings remain in pathway.

### A3. Implement export command

**New file:** `products/map/src/exporter.js`

Exports a factory `createExporter({ fs, formatters })` returning a class
with:

```
async exportAll({ data, outputDir })
```

Behaviour:

1. Accept the already-loaded `data` object (discipline, level, track,
   capability, skill, behaviour, stage, driver, tool). The exporter is
   stateless; the CLI composition root in A4 is responsible for loading.
2. Compute the target directory `outputDir/pathway/`.
3. **Clear stale output**: `rm -rf outputDir/pathway/` before any write.
   This solves the "entity removed from YAML" drift problem — we don't
   try to diff, we regenerate from scratch. Fast and deterministic.
4. For each entity type, call the matching formatter from
   `@forwardimpact/map/formatters` to produce an HTML string, wrap it in
   a minimal HTML document shell (`<!DOCTYPE html><html><body>...
   </body></html>`), and write to
   `outputDir/pathway/<type>/<id>.html`. The document shell is required
   because `MicrodataRdfParser` expects a parseable HTML document, not a
   fragment.
5. Recursively mkdir as needed.
6. Capabilities are written with their skills nested inline (the existing
   capability microdata formatter already does this, or — if the current
   formatter does not — the exporter composes skill formatter output into
   a capability wrapper emitting `itemprop="skills"`).
7. Skills are **also** written as standalone files under
   `pathway/skill/<id>.html` so `get_subjects fit:Skill` enumerates them
   by direct IRI regardless of capability nesting.
8. Return `{ written: [...paths], skipped: [...], errors: [...] }`.
9. No filesystem writes outside `outputDir/pathway/`.

**New file:** `products/map/src/index.js` — add `createExporter` factory
alongside existing `createDataLoader`, `createSchemaValidator`,
`createIndexGenerator`, and re-export the formatters barrel.

**Tests:** `products/map/test/exporter.test.js`

- Fixture with a minimal discipline + level + capability + one skill +
  one behaviour + one stage + one driver + one tool.
- Assert each expected file is written to
  `outputDir/pathway/<type>/<id>.html`.
- Assert the written HTML parses via `MicrodataRdfParser` and produces
  quads whose subjects use the
  `https://www.forwardimpact.team/schema/rdf/` vocabulary.
- Assert idempotency: running twice yields identical bytes.
- Assert stale-cleanup: pre-seed `outputDir/pathway/skill/ghost.html`,
  run the exporter, assert `ghost.html` is gone.

### A4. Wire `fit-map export` CLI subcommand

**File:** `products/map/bin/fit-map.js`

- Add `export` to the command dispatcher next to `validate` (around line
  112). Pattern: resolve `dataDir` via `findDataDir`, resolve `outputDir`
  from `--output=<path>` or default to `<repo data root>/knowledge`
  (use the existing `Finder` pattern used for the pathway data dir at
  line 70).
- Load data: `loader.loadAllData(dataDir)`. This returns
  `{ drivers, behaviours, skills, disciplines, tracks, levels, capabilities, stages, questions, framework }`,
  which covers every entity type the exporter writes. No additional
  loader calls are needed for export (the agent-specific `loadAgentData`
  / `loadSkillsWithAgentData` variants are only required by Stream B's
  derivation RPCs, not here).
- Add help text matching the docblock at the top of the file.
- Import `createExporter` lazily (consistent with `runValidate`).
- Print summary: number of files written per entity type.
- Return exit code 0/1.

### A5. Justfile integration

**File:** `justfile`

Add recipe after `process-graphs` (line 96):

```
# Export framework entities to HTML/microdata
export-framework:
    bunx --workspace=@forwardimpact/map fit-map export
```

Chain it before `process-resources`:

```
process: export-framework process-agents process-resources process-tools process-graphs process-vectors
process-fast: export-framework process-agents process-resources process-tools process-graphs
```

`data-init` (line 101) already creates `data/knowledge` so no change needed.
`quickstart` (line 24) inherits the change transitively via `process-fast`.

## Stream B — Pathway derivation service

> **Note:** An earlier revision of this plan included a B0 step to add
> `products/map/schema/rdf/derivations.ttl` so `get_ontology` would
> describe `fit:Job`, `fit:AgentProfile`, etc. That step is dropped — see
> the Key Decisions section for the rationale. The pathway service emits
> those classes in its own Turtle responses; Guide learns them from tool
> descriptions, not from `get_ontology`.

### B1. Scaffold service package

**New directory:** `services/pathway/`

Files:

- `package.json` — `@forwardimpact/svcpathway`, dependencies on
  `@forwardimpact/librpc`, `@forwardimpact/libconfig`,
  `@forwardimpact/libtelemetry`, `@forwardimpact/libskill`,
  `@forwardimpact/map`, `@forwardimpact/libtype`, and `n3` (for Turtle
  serialization). Scripts: `"dev": "node --watch server.js"`, `"test"`.
  Model on `services/graph/package.json`.
- `proto/pathway.proto` (see B2).
- `index.js` — `PathwayService` class (see B3).
- `src/serialize.js` — pure Turtle serializers (see B3).
- `server.js` — composition root (see B4).
- `test/service.test.js` — RPC tests that parse the returned Turtle.
- `test/serialize.test.js` — unit tests for the serializers.
- `README.md` not required.

### B2. Proto definition

**New file:** `services/pathway/proto/pathway.proto`

```proto
syntax = "proto3";

package pathway;

import "common.proto";
import "tool.proto";

service Pathway {
  rpc ListJobs(ListJobsRequest) returns (tool.ToolCallResult);
  rpc DescribeJob(DescribeJobRequest) returns (tool.ToolCallResult);
  rpc ListAgentProfiles(ListAgentProfilesRequest) returns (tool.ToolCallResult);
  rpc DescribeAgentProfile(DescribeAgentProfileRequest) returns (tool.ToolCallResult);
  rpc DescribeProgression(DescribeProgressionRequest) returns (tool.ToolCallResult);
  rpc ListJobSoftware(ListJobSoftwareRequest) returns (tool.ToolCallResult);
}

message ListJobsRequest {
  optional string discipline = 1;
}

message DescribeJobRequest {
  string discipline = 1;
  string level = 2;
  optional string track = 3;
}

message ListAgentProfilesRequest {
  optional string discipline = 1;
}

message DescribeAgentProfileRequest {
  string discipline = 1;
  string track = 2;
  // Optional stage id (e.g. "intern", "established"). If omitted, the
  // service returns every stage profile for the discipline×track.
  optional string stage = 3;
}

message DescribeProgressionRequest {
  string discipline = 1;
  string from_level = 2;
  string to_level = 3;
  optional string track = 4;
}

message ListJobSoftwareRequest {
  string discipline = 1;
  string level = 2;
  optional string track = 3;
}
```

Codegen (`just codegen` / `fit-codegen`) picks this up automatically —
libtype exposes `pathway.*` message types after generation.

### B3. Service class

**New file:** `services/pathway/index.js`

```javascript
import { services } from "@forwardimpact/librpc";
import {
  generateAllJobs,
  getValidLevelTrackCombinations,
  deriveJob,
  deriveReferenceLevel,
  deriveAgentSkills,
  deriveAgentBehaviours,
  analyzeProgression,
  analyzeCustomProgression,
  deriveToolkit,
  generateStageAgentProfile,
} from "@forwardimpact/libskill";

const { PathwayBase } = services;

export class PathwayService extends PathwayBase {
  #data;
  #agentData;
  #skillsWithAgent;

  /**
   * @param {ServiceConfig} config
   * @param {object} bundle
   * @param {object} bundle.data              - loadAllData() output
   * @param {object} bundle.agentData         - loadAgentData() output
   * @param {Array}  bundle.skillsWithAgent   - loadSkillsWithAgentData() output
   */
  constructor(config, { data, agentData, skillsWithAgent }) {
    super(config);
    if (!data) throw new Error("data is required");
    if (!agentData) throw new Error("agentData is required");
    if (!skillsWithAgent) throw new Error("skillsWithAgent is required");
    this.#data = data;
    this.#agentData = agentData;
    this.#skillsWithAgent = skillsWithAgent;
  }

  async ListJobs(req) { /* delegates to generateAllJobs */ }
  async DescribeJob(req) { /* delegates to deriveJob */ }
  async ListAgentProfiles(req) { /* enumerates disciplines × tracks */ }
  async DescribeAgentProfile(req) { /* calls generateStageAgentProfile per stage */ }
  async DescribeProgression(req) { /* analyzeProgression / analyzeCustomProgression */ }
  async ListJobSoftware(req) { /* deriveJob → deriveToolkit */ }
}
```

**libskill call signatures** (verified against
`libraries/libskill/derivation.js`, `agent.js`, `progression.js`,
`toolkit.js`):

| RPC | libskill calls (in order) |
| --- | --- |
| `ListJobs` | `generateAllJobs({ disciplines, levels, tracks, skills, behaviours, validationRules })` — no `capabilities` arg. Filter the returned array by `req.discipline` if provided. |
| `DescribeJob` | `deriveJob({ discipline, level, track, skills, behaviours, capabilities, validationRules, levels })` — `capabilities` **is** an arg here (it feeds `deriveResponsibilities`). |
| `ListAgentProfiles` | Loop `for (const d of data.disciplines)` calling `getValidLevelTrackCombinations({ discipline: d, levels, tracks })`, then reduce to unique `(discipline, track)` pairs. `getValidLevelTrackCombinations` requires `discipline` — there is no "all disciplines" short-circuit. |
| `DescribeAgentProfile` | See dedicated section below. |
| `DescribeProgression` | `analyzeProgression(currentJob, targetJob)` when same discipline/track, else `analyzeCustomProgression({ currentJob, targetJob })`. Both sides are materialized via `deriveJob` first. |
| `ListJobSoftware` | `deriveJob(...)` to get `skillMatrix`, then `deriveToolkit({ skillMatrix, skills })`. |

Notes:
- `validationRules` must be sourced from `data.framework.validation` (or
  the equivalent field `loadAllData` attaches). Passing `undefined`
  silently disables validation — do not do this.
- `generateAllJobs` returns full `JobDefinition` objects with skill
  matrices; do **not** serialize the matrices in `ListJobs`. The list
  serializer emits only `fit:Job`, `rdfs:label`, `fit:discipline`,
  `fit:level`, `fit:track` per job. Matrix detail is reserved for
  `DescribeJob`.

**`DescribeAgentProfile` composition.** The actual flow in
`products/pathway/src/commands/agent.js` builds stage-specific profiles
via `generateStageAgentProfile({ ...stageParams, stage })`. The earlier
revision of this plan described a non-existent
`deriveReferenceLevel → deriveAgentSkills → deriveAgentBehaviours` flow
that is only used for the `--skills` / `--tools` short paths. The
correct implementation mirrors `runAgentCommand` lines 437–498:

1. Resolve `humanDiscipline`, `humanTrack`, `agentDiscipline`,
   `agentTrack` from `req.discipline` + `req.track` against `data` and
   `agentData` (port `resolveAgentEntities` from `agent.js`, or expose it
   from a shared module).
2. `level = deriveReferenceLevel(data.levels)`.
3. Build `stageParams`:
   ```javascript
   const stageParams = {
     discipline: humanDiscipline,
     track: humanTrack,
     level,
     skills: skillsWithAgent,    // from loadSkillsWithAgentData
     behaviours: data.behaviours,
     agentBehaviours: agentData.behaviours,
     agentDiscipline,
     agentTrack,
     stages: data.stages,
   };
   ```
4. If `req.stage` is set: resolve the stage object from `data.stages`,
   call `generateStageAgentProfile({ ...stageParams, stage })`, serialize
   the single profile.
5. If `req.stage` is unset: map across `data.stages`, call
   `generateStageAgentProfile` for each, serialize as a list of
   `fit:AgentProfile` nodes each linked to their `fit:stage`.

**Why `skillsWithAgent` is mandatory.** `loadAllData` strips the `agent`
sub-object from each skill (see
`products/map/src/loader.js:114-127`). `generateStageAgentProfile` reads
`skill.agent` to derive the agent skill matrix. Without
`loadSkillsWithAgentData`, the profile is empty. The service must
receive both `data` (via `loadAllData`) and `skillsWithAgent` (via
`loadSkillsWithAgentData`) and pass the latter in `stageParams.skills`,
not `data.skills`.

**Output format: Turtle RDF in the `content` field.** Each RPC returns
`{ content: <turtle-string> }`. This matches the existing `GetOntology`
pattern (`services/graph/index.js:60` — returns `ontology.ttl` Turtle as
`content`) and, crucially, makes derived results speak the same vocabulary
as the graph-indexed base entities from Stream A. The LLM can then pattern
the response against vocabulary it already learned from `get_ontology` /
`get_subjects` and issue follow-up `query_by_pattern` calls against the
graph for related base entities.

Why RDF and not markdown:
- **Pipeline coherence.** Base entities exported by Stream A flow through
  `libresource` → `libgraph` as Turtle quads under the `fit:` namespace
  (`libraries/libresource/parser.js:74` — `quadsToRdf` uses N3 `Writer` with
  `format: "Turtle"`). If the service emitted markdown, Guide would have two
  incompatible views of the same vocabulary and could not chain derived
  results into graph queries.
- **Follow-up queries.** When Guide sees a skill IRI like
  `https://www.forwardimpact.team/schema/rdf/skill/python` in a
  `DescribeJob` response, it can immediately issue
  `query_by_pattern(subject=<iri>, predicate="?", object="?")` against the
  graph to pull the base skill definition, stage handoffs, capability
  membership, toolReferences, etc. Markdown kills that flywheel.
- **Existing convention.** `GetOntology` returns Turtle in `content` today.
  The `identifiers` field (Pattern B) is not usable here because derived
  entities are not persisted to `ResourceIndex` (spec: "No materialization
  of derived entities into the RDF graph") — nothing for the Agent's
  `hands.js:178` resource loader to fetch. Turtle in `content` is the only
  viable option that keeps graph-compatible vocabulary visible to the LLM.

**Vocabulary:** The service emits IRIs under the same
`https://www.forwardimpact.team/schema/rdf/` namespace used by the
Stream A formatters and the TTL schemas in
`products/map/schema/rdf/`. For base-entity references (skill, behaviour,
level, discipline, track, stage, driver, tool) reuse the exact IRIs
Stream A emits so `query_by_pattern` lookups resolve. For derived-entity
classes and predicates, this spec introduces an ad-hoc vocabulary that
lives **only** in pathway service responses and `tools.yml` descriptions
(not in SHACL). Classes and predicates used per RPC:

| Response | Classes | Key predicates |
| --- | --- | --- |
| `ListJobs` | `fit:Job` | `fit:discipline`, `fit:level`, `fit:track`, `rdfs:label` |
| `DescribeJob` | `fit:Job`, blank-node `fit:SkillProficiency` entries | `fit:discipline`, `fit:level`, `fit:track`, `fit:skillMatrix`, `fit:skill`, `fit:proficiency`, `fit:behaviourProfile`, `fit:behaviour`, `fit:maturity`, `fit:responsibilities` |
| `ListAgentProfiles` | `fit:AgentProfile` | `fit:discipline`, `fit:track` |
| `DescribeAgentProfile` | `fit:AgentProfile`, optional `fit:stage` | `fit:discipline`, `fit:track`, `fit:stage`, `fit:agentSkill`, `fit:agentBehaviour`, `fit:frontmatter` (as JSON literal) |
| `DescribeProgression` | `fit:Progression`, blank-node `fit:SkillChange` / `fit:BehaviourChange` entries | `fit:fromJob`, `fit:toJob`, `fit:change`, `fit:skill`, `fit:behaviour`, `fit:fromProficiency`, `fit:toProficiency`, `fit:changeKind` |
| `ListJobSoftware` | `fit:Job` | `fit:software` (object = `fit:Tool` IRI), `rdfs:label` |

IRIs follow the convention:

```
https://www.forwardimpact.team/schema/rdf/job/<discipline>/<level>[/<track>]
https://www.forwardimpact.team/schema/rdf/agent-profile/<discipline>/<track>[/<stage>]
https://www.forwardimpact.team/schema/rdf/progression/<discipline>/<from>-<to>[/<track>]
https://www.forwardimpact.team/schema/rdf/skill/<skillId>    ← matches Stream A
https://www.forwardimpact.team/schema/rdf/stage/<stageId>    ← matches Stream A
```

**Progression RDF — worked example.** `analyzeProgression` returns an
object shaped `{ current, target, skillChanges[], behaviourChanges[], summary }`,
where each entry in `skillChanges[]` has fields like
`{ skillId, change, isGained, isLost, fromProficiency, toProficiency }`.
The serializer maps one `skillChange` entry to a blank node:

```turtle
@prefix fit: <https://www.forwardimpact.team/schema/rdf/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

<https://www.forwardimpact.team/schema/rdf/progression/fde/l2-l3/forward_deployed>
  a fit:Progression ;
  fit:fromJob <.../job/fde/l2/forward_deployed> ;
  fit:toJob   <.../job/fde/l3/forward_deployed> ;
  fit:skillChange [
    a fit:SkillChange ;
    fit:skill <.../skill/python> ;
    fit:fromProficiency "working" ;
    fit:toProficiency   "practitioner" ;
    fit:change 1 ;
    fit:changeKind "increased"
  ] ;
  fit:skillChange [
    a fit:SkillChange ;
    fit:skill <.../skill/cloud-architecture> ;
    fit:toProficiency "foundational" ;
    fit:changeKind "gained"
  ] .
```

`changeKind` is derived from the existing `isGained`/`isLost`/`change`
fields: `isGained → "gained"`, `isLost → "lost"`, `change > 0 →
"increased"`, `change < 0 → "decreased"`, `change === 0 → "unchanged"`.
Never invent a predicate that does not correspond to a direct field on
the libskill output; that way the RDF shape stays a mechanical
projection of the derivation result.

**Serialization helper:** Add
`services/pathway/src/serialize.js` with pure functions per shape:

```javascript
export function jobToTurtle(job) { ... }
export function jobListToTurtle(jobs) { ... }
export function agentProfileToTurtle(profile) { ... }
export function agentProfileListToTurtle(profiles) { ... }
export function progressionToTurtle(progression) { ... }
export function jobSoftwareToTurtle(job, toolkit) { ... }
```

Each returns a Turtle string using the N3 `Writer` from the `n3` package
— add `n3` as a direct dependency of `services/pathway/package.json`,
matching the convention in `services/graph/package.json`. (It is already
present in the monorepo via libresource/libgraph, but service packages
depend on it explicitly.) IRI conventions are listed in the Vocabulary
table above — deterministic, stable, and easy for the LLM to compose.

Keep the service class thin: each RPC calls libskill, hands the result to
the matching serializer, and returns `{ content: turtle }`. Do not import
`products/pathway/src/formatters/` — those siblings produce human-facing
markdown, which is the wrong shape for this interface.

**Tests:** `services/pathway/test/service.test.js`

- Construct `PathwayService` with a hand-built `data` object and call each
  RPC.
- Parse the returned `content` with the N3 `Parser` (Turtle) and assert the
  expected quads are present — subject IRIs, predicates, object values.
  This verifies vocabulary, not string formatting.
- Assert round-trip: parse → re-serialize produces a stable set of quads.
- Assert IRIs use the `fit:` namespace and follow the conventions above.

`services/pathway/test/serialize.test.js`

- Unit tests for each pure serializer function in `src/serialize.js`, with
  small fixtures and exact quad assertions.

### B4. Composition root

**New file:** `services/pathway/server.js`

```javascript
import { Server, createTracer } from "@forwardimpact/librpc";
import { createServiceConfig } from "@forwardimpact/libconfig";
import { createLogger } from "@forwardimpact/libtelemetry";
import { createDataLoader } from "@forwardimpact/map";
import { Finder } from "@forwardimpact/libutil";
import { homedir } from "os";
import { join } from "path";
import fs from "fs/promises";
import { PathwayService } from "./index.js";

const config = await createServiceConfig("pathway");
const logger = createLogger("pathway");
const tracer = await createTracer("pathway");

// Resolve the pathway data directory using the same rules as
// fit-pathway: prefer service.pathway.data_dir from config, else walk
// up from cwd using Finder.
const finder = new Finder(fs, logger, process);
const dataDir = config.dataDir
  ? String(config.dataDir)
  : join(finder.findData("data", homedir()), "pathway");

// Three-call load sequence matching products/pathway/src/commands/agent.js
// lines 411-413. loadAllData alone strips per-skill `agent` sub-objects
// and leaves DescribeAgentProfile unable to derive anything.
const loader = createDataLoader();
const data = await loader.loadAllData(dataDir);
const agentData = await loader.loadAgentData(dataDir);
const skillsWithAgent = await loader.loadSkillsWithAgentData(dataDir);

const service = new PathwayService(config, {
  data,
  agentData,
  skillsWithAgent,
});
const server = new Server(service, config, logger, tracer);
await server.start();
```

If any of the three loader calls throws or the directory is missing, let
the exception propagate — `fit-rc` treats an unhandled startup rejection
as a hard failure, per spec: "rejects startup if the data directory is
missing".

### B5. Register service in init and endpoints

**File:** `config/config.example.json`

1. Append to `init.services` array (after `graph`, before `llm`):
```json
{
  "name": "pathway",
  "command": "bun run --filter @forwardimpact/svcpathway dev"
}
```

2. Add a `service.pathway` section with the same fields other services
   expose (check `services/graph/` entries for the exact shape). At
   minimum:
   ```json
   "pathway": {
     "host": "127.0.0.1",
     "port": 50061,
     "data_dir": "data/pathway"
   }
   ```
   The `host`/`port` pair is what `services/tool/` uses to resolve
   `pathway.Pathway.*` method strings to a transport. Pick a port that
   does not collide with existing service ports in
   `config/config.example.json` — grep for `port` to confirm, then
   allocate the next free one in the svc* range. Without `host`/`port`,
   the tool service will fail to create a client and every
   `pathway_*` tool call will error.

3. Append to `service.tool.endpoints`:
```json
"pathway_list_jobs": {
  "method": "pathway.Pathway.ListJobs",
  "request": "pathway.ListJobsRequest"
},
"pathway_describe_job": {
  "method": "pathway.Pathway.DescribeJob",
  "request": "pathway.DescribeJobRequest"
},
"pathway_list_agent_profiles": {
  "method": "pathway.Pathway.ListAgentProfiles",
  "request": "pathway.ListAgentProfilesRequest"
},
"pathway_describe_agent_profile": {
  "method": "pathway.Pathway.DescribeAgentProfile",
  "request": "pathway.DescribeAgentProfileRequest"
},
"pathway_describe_progression": {
  "method": "pathway.Pathway.DescribeProgression",
  "request": "pathway.DescribeProgressionRequest"
},
"pathway_list_job_software": {
  "method": "pathway.Pathway.ListJobSoftware",
  "request": "pathway.ListJobSoftwareRequest"
}
```

**File:** `products/guide/starter/config.json` — apply the identical
changes so `npx fit-guide --init` produces a ready-to-run config.

### B6. Tool descriptions

**File:** `config/tools.example.yml`

Append six entries following the existing `get_ontology` / `get_subjects`
shape. Each entry's `instructions` and `evaluation` must state that the
tool returns **Turtle RDF using the `fit:` vocabulary** so the LLM knows to
treat the result as graph-compatible data and can chain into
`query_by_pattern`. Example `evaluation` phrasing:

> Turtle RDF describing the job using the `fit:` vocabulary. Skill and
> behaviour IRIs can be passed to `query_by_pattern` or `get_subjects` to
> retrieve base definitions from the graph.

Each `purpose` and `applicability` block must additionally include the
disambiguation sentence from spec § Terminology Risk. Concretely:

- `pathway_list_agent_profiles.purpose` / `.applicability` must contain:
  > "Pathway agent profiles are static role descriptions in framework
  > data — they are NOT runnable LLM sub-agents. Use `list_sub_agents`
  > for delegation."
- `pathway_describe_agent_profile` — same disambiguation sentence.
- `pathway_list_job_software.purpose` / `.applicability` must contain:
  > "This lists software technologies used by the job (Python, Figma,
  > etc.) — NOT the LLM tools available to you."

`pathway_list_jobs`, `pathway_describe_job`, `pathway_describe_progression`
do not collide with Guide's meta-vocabulary but should still use the
`pathway_*` prefix language in their descriptions to signal scope.

Parameter entries match the proto request fields.

**File:** `products/guide/starter/tools.yml` — mirror the same six entries.

### B7. Integration tests

Two integration tests are required for this spec. Neither is optional —
they are the automated form of success criteria 2, 7, and 8.

**File:** `services/pathway/test/integration.test.js`

- Start `PathwayService` in-process with real pathway data
  (`data/pathway` from the repo root, resolved via `Finder`).
- Call `DescribeJob` with inputs matching
  `npx fit-pathway job <discipline> <level> --track=<track>`. Parse the
  returned Turtle and assert:
  - `fit:Job` subject exists with the expected IRI.
  - The set of `fit:skill` IRIs in the skill matrix equals the set of
    skill IDs the CLI reports for the same inputs (compare to
    `deriveJob(...).skillMatrix` directly — this guarantees parity with
    libskill without depending on CLI output formatting).
  - Each `fit:proficiency` literal matches the corresponding CLI value.
- Call `DescribeProgression` with the same inputs as
  `npx fit-pathway progress <discipline> <from> <to> --track=<track>`.
  Parse the Turtle and compare the set of `fit:SkillChange` blank nodes
  to `analyzeProgression(...).skillChanges` field-by-field.

**File:** `products/map/test/pipeline.test.js`

End-to-end test for Stream A's export → resource → graph flow. This
covers success criterion 2 which no existing test touches.

- Fixture pathway data directory with one discipline, one level, one
  capability, one skill.
- Temporary `data/knowledge/`, `data/resources/`, `data/graphs/`
  directories.
- Call `createExporter(...).exportAll(...)` → confirm HTML landed.
- Invoke `libresource` `ResourceProcessor` programmatically on the
  fixture knowledge dir → confirm resources contain Turtle with `fit:`
  subjects.
- Invoke `libgraph` `GraphProcessor` programmatically → confirm
  `GraphIndex.getSubjects("fit:Skill")` returns the fixture skill.
- This test asserts the A1 parser widening and the exporter's HTML shape
  together produce queryable subjects. If it fails after a refactor,
  debugging one step at a time is still possible via the earlier per-unit
  tests.

## Verification against success criteria

| # | Criterion                                             | How verified                                       |
| - | ----------------------------------------------------- | -------------------------------------------------- |
| 1 | `fit-map export` produces HTML in `data/knowledge/`   | A4 CLI + A3 exporter tests                         |
| 2 | `just cli-subjects` lists `fit:*` types               | A1 + A5 + B7 pipeline test                         |
| 3 | `ARGS="fit:Skill" just cli-subjects` returns all      | Same; manual after `just quickstart`               |
| 4 | `npx fit-guide --init` emits pathway endpoints        | B5 starter config edit; fresh-dir manual check     |
| 5 | `npx fit-rc status` shows pathway running, tools resolve | B1–B5 end-to-end; manual check                  |
| 6 | Guide answers "what skills..." via graph path         | A stream end-to-end; manual LLM check              |
| 7 | Guide answers L3 FDE question matching fit-pathway    | B7 `DescribeJob` integration test                  |
| 8 | Guide answers progression delta matching fit-pathway  | B7 `DescribeProgression` integration test          |
| 9 | Adversarial terminology probes pass                   | B6 disambiguation sentences; manual LLM check      |

## Out of scope reminders (from spec)

- No new derivation logic — service is pure transport.
- No interview question tool.
- No agent prompt changes beyond advertising the new tools.
- No materialization of derived entities into the graph.
- No web UI for the pathway service.

## File summary

**Created:**
- `products/map/src/formatters/` (moved from pathway — `microdata-shared.js` + one `*/microdata.js` per entity)
- `products/map/src/formatters/index.js` (barrel)
- `products/map/src/exporter.js`
- `products/map/test/exporter.test.js`
- `products/map/test/pipeline.test.js` (end-to-end export → resource → graph)
- `services/pathway/package.json`
- `services/pathway/proto/pathway.proto`
- `services/pathway/index.js`
- `services/pathway/src/serialize.js`
- `services/pathway/server.js`
- `services/pathway/test/service.test.js`
- `services/pathway/test/serialize.test.js`
- `services/pathway/test/integration.test.js`

**Modified:**
- `libraries/libresource/parser.js` (prefix filter widening)
- `libraries/libresource/test/parser.test.js`
- `products/map/bin/fit-map.js` (add `export` subcommand)
- `products/map/src/index.js` (export `createExporter`, re-export formatters)
- `justfile` (add `export-framework`; chain into `process` / `process-fast`)
- `config/config.example.json` (init + endpoints + `service.pathway` host/port/data_dir)
- `config/tools.example.yml` (six new entries)
- `products/guide/starter/config.json` (mirror example)
- `products/guide/starter/tools.yml` (mirror example)
- Any `products/pathway/` files that still import the old formatter
  locations (mechanical import rewrite to `@forwardimpact/map/formatters`)

**Deleted:**
- `products/pathway/src/formatters/microdata-shared.js`
- `products/pathway/src/formatters/{skill,behaviour,discipline,track,level,stage,driver,tool}/microdata.js`
  (and `capability/microdata.js` if present). The sibling `markdown.js`,
  `dom.js`, and `shared.js` files stay in pathway.
- Corresponding microdata-only test files under
  `products/pathway/test/formatters/` (relocated to
  `products/map/test/formatters/`).

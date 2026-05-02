---
name: libs-synthetic-data
description: >
  Use when parsing or extending the terrain DSL grammar, generating
  deterministic entity graphs, producing LLM-generated prose or pathway
  agent-aligned engineering standards, rendering synthetic data to HTML, Markdown, YAML, or raw
  formats, validating generated content integrity, or running the full
  parse-generate-render pipeline.
---

# Synthetic Data Libraries

## When to Use

- Parsing or extending the terrain DSL grammar
- Generating deterministic entity graphs (orgs, teams, people, projects)
- Adding LLM-generated prose or pathway standard content
- Rendering synthetic data to HTML, Markdown, YAML, or raw documents
- Validating generated content (cross-content integrity, link density, HTML)
- Running the full parse-generate-render-validate pipeline

## Libraries

| Library            | Capabilities                                                          | Key Exports                                                                                                         |
| ------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| libsyntheticgen    | Parse DSL grammar, generate deterministic entities, shared vocabulary | `DslParser`, `createDslParser`, `EntityGenerator`, `createEntityGenerator`, `createSeededRNG`, `PROFICIENCY_LEVELS` |
| libsyntheticprose  | Generate LLM prose, pathway standard data, load schemas               | `ProseCache`, `ProseGenerator`, `PathwayGenerator`, `loadSchemas`                                                   |
| libsyntheticrender | Multi-format rendering, content validation, formatting                | `Renderer`, `createRenderer`, `ContentValidator`, `ContentFormatter`, `validateCrossContent`                        |
| libterrain         | Full parse-generate-render-validate pipeline, Supabase upload         | `Pipeline`, `loadToSupabase`                                                                                        |

## Decision Guide

- **DSL files** — libsyntheticgen ships a minimal reference DSL
  (`libraries/libsyntheticgen/data/default.dsl`) for quick testing. Projects
  provide their own DSL file; this monorepo's is at `data/synthetic/story.dsl`.
- **libsyntheticgen vs libterrain** — Use `libsyntheticgen` directly when you
  only need DSL parsing or entity generation without rendering. Use `libterrain`
  (Pipeline) when you want the full parse-generate-render-validate flow.
- **libsyntheticprose** — Only needed when LLM-generated content is required.
  The pipeline works without it in "no-prose" mode. Prose is injected via DI,
  never imported directly by the renderer.
- **libsyntheticrender** — Use directly when you have entities and want to
  render specific formats. The `Renderer` class delegates to format-specific
  renderers (HTML, Markdown, Pathway YAML, raw documents).
- **Pure functions** — `createSeededRNG`, `collectProseKeys`,
  `validateCrossContent`, `formatContent` are stateless and can be used
  standalone.
- **Shared vocabulary** — `PROFICIENCY_LEVELS`, `MATURITY_LEVELS`, and
  `STAGE_NAMES` are exported from `libsyntheticgen/vocabulary.js` (re-exported
  from the package index). All prompt builders, validators, and renderers import
  from this single source — never hardcode these values.
- **Prose caching** — `ProseCache` is the synchronous read/write store;
  `ProseGenerator` wraps it and only calls the LLM on cache miss in `generate`
  mode. Cache keys derive from the entity key alone (e.g.
  `pathway:track:platform`), so prompt changes do not invalidate. Run
  `fit-terrain generate` to regenerate with updated prompts.
- **Prior output forwarding** — `PathwayGenerator` threads generated data from
  earlier steps into downstream prompts: levels → behaviours → capabilities →
  disciplines/tracks. A shared voice preamble (`buildPreamble`) enforces
  consistent terminology across all entity builders.
- **Null safety** — `generateEntity` returns `null` on cache miss; callers
  propagate `null` rather than spreading into empty objects. The pathway
  renderer skips null entries.
- **Output cleanup** — The CLI cleans output directories before writing to
  prevent stale files from prior runs persisting.
- **CLI logging** — Use `createLogger` from libtelemetry for operational output.
  `logger.info` sends to stderr (keeps stdout clean for data), `logger.debug`
  only prints when `DEBUG=<domain>` is set.

## Composition Recipes

### Recipe 1: Parse DSL and generate entities

```javascript
import { createDslParser, createEntityGenerator } from "@forwardimpact/libsyntheticgen";
import { createLogger } from "@forwardimpact/libtelemetry";
import { readFile } from "fs/promises";

const logger = createLogger("gen");
const parser = createDslParser();
const generator = createEntityGenerator(logger);

const source = await readFile("story.dsl", "utf-8");
const ast = parser.parse(source);
const entities = generator.generate(ast);
```

### Recipe 2: Render entities to HTML

```javascript
import { Renderer } from "@forwardimpact/libsyntheticrender";
import { TemplateLoader } from "@forwardimpact/libtemplate/loader";

const templateLoader = new TemplateLoader("path/to/templates");
const renderer = new Renderer(templateLoader, logger);
const { files, linked } = renderer.renderHtml(entities, prose);
```

### Recipe 3: Full pipeline wiring

```javascript
import { createDslParser, createEntityGenerator } from "@forwardimpact/libsyntheticgen";
import { ProseCache, ProseGenerator, PathwayGenerator } from "@forwardimpact/libsyntheticprose";
import { Renderer, ContentValidator, ContentFormatter } from "@forwardimpact/libsyntheticrender";
import { Pipeline } from "@forwardimpact/libterrain/pipeline";

const proseCache = new ProseCache({ cachePath, logger });
const proseGenerator = new ProseGenerator({ cache: proseCache, mode, llmApi, promptLoader, logger });
const pipeline = new Pipeline({
  dslParser: createDslParser(),
  entityGenerator: createEntityGenerator(logger),
  proseCache,
  proseGenerator,
  pathwayGenerator: new PathwayGenerator(proseGenerator, logger),
  renderer: new Renderer(templateLoader, logger),
  validator: new ContentValidator(logger),
  formatter: new ContentFormatter(prettierFormat, logger),
  logger,
});

const result = await pipeline.run({ storyPath, schemaDir });
```

## DI Wiring

### libsyntheticgen

```javascript
// DslParser — wraps tokenizer + parser, factory available
import { DslParser, createDslParser } from "@forwardimpact/libsyntheticgen";
const parser = createDslParser(); // or: new DslParser(tokenizeFn, parseFn)

// EntityGenerator — accepts RNG factory and logger
import { EntityGenerator, createEntityGenerator } from "@forwardimpact/libsyntheticgen";
const generator = createEntityGenerator(logger); // or: new EntityGenerator(rngFactory, logger)

// Pure functions — no DI
import { createSeededRNG, collectProseKeys } from "@forwardimpact/libsyntheticgen";

// Shared vocabulary — single source of truth for all libraries
import { PROFICIENCY_LEVELS, MATURITY_LEVELS, STAGE_NAMES } from "@forwardimpact/libsyntheticgen";
```

### libsyntheticprose

```javascript
// ProseCache — synchronous JSON-backed store; ProseGenerator wraps it (async LLM
// + write-through); PathwayGenerator threads prose through standard generation.
import { ProseCache, ProseGenerator, PathwayGenerator } from "@forwardimpact/libsyntheticprose";
const cache = new ProseCache({ cachePath, logger });
const prose = new ProseGenerator({ cache, mode, strict, llmApi, promptLoader, logger });
const pathway = new PathwayGenerator(prose, logger);
```

### libsyntheticrender

```javascript
// Renderer — accepts template loader and logger
import { Renderer, createRenderer } from "@forwardimpact/libsyntheticrender";
const renderer = new Renderer(templateLoader, logger);

// ContentValidator — accepts logger
import { ContentValidator } from "@forwardimpact/libsyntheticrender";
const validator = new ContentValidator(logger);

// ContentFormatter — accepts prettier format function and logger
import { ContentFormatter } from "@forwardimpact/libsyntheticrender";
const formatter = new ContentFormatter(prettierFormat, logger);
```

### libterrain

See Recipe 3 for full `Pipeline` wiring. `loadToSupabase` accepts a Supabase
client and `{ dataDir }` options.

## GetDX API References

Synthetic data conforms to
[GetDX Web API schemas](https://docs.getdx.com/webapi/methods/) (teams,
snapshots, initiatives, scorecards).

## Verification

```sh
bun test libraries/libsyntheticgen/test/    # DSL + entity generation tests
bun test libraries/libsyntheticprose/test/  # Prose engine + prompt builder tests
bun test libraries/libsyntheticrender/test/ # Validation + rendering tests
bun test libraries/libterrain/test/         # Pipeline integration tests
bunx fit-terrain validate                   # Run full pipeline, validate, no writes
bunx fit-terrain build --only=html          # Render a single content type
bunx fit-map validate                       # Validate generated pathway data
```

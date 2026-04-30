---
name: fit-terrain
description: >
  Generate synthetic data for development, testing, and demos. Use when
  creating example agent-aligned engineering standard definitions, organizational documents, activity
  records, or knowledge base content from a terrain DSL file, or when
  testing pipeline changes end-to-end with synthetic datasets.
---

# fit-terrain CLI

Generate synthetic data for the entire Forward Impact suite from a single DSL
file. The CLI orchestrates parsing, entity generation, optional LLM prose, and
rendering into multiple output formats.

## When to Use

- Generating example data for development or testing
- Creating synthetic pathway agent-aligned engineering standards for new
  installations
- Producing organizational documents, activity records, and KB content
- Bootstrapping a realistic environment for product evaluation or demos
- Testing pipeline changes end-to-end
- Writing or editing terrain DSL files

---

## How It Works

### Pipeline

Generation flows through four stages:

1. **DSL parsing** — the terrain file is tokenized and parsed into an AST
   containing organizational hierarchy, people, projects, agent-aligned
   engineering standard definitions, and content specifications
2. **Entity generation** — the AST is expanded deterministically (using a seeded
   RNG) into a full entity graph: orgs, departments, teams, people with roles
   and skill assignments, repos, and projects
3. **Prose generation** — prose keys are collected from the entity graph (one
   per article, FAQ, briefing, etc.) with context (topic, tone, length). By
   default these are read from `prose-cache.json`; with `--generate` each key is
   sent to an LLM and the result saved to the cache; with `--no-prose` this
   stage is skipped entirely
4. **Rendering** — entities and prose are rendered into output formats: YAML
   standard files (`pathway`), HTML articles (`html`), JSON/YAML activity
   records (`raw`), and Markdown briefings (`markdown`)

### Content Validation

After rendering, cross-content validation runs automatically: internal HTML
links are checked for resolution, entities referenced in prose are verified
against the entity graph, and rendered YAML is validated against pathway
schemas.

### Prose Caching

The prose cache maps each content key to its generated text. The default mode
reads from the cache, making generation fully repeatable without LLM calls.
Using `--generate` regenerates all entries and writes the updated cache.

Structured pathway entities (agent-aligned engineering standard, levels,
behaviours, capabilities, etc.) use a stable cache key derived from the entity
key alone (e.g. `pathway:track:platform`). This means prompt changes (such as
adding context forwarding or updating preambles) do not invalidate existing
cache entries — use `--generate` to regenerate with updated prompts.

General prose entries (articles, comments, briefings) use a cache key that
includes the content context (topic, tone, length).

### Output Cleanup

The CLI cleans output directories before writing new files, preventing stale
files from prior runs from persisting. This means each run produces a clean,
complete output set.

---

## CLI Reference

See [`references/cli.md`](references/cli.md) for full command listings.

---

## Terrain DSL

See [`references/dsl.md`](references/dsl.md) for syntax, top-level blocks, and
key block descriptions.

---

## Data Resolution

Use `--story=path` to specify a custom terrain DSL file. Without `--story`, the
CLI falls back to the minimal reference DSL bundled with the package.

Generated output writes to the `data/` directories listed under Content Types
above.

---

## Prose Cache

The prose cache is stored at `data/synthetic/prose-cache.json`. This file is
pre-populated for the BioNova terrain. The default mode reads from it without
LLM calls.

When using `--generate`, prose is regenerated and the cache is written after
generation completes. To do a full regeneration, delete the cache file first and
run with `--generate`.

---

## Dataset Blocks

See [`references/datasets.md`](references/datasets.md) for external tool
requirements.

---

## Environment

Generation requires `LLM_TOKEN` and `LLM_BASE_URL` when using `--generate` mode.
Set these environment variables before running:

```sh
LLM_TOKEN=<your-token> LLM_BASE_URL=<endpoint> npx fit-terrain --generate
```

The default cached mode requires no LLM credentials.

---

## Logging

Set `DEBUG=terrain` for verbose debug output during generation. Operational
progress is logged to stderr via libtelemetry Logger (RFC 5424 format with
timestamps). Stdout is reserved for file counts, validation results, and prose
cache statistics.

---

## Feeding Generated Content to Guide

After generation, bootstrap the full Guide pipeline:

```sh
npx fit-process-resources   # Create resource index from knowledge files
npx fit-process-graphs      # Build RDF graph from resources
npx fit-process-vectors     # Generate vector embeddings (requires TEI)
npx fit-rc start            # Start services
npx fit-guide               # Verify end-to-end
```

## Verification

After generation, the CLI runs cross-content validation automatically and
reports pass/fail for each check. Validate the generated pathway data
separately:

```sh
npx fit-map validate
```

## Documentation

For deeper context beyond this skill's scope:

- [Terrain Internals](https://www.forwardimpact.team/docs/internals/terrain/index.md)
  — Synthetic data pipeline architecture, DSL parsing, entity generation, prose
  engine, and rendering

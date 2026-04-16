---
name: fit-terrain
description: >
  Generate synthetic data for development, testing, and demos. Use when
  creating example framework definitions, organizational documents, activity
  records, or knowledge base content from a terrain DSL file, or when
  testing pipeline changes end-to-end with synthetic datasets.
---

# fit-terrain CLI

Generate synthetic data for the entire Forward Impact suite from a single DSL
file. The CLI orchestrates parsing, entity generation, optional LLM prose, and
rendering into multiple output formats.

## When to Use

- Generating example data for development or testing
- Creating synthetic pathway frameworks for new installations
- Producing organizational documents, activity records, and KB content
- Bootstrapping a realistic environment for product evaluation or demos
- Testing pipeline changes end-to-end
- Writing or editing terrain DSL files

---

## How It Works

### Pipeline

Generation flows through four stages:

1. **DSL parsing** — the terrain file is tokenized and parsed into an AST
   containing organizational hierarchy, people, projects, framework definitions,
   and content specifications
2. **Entity generation** — the AST is expanded deterministically (using a seeded
   RNG) into a full entity graph: orgs, departments, teams, people with roles
   and skill assignments, repos, and projects
3. **Prose generation** — prose keys are collected from the entity graph (one
   per article, FAQ, briefing, etc.) with context (topic, tone, length). By
   default these are read from `prose-cache.json`; with `--generate` each key is
   sent to an LLM and the result saved to the cache; with `--no-prose` this
   stage is skipped entirely
4. **Rendering** — entities and prose are rendered into output formats: YAML
   framework files (`pathway`), HTML articles (`html`), JSON/YAML activity
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

Structured pathway entities (framework, levels, behaviours, capabilities, etc.)
use a stable cache key derived from the entity key alone (e.g.
`pathway:track:platform`). This means prompt changes (such as adding context
forwarding or updating preambles) do not invalidate existing cache entries — use
`--generate` to regenerate with updated prompts.

General prose entries (articles, comments, briefings) use a cache key that
includes the content context (topic, tone, length).

### Output Cleanup

The CLI cleans output directories before writing new files, preventing stale
files from prior runs from persisting. This means each run produces a clean,
complete output set.

---

## CLI Reference

```sh
npx fit-terrain                     # Use cached prose (default, repeatable)
npx fit-terrain --generate          # Generate prose via LLM (requires LLM_TOKEN)
npx fit-terrain --no-prose          # Structural scaffolding only (no prose at all)
npx fit-terrain --strict            # Fail on cache miss (with default cached mode)
npx fit-terrain --load              # Load raw docs to Supabase Storage
npx fit-terrain --only=pathway      # Render only one content type
npx fit-terrain --dry-run           # Show what would be written
npx fit-terrain --story=path        # Custom story DSL file
npx fit-terrain --cache=path        # Custom prose cache file
```

### Content Types

Use `--only=<type>` to generate a single content type:

| Type       | Output Directory | Contents                        |
| ---------- | ---------------- | ------------------------------- |
| `html`     | `data/knowledge` | Articles, guides, FAQs, courses |
| `pathway`  | `data/pathway`   | YAML framework files            |
| `raw`      | `data/activity`  | Roster, GitHub events, evidence |
| `markdown` | `data/personal`  | Briefings, notes, KB content    |

### Prose Modes

| Mode       | Flag         | Description                                  |
| ---------- | ------------ | -------------------------------------------- |
| `cached`   | _(default)_  | Read from `prose-cache.json` (no LLM needed) |
| `generate` | `--generate` | Call LLM, write new entries to cache         |
| `no-prose` | `--no-prose` | Structural scaffolding only, no prose at all |

---

## Terrain DSL

Terrain files define a complete synthetic environment. This monorepo's terrain
DSL is at `data/synthetic/story.dsl`. A minimal reference DSL ships with
libsyntheticgen at `libraries/libsyntheticgen/data/default.dsl` for quick
testing; projects provide their own DSL file.

### Top-Level Blocks

```dsl
terrain Name {
  domain "example.dev"
  industry "technology"
  seed 42

  org hq { ... }
  department engineering { ... }
  team backend { ... }
  people { ... }
  project alpha { ... }
  snapshots { ... }
  scenario launch_push { ... }
  framework { ... }
  content guide_html { ... }
  content basecamp_markdown { ... }
}
```

### Key Blocks

**org / department / team** — Organizational hierarchy with headcounts,
managers, and repo assignments.

**people** — Count, name theme, level distribution, discipline distribution.

**project** — Cross-team initiatives with timelines and prose topics.

**snapshots** — GetDX snapshot generation (quarterly intervals).

**scenario** — Time-bounded effects on teams (commit volume, DX driver
trajectories, evidence generation).

**framework** — Full pathway framework: levels, capabilities with skills,
behaviours, disciplines with skill tiers, tracks, drivers, and stages.

**content** — Output content blocks specifying article/blog/FAQ counts, persona
configurations, and briefing counts.

---

## Data Resolution

Use `--story=path` to specify a custom terrain DSL file. Without `--story`, the
CLI falls back to the minimal reference DSL bundled with the package.

Generated output writes to `data/` directories in the current working directory:

| Type       | Output Directory |
| ---------- | ---------------- |
| `html`     | `data/knowledge` |
| `pathway`  | `data/pathway`   |
| `raw`      | `data/activity`  |
| `markdown` | `data/personal`  |

---

## Prose Cache

The prose cache is stored at `data/synthetic/prose-cache.json`. This file is
pre-populated for the BioNova terrain. The default mode reads from it without
LLM calls.

When using `--generate`, prose is regenerated and the cache is written after
generation completes. To do a full regeneration, delete the cache file first and
run with `--generate`.

To regenerate all prose, delete the cache file and run with `--generate`.

---

## Dataset Blocks

The terrain DSL may include `dataset` and `output` blocks that use external
tools (Synthea, SDV, Faker). Unavailable tools are automatically skipped with an
info log — the pipeline continues and writes all other generated files normally.

Tool availability:

| Tool    | Requirement         | Always available? |
| ------- | ------------------- | ----------------- |
| Faker   | Built-in (pure JS)  | Yes               |
| Synthea | Java + JAR file     | No                |
| SDV     | Python + sdv module | No                |

**Note:** The `--only` flag gates which render types execute (html, pathway,
raw, markdown). It does **not** affect dataset generation — datasets run when
present in the DSL but skip gracefully if the tool is unavailable.

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

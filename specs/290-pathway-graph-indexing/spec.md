# 290: Export Framework Data as HTML Microdata from Map

## Problem

When a user asks fit-guide about the engineering framework — skills,
capabilities, levels, behaviours — the agent returns sparse or empty results.
Graph queries like `get_subjects("fit:Skill")` return nothing because pathway
framework data never enters the RDF graph.

The knowledge pipeline has one working flow and one gap:

1. **HTML knowledge flow** (working): `data/knowledge/*.html` → resource
   processor (microdata extraction) → `data/resources/` → graph processor →
   `data/graphs/` (RDF quads). Agents can query articles, courses, and org
   content successfully.

2. **Framework data** (gap): `data/pathway/*.yaml` is loaded by fit-map for
   validation and by libskill for derivation, but it never enters the knowledge
   pipeline. No HTML representation exists, so the resource processor has
   nothing to extract.

The RDF schemas already exist (`products/map/schema/rdf/` — `capability.ttl`,
`defs.ttl`, `discipline.ttl`, `levels.ttl`, etc.) but are only used for SHACL
validation, never for instance generation.

### Evidence

Running fit-guide after a full `just quickstart`:

```
> "What skills are defined in the engineering framework?"
→ "No explicit skills were defined or linked to the engineering framework"
→ "The ontology does not include a schema:Skill type"

> "What does a senior software engineer need to demonstrate at L3?"
→ "No specific details about what a senior software engineer needs to
    demonstrate at this level were retrieved"
```

Meanwhile, content queries work fine:

```
> "Tell me about drug discovery processes"
→ [comprehensive 6-section answer with projects, leadership, platforms]
```

## Design Rationale

Map is the data product — it owns the framework data, the YAML schema, and the
RDF/SHACL definitions. Exporting framework data for downstream consumption is
Map's responsibility, not the knowledge pipeline's.

The existing knowledge pipeline already handles HTML with microdata. Rather than
building a separate pathway-to-RDF converter, Map should export framework
entities as HTML files with embedded microdata — the same format the resource
processor already consumes. This keeps Map as the single owner of how framework
data is represented and avoids adding framework-specific logic to the resource
processor or graph processor.

The export uses `libtemplate` to render Mustache templates — one template per
entity type. Templates live in `products/map/templates/` and produce HTML with
microdata attributes (`itemscope`, `itemtype`, `itemprop`, `itemid`) using the
vocabulary defined in `products/map/schema/rdf/`.

## Scope

Add a `fit-map export` command that reads `data/pathway/` YAML, renders HTML
microdata files via templates, and writes them to `data/knowledge/`. The
existing resource processor then picks them up alongside all other HTML content.

### Included

- New `fit-map export` CLI command that loads framework data and renders HTML
  microdata files to `data/knowledge/`
- Mustache templates in `products/map/templates/` — one per entity type:
  capability (with nested skills), level, behaviour, discipline, track, stage,
  driver
- Templates use the `fit:` vocabulary from `products/map/schema/rdf/` for
  `itemtype` and `itemprop` values
- New `just export-framework` recipe that runs `fit-map export`
- Integration into `just process` and `just process-fast` pipelines (before
  `process-resources`)
- `just quickstart` includes the new step

### Not Included

- Changes to the resource processor — it already extracts microdata from any
  HTML file in `data/knowledge/`
- Changes to the graph processor — it already indexes any resource with RDF
  content
- Changes to agent prompts — agents already have instructions to query for
  skills and capabilities
- New query types or tools — existing `get_subjects`, `query_by_pattern`, and
  `get_ontology` should surface the new data

## Success Criteria

After running the full pipeline (`just quickstart` or `just process`):

1. `fit-map export` produces HTML files in `data/knowledge/` with valid
   microdata for each framework entity type
2. `just cli-subjects` lists `fit:Skill`, `fit:Capability`, `fit:Level`,
   `fit:Behaviour`, and `fit:Discipline` types
3. `ARGS="fit:Skill" just cli-subjects` returns all skills defined in pathway
   YAML
4. fit-guide answers "What skills are defined in the engineering framework?"
   with a list of actual skill names from the data
5. fit-guide answers "What does L3 require?" with specific proficiency and
   maturity expectations

# 290: Index Pathway Framework Data into the Knowledge Graph

## Problem

When a user asks fit-guide about the engineering framework — skills,
capabilities, levels, behaviours — the agent returns sparse or empty results.
Graph queries like `get_subjects("fit:Skill")` return nothing because pathway
framework data never enters the RDF graph.

The knowledge pipeline has two disconnected systems:

1. **HTML knowledge flow** (working): `data/knowledge/*.html` → resource
   processor (microdata extraction) → `data/resources/` → graph processor →
   `data/graphs/` (RDF quads). Agents can query articles, courses, and org
   content successfully.

2. **Pathway framework flow** (broken): `data/pathway/*.yaml` is loaded by
   fit-map for validation and by libskill for derivation, but **no code converts
   it to resources or RDF**. The pipeline stops at YAML.

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

## Scope

Add a processing step that converts pathway YAML data into resources with RDF
content, so the existing graph processor indexes them alongside HTML-derived
resources.

### Included

- New `just process-pathway` recipe that converts `data/pathway/` YAML into
  resources stored in `data/resources/`
- Resources use the existing RDF schemas from `products/map/schema/rdf/` to
  produce valid Turtle content
- Entities to index: capabilities (with skills), levels, behaviours,
  disciplines, tracks, stages, drivers
- Integration into `just process` and `just process-fast` pipelines
- `just quickstart` includes the new step

### Not Included

- Changes to the graph processor itself — it already indexes any resource with
  RDF content
- Changes to agent prompts — agents already have instructions to query for
  skills and capabilities
- New query types or tools — existing `get_subjects`, `query_by_pattern`, and
  `get_ontology` should surface the new data

## Success Criteria

After running the full pipeline (`just quickstart` or `just process`):

1. `just cli-subjects` lists `fit:Skill`, `fit:Capability`, `fit:Level`,
   `fit:Behaviour`, and `fit:Discipline` types
2. `ARGS="fit:Skill" just cli-subjects` returns all skills defined in pathway
   YAML
3. fit-guide answers "What skills are defined in the engineering framework?"
   with a list of actual skill names from the data
4. fit-guide answers "What does L3 require?" with specific proficiency and
   maturity expectations

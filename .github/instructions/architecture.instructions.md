---
applyTo: "**"
---

# Architecture

## Monorepo Packages

```
apps/
  schema/       @forwardimpact/schema   Schema, validation, data loading
  model/        @forwardimpact/model    Business logic, derivation
  pathway/      @forwardimpact/pathway  Web app, CLI, formatters
```

| Package                  | CLI           | Purpose                             |
| ------------------------ | ------------- | ----------------------------------- |
| `@forwardimpact/schema`  | `fit-schema`  | Schema validation, index generation |
| `@forwardimpact/model`   | —             | Derivation logic, job/agent models  |
| `@forwardimpact/pathway` | `fit-pathway` | Web app, CLI commands, formatters   |

## 3-Layer System

1. **Model** (`apps/model/lib/`) — Pure business logic, derivation
2. **Formatter** (`apps/pathway/src/formatters/`) — Entity + context → output
3. **View** (`apps/pathway/src/pages/`, `src/commands/`, `src/slides/`) — Routes

## Data and Schema

Data lives in YAML files. Schema definitions validate and describe the data:

- `apps/schema/examples/` — Example data files (canonical reference)
- `apps/schema/schema/json/` — JSON Schema for validating YAML
- `apps/schema/schema/rdf/` — RDF/SHACL ontology for semantic representation

See `domain-concepts.instructions.md` for entity descriptions and relationships.

## Schema Package (`@forwardimpact/schema`)

```
apps/schema/
  lib/
    loader.js           # Load and parse YAML data files
    validation.js       # Data validation logic
    schema-validation.js # JSON Schema validation
    index-generator.js  # Generate _index.yaml for browser
    levels.js           # Skill levels, behaviour maturities
  schema/
    json/               # JSON Schema definitions
    rdf/                # RDF/SHACL ontology
  examples/             # Canonical example data
```

**CLI**: `npx fit-schema <command>`

- `validate` — Run full data validation
- `generate-index` — Generate browser index files
- `validate:shacl` — Validate SHACL ontology

## Model Package (`@forwardimpact/model`)

```
apps/model/lib/
  derivation.js   # Core: deriveSkillMatrix, deriveBehaviourProfile, deriveJob
  modifiers.js    # Skill modifier resolution
  profile.js      # Post-processing: filtering, sorting for agents
  job.js          # Job preparation for display
  job-cache.js    # Job caching for pages
  agent.js        # Agent profile/skill generation
  checklist.js    # Stage transition checklists
  interview.js    # Interview question selection
  matching.js     # Job matching logic
  progression.js  # Career progression analysis
```

**Key distinction**: `derivation.js` provides core logic for all consumers.
`profile.js` adds agent-specific filtering (exclude `isHumanOnly`, keep highest
level only) and sorting.

## Pathway Package (`@forwardimpact/pathway`)

```
apps/pathway/
  bin/
    fit-pathway.js    # CLI entry point
  src/
    commands/         # CLI command handlers
    formatters/       # Entity → output (DOM/markdown)
    pages/            # Web app page handlers
    components/       # Reusable UI components
    lib/              # Shared utilities (router, state, render)
    css/              # Styles (layers, tokens, components)
    slides/           # Slide presentation handlers
  templates/          # Mustache templates for agent/skill output
```

**CLI**: `npx fit-pathway <command>`

## Job Derivation

Jobs are derived from `Discipline × Grade × Track?`:

1. Base skill levels from grade (by skill type: primary/secondary/broad)
2. Track modifiers applied to capabilities (+1, 0, -1)
3. Behaviour modifiers combined from discipline and track
4. Responsibilities selected by discipline type (professional/management)

```javascript
import { getOrCreateJob } from "@forwardimpact/model/job-cache";
const job = getOrCreateJob({ discipline, grade, track, skills, behaviours });
```

## Agent Profiles

Agent profiles follow the **VS Code Custom Agents** standard (`.agent.md`
files). Generated from `Discipline × Track × Stage` using the same derivation
logic as jobs.

**Output location**: `.github/agents/{id}.agent.md`

Profile includes:

- **Frontmatter**: name, description, tools, handoffs, infer
- **Core identity**: From discipline/track `agent.coreInstructions`
- **Capabilities**: Derived from skill matrix (filtered, sorted by level)
- **Stage context**: Tools, constraints, entry/exit criteria
- **Working style**: From behaviour `agent.workflow` sections
- **Delegation**: Subagent guidance
- **Constraints**: Combined from discipline, track, stage

See
[templates/agent.template.md](../../apps/pathway/templates/agent.template.md).

## Agent Skills

Agent skills follow the **SKILL.md** standard (Claude Code compatible). Each
skill with an `agent:` section generates a skill file.

**Output location**: `.claude/skills/{skill-name}/SKILL.md`

Skill file includes:

- **Frontmatter**: name, description (triggering conditions)
- **useWhen**: When to apply this skill
- **Stage guidance**: Activities and readiness checklists per stage (`specify`,
  `plan`, `code`, `review`, `deploy`)
- **Reference**: Implementation patterns from `implementationReference`

See
[templates/skill.template.md](../../apps/pathway/templates/skill.template.md).

## Tools (Derived Entity)

Tools are aggregated from `toolReferences` arrays within skills—not stored as
separate YAML files. The `tool` command extracts and deduplicates tools across
all skills.

**Formatter**: `apps/pathway/src/formatters/tool/shared.js` provides
`aggregateTools()` and `prepareToolsList()` for CLI and web output.

## Formatter Layer

Single place for all presentation logic:

```
apps/pathway/src/formatters/{entity}/
  shared.js    # Helpers shared between outputs
  dom.js       # Entity → DOM elements
  markdown.js  # Entity → markdown string
```

**Rule**: Pages/commands pass raw entities to formatters—no transforms in views.

## Key Patterns

```javascript
// Builder pages (discipline/grade/track selector)
import { createBuilder } from "../components/builder.js";

// Reactive state (component-local)
import { createReactive } from "../lib/reactive.js";
const state = createReactive(initial);
state.subscribe((value) => updateUI(value));

// DOM rendering (no innerHTML)
import { div, h2, p, render } from "./lib/render.js";

// Global state
import { getState, setData, subscribe } from "./lib/state.js";
```

## Error Handling

Router wraps all pages with error boundary. Pages throw `NotFoundError` or
`InvalidCombinationError` as needed.

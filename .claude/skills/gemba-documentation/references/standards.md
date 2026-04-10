# Documentation Standards

## Information Architecture

The documentation is a four-tier hierarchy serving three user groups
(Leadership, Engineers, Contributors):

```
website/docs/
  getting-started/           "I'm new, get me going fast"
    leadership/              Author your first framework
    engineers/               Install tools and agent teams
    contributors/            Set up the development environment
  guides/                    "I have a specific task to accomplish"
    authoring-frameworks/    YAML structure, entities, validation
    agent-teams/             Generate and install agent teams
    career-paths/            Browse jobs, skills, progression
    knowledge-systems/       Basecamp setup, scheduler, KB structure
    engineering-signals/     Landmark views, GetDX, GitHub integration (planned)
    team-capability/         Summit team modeling
    finding-your-bearing/    Guide usage and configuration
  reference/                 "I need to look something up"
    cli/                     CLI commands for all products
    model/                   Entity reference (disciplines, levels, tracks, etc.)
    lifecycle/               Stages, handoffs, checklists
    yaml-schema/             YAML file format, links to /schema/json/ and /schema/rdf/
  internals/                 "I need to understand how this is built"
    map/                     Data product architecture, layering, queries
    pathway/                 Formatter pattern, module structure, templates
    libskill/                Derivation engine, policies, caching
    basecamp/                Scheduler architecture, state management
    guide/                   Agent infrastructure, artifact interpretation
    landmark/                Analysis pipeline, view composition (planned)
    summit/                  Capability aggregation, scenario modeling
    universe/                Synthetic data pipeline, DSL, prose engine
    operations/              Environment, services, and common tasks
```

## Audience Rules

Every sentence belongs to exactly one audience. Apply these rules strictly:

| Content type                                                  | Audience              | Section                 |
| ------------------------------------------------------------- | --------------------- | ----------------------- |
| How to accomplish a task with the products                    | Leadership, Engineers | Getting Started, Guides |
| Entity definitions, CLI synopsis, YAML format                 | All users             | Reference               |
| Module structures, code imports, class names, `src/` paths    | Contributors          | Internals               |
| Internal architecture, data flow diagrams, formatter patterns | Contributors          | Internals               |

**Never mix audiences on the same page.** If a page mentions both CLI usage and
module internals, split it. User-facing pages (Getting Started, Guides,
Reference) must never reference source file paths, class names, or import
statements.

## Writing Principles

### Guides are task-oriented, not product-oriented

A guide answers "how do I do X?" not "what does product Y contain?" Guides pull
from multiple products when that matches the actual workflow. For example,
"Authoring Frameworks" covers Map (YAML format, validation), Core Model (entity
relationships), and Pathway (previewing results) — because that is the real
authoring workflow.

### Reference is lookup, not tutorial

The CLI reference lists every command with arguments, options, and a brief
example. The model reference defines every entity. The YAML schema reference
shows the exact format for every file type. No prose narrative — structured,
scannable information.

### Internals are clearly separated

Module structures, formatter patterns, code imports, query functions, and
architectural decisions live in Internals. This content is valuable but must
never interrupt users trying to accomplish a task.

### Link to existing artifacts, don't duplicate

- JSON Schema files are published at `/schema/json/`. Link to them from the YAML
  schema reference — don't reproduce their content.
- RDF/SHACL files are published at `/schema/rdf/`.
- Published SKILL.md files link to Guides and Reference markdown companions for
  progressive disclosure. Don't duplicate documentation content in skills or
  vice versa.

### Published skills use absolute URLs

Published skills (`fit-*` in `.claude/skills/`) are installed on external
systems where the documentation is not available locally. Documentation links in
these skills **must** use absolute URLs with the full domain:

```markdown
<!-- Correct — works on any installation -->
- [Guide](https://www.forwardimpact.team/docs/guides/authoring-frameworks/index.md)

<!-- Wrong — breaks on external installations -->
- [Guide](/docs/guides/authoring-frameworks/index.md)
```

Internal skills (library groups, `gemba-*`, etc.) may use repo-relative paths
since they only run inside the monorepo.

### Guides and Reference produce stable, agent-fetchable URLs

Every page in Guides and Reference gets a markdown companion (generated by
`libdoc`) at a predictable URL. These are the progressive-disclosure targets
that published skills link to. Content at these URLs must make sense to an agent
with no monorepo context — it explains how the product works, not how the code
is structured.

## Formatting Consistency

When the same concept appears in multiple pages, formatting and terminology must
be identical. Inconsistency erodes trust and confuses both human readers and
agents.

### Tables that repeat across pages

The proficiency scale and behaviour maturity scale appear in multiple guides.
When the same table appears in more than one page, column values must match
exactly — same casing, same punctuation, same wording. The canonical tables live
in the Authoring Frameworks guide. Other guides that reproduce them must match.

### Field names vs concept names

The framework uses two naming layers that must not be conflated:

| Layer               | Names                                           | Where used                              |
| ------------------- | ----------------------------------------------- | --------------------------------------- |
| Discipline tiers    | `coreSkills`, `supportingSkills`, `broadSkills` | Discipline YAML files                   |
| Level proficiencies | `primary`, `secondary`, `broad`                 | `baseSkillProficiencies` in levels.yaml |

`primary` maps to `coreSkills`, `secondary` to `supportingSkills`, `broad` to
`broadSkills`. When documenting levels, use the field names (`primary`,
`secondary`, `broad`). When documenting disciplines, use the tier names
(`coreSkills`, `supportingSkills`, `broadSkills`). When explaining the
relationship, state the mapping explicitly.

### Required/optional field lists

When a guide lists required and optional fields for an entity, verify against
the JSON schema in `products/map/schema/json/`. The schema's `required` array is
the single source of truth — do not guess from examples or convention.

### Casing conventions

- Table cell values: lowercase unless they are proper nouns or start a sentence
- Proficiency levels: always lowercase (`awareness`, not `Awareness`)
- Behaviour maturities: always lowercase with underscores (`role_modeling`)
- Entity field names: always in backticks (`\`baseSkillProficiencies\``)

## Repository Documentation

The documentation lives in two layers: repository-root files and the website.

**Root documents** (checked into the repo root):

| File              | Purpose                                         | Audience         |
| ----------------- | ----------------------------------------------- | ---------------- |
| `CLAUDE.md`       | Architecture context for coding agents          | Agents           |
| `CONTRIBUTING.md` | PR workflow, git conventions, quality, security | All contributors |
| `SECURITY.md`     | Vulnerability reporting                         | All contributors |

**Website documentation** (`website/docs/`):

The four-tier hierarchy described above. Contributor-facing reference material
(environment, services, tasks) lives at `docs/internals/operations/` — extracted
from CONTRIBUTING.md to keep the workflow focused.

**Relationship between the layers:**

- CONTRIBUTING.md is the canonical source for PR workflow and policies.
  `CLAUDE.md` references it rather than duplicating workflow rules.
- `website/docs/getting-started/contributors/` provides an onboarding narrative
  that links to CONTRIBUTING.md for the full guide.
- `website/docs/internals/operations/` holds operational reference (environment,
  config, services, tasks) that supports CONTRIBUTING.md without cluttering it.

## Layouts

| Layout    | Use for                                                                             |
| --------- | ----------------------------------------------------------------------------------- |
| `product` | Section index pages (Getting Started, Guides, Reference, Internals) — grid of cards |
| _(none)_  | Leaf pages — prose with table of contents                                           |

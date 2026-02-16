---
title: Schema
description: Map your engineering terrain — define the skills, behaviours, and career levels that matter to your organization.
---

<div class="page-header">
<img src="/assets/icons/schema.svg" alt="Schema" />

## Map Your Terrain

</div>

<div class="product-value">
<p>
Before you can chart a career path or deploy an agent team, you need to define
the landscape. Schema lets you describe your engineering competencies — skills,
behaviours, grades, disciplines, and tracks — in plain YAML files that humans
can read and machines can validate.
</p>
</div>

### What you get

<ul class="benefits">
<li>A complete vocabulary of engineering skills with five progression levels</li>
<li>Behaviour definitions that describe how engineers approach their work</li>
<li>Career grades from junior through principal, with clear expectations</li>
<li>Discipline definitions that shape T-shaped skill profiles</li>
<li>Tracks that modify expectations for different work contexts</li>
<li>Automatic validation ensuring everything references correctly</li>
</ul>

### Who it's for

**Engineering leaders** who want to codify what "good" looks like across their
organization. Define it once in YAML, and the rest of the system — job
descriptions, agent profiles, interview questions — derives from it
automatically.

**Platform teams** building internal developer tools. Schema provides the
structured data foundation that other apps consume.

---

## Quick Start

Validate your data to make sure everything is connected:

```sh
npx fit-schema validate
```

Browse what's defined:

```sh
npx fit-pathway skill --list       # All skills
npx fit-pathway discipline --list  # Engineering specialties
npx fit-pathway grade --list       # Career levels
```

---

## How Data is Organized

All definitions live in YAML files under your data directory:

```
data/
├── grades.yaml           # Career levels (L1–L5)
├── stages.yaml           # Engineering lifecycle phases
├── drivers.yaml          # Organizational outcomes
├── disciplines/          # Engineering specialties
├── tracks/               # Work context modifiers
├── behaviours/           # Approaches to work
├── capabilities/         # Skill groups with responsibilities
└── questions/            # Interview questions
```

Every entity supports both human and agent perspectives in the same file — a
skill definition includes human-readable level descriptions alongside
agent-specific instructions for AI coding assistants.

---

## Technical Reference

### Validation

Schema validates referential integrity, required fields, valid enum values, and
cross-entity consistency:

```sh
npx fit-schema validate          # Full validation
npx fit-schema validate --shacl  # RDF/SHACL validation
npx fit-schema generate-index    # Generate browser indexes
```

### Programmatic Access

```javascript
import { loadAllData } from "@forwardimpact/schema";
import { validateAll } from "@forwardimpact/schema/validation";
import { SKILL_LEVELS, BEHAVIOUR_MATURITIES } from "@forwardimpact/schema/levels";

const data = await loadAllData("./data");
```

### Schema Formats

Definitions are available in two schema formats, always kept in sync:

- **JSON Schema** (`schema/json/`) — For YAML validation tooling
- **RDF/SHACL** (`schema/rdf/`) — For linked data interoperability

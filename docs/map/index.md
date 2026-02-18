---
title: Map
description: Chart the territory — define the skills, behaviours, and career levels that matter to your engineering organization.
layout: product
toc: false
hero:
  image: /assets/heros/map.svg
  alt: An engineer, an AI robot, and a business professional kneel around a large unfolded map, tracing routes together
  subtitle: Chart the territory before you move through it. Map lets you describe your engineering competencies — skills, behaviours, grades, disciplines, and tracks — in plain YAML files that humans can read and machines can validate.
  cta:
    - label: Documentation
      href: /docs/map/
    - label: View on npm
      href: https://www.npmjs.com/package/@forwardimpact/map
      secondary: true
---

> Before you can chart a career path or deploy an agent team, you need to define
> the landscape. Map is the foundational data model — the engineering skills
> taxonomy that everything else references. Define it once in YAML, and the rest
> of the system derives from it automatically.

### What you get

- A complete vocabulary of engineering skills with five progression levels
- Behaviour definitions that describe how engineers approach their work
- Career grades from junior through principal, with clear expectations
- Discipline definitions that shape T-shaped skill profiles
- Tracks that modify expectations for different work contexts
- Automatic validation ensuring everything references correctly
- Dual-format schemas — JSON Schema for tooling, RDF/SHACL for linked data

---

### Who it's for

**Engineering leaders** who want to codify what "good" looks like across their
organization. Define it once in YAML, and the rest of the system — job
descriptions, agent profiles, interview questions — derives from it.

**Platform teams** building internal developer tools. Map provides the
structured data foundation that other apps consume.

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

## Quick Start

Validate your data to make sure everything is connected:

```sh
npx fit-map validate
```

Browse what's defined:

```sh
npx fit-pathway skill --list       # All skills
npx fit-pathway discipline --list  # Engineering specialties
npx fit-pathway grade --list       # Career levels
```

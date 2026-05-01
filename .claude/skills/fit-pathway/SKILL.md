---
name: fit-pathway
description: >
  Explore roles, skills, career progression, and agent profiles. Use when
  looking up role expectations by discipline, track, and level, generating
  or comparing job definitions, analyzing career progression gaps, creating
  agent configurations, building a static agent-aligned engineering standard site, or selecting
  interview questions.
---

# Pathway Package

Web application, CLI, and formatters for career progression, job definitions,
and agent profile generation. Two audiences use `fit-pathway` differently:

| Audience          | Goal                                                             | How they run it                                 |
| ----------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| **Organizations** | Publish a agent-aligned engineering standard for their engineers | `npx fit-pathway build` in a standalone project |
| **Engineers**     | Explore jobs, skills, and career progression                     | `npx fit-pathway` installed in their project    |

## When to Use

**CLI exploration and discovery:**

- Exploring disciplines, tracks, levels, skills, behaviours, or drivers
- Generating or comparing job definitions across tracks and levels
- Understanding the proficiency and autonomy expected at each level
- Analyzing career progression gaps between current and target levels
- Generating AI agent configurations from the agent-aligned engineering standard
- Answering questions about roles, skill expectations, or career paths

**Standard setup and publishing:**

- Setting up an organization's agent-aligned engineering standard project
- Building a static site for the agent-aligned engineering standard
- Running a local development server to preview changes

---

## How It Works

### Job Derivation

A job is derived in real-time from three inputs: **discipline**, **level**, and
optionally **track**. For each skill in the discipline:

1. The skill's tier in the discipline — core, supporting, or broad
2. The level's base proficiency for that tier sets the starting point (e.g.
   "foundational" for core skills at J060)
3. Track modifiers shift proficiency up or down **per capability** — a platform
   track with `scale: +1` raises all skills in the scale capability by one
   level, while `delivery: -1` lowers delivery skills
4. Positive modifiers are capped at the level's maximum base proficiency;
   results are clamped to the valid range (awareness → expert)

Behaviours follow the same pattern: base maturity from the level, then
discipline and track modifiers stacked and clamped.

Skills from capabilities the track modifies positively — but that aren't in the
base discipline — are added as broad-type "track-added" skills.

### Agent Derivation

Agent profiles reuse job derivation with three additions:

1. **Reference level** is auto-selected — the first level where core skills
   reach "practitioner", falling back to "working", then the middle level
2. **Skill filtering** removes `isHumanOnly` skills (physical presence,
   emotional judgment)
3. **Skill focusing** limits the matrix to the most relevant skills per stage,
   sorted by tier (core → supporting → broad → track-added)

Working styles are derived from the top behaviours by maturity — behaviours with
positive track modifiers become personality traits that shape the agent's
approach.

### Tool Derivation

Tools come from `toolReferences` in skill definitions. Derivation collects all
tool references from the job's highest-proficiency skills, deduplicates by name,
and sorts alphabetically. Each tool tracks which skills reference it.

### Interview Questions

Questions are selected from question banks organized by skill/behaviour ID, role
type, and proficiency/maturity. Three interview types exist: mission fit (skill
questions), decomposition (capability questions), and stakeholder simulation
(behaviour questions). Selection prioritizes by skill type and fills a time
budget.

### Career Progression

Progression compares two job derivations (current vs target level) and
calculates deltas — skill proficiency changes, gained/lost skills, and behaviour
maturity changes.

---

## Discovery Workflows

See [`references/workflows.md`](references/workflows.md) for exploration
patterns and worked examples.

---

## CLI Reference

See [`references/cli.md`](references/cli.md) for full command listings.

---

## Data Resolution

The CLI resolves the data directory in this order:

1. `--data=<path>` flag (explicit override)
2. Upward traversal from CWD — looks for `data/` (up to 3 parents)
3. `~/.fit/data/` (user-global fallback)

Use `npx fit-map init` to create a local `./data/` directory with starter
standard data to get started.

---

## Verification

```sh
npx fit-map validate    # Validate data files after changes
npx fit-pathway dev     # Preview changes in browser
```

## Documentation

**Before editing YAML standard data**, read the relevant guide — they contain
detailed examples, field references, and best-practice patterns essential for
high-quality output.

- [Authoring Agent-Aligned Engineering Standards](https://www.forwardimpact.team/docs/products/authoring-standards/index.md)
  — How to write the YAML data: disciplines, levels, tracks, capabilities,
  skills, behaviours, stages, drivers. Includes proficiency vocabulary
  standards, co-located human/agent content patterns, checklist quality rules,
  and validation workflows
- [Agent Teams Guide](https://www.forwardimpact.team/docs/products/agent-teams/index.md)
  — How to generate, structure, and maintain exported agent teams. Covers the
  three-layer architecture (CLAUDE.md → agent profiles → skills), information
  flow rules, anti-patterns to avoid, and the maintenance checklist for
  reviewing exported output
- [Career Paths Guide](https://www.forwardimpact.team/docs/products/career-paths/index.md)
  — Browse jobs, skills, and career progression between levels

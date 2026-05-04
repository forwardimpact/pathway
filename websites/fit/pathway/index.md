---
title: Pathway
description: See what's expected at every level — generate job definitions, career paths, and agent profiles from one shared engineering standard.
layout: product
toc: false
hero:
  image: /assets/scene-pathway.svg
  alt: An engineer, an AI robot, and a business professional stand at the base of mountains, studying the trail ahead
  subtitle: Navigate the trail. Pathway makes expectations visible — feed it a discipline, track, and level and it produces a complete job definition. Drop the level and you get an agent profile instead. Same standard, different outputs.
  cta:
    - label: View on GitHub
      href: https://github.com/forwardimpact/monorepo/tree/main/products/pathway
    - label: View on npm
      href: https://www.npmjs.com/package/@forwardimpact/pathway
      secondary: true
---

An engineer starts a new role and discovers that 'meets expectations' on the
review form has no definition anyone can point to. An agent delivers work the
team rejects because it followed generic best practices instead of the
organization's actual standards. Pathway resolves both — one shared standard
that produces definitions for humans and agents alike.

## What becomes possible

### For Engineering Leaders

Define roles precisely enough that hiring decisions and evaluations feel
consistent, not arbitrary. Staff teams knowing exactly what each role requires
rather than relying on intuition.

- Complete job definitions from discipline + track + level
- Interview question sets grounded in actual skill expectations
- A static site export for publishing the standard organization-wide

### For Empowered Engineers

See exactly what's expected at your level, what changes at the next level, and
configure agents to meet the same expectations the organization holds for human
contributors — without writing bespoke prompts for every task.

- An interactive career browser showing skills and level progression
- Agent profiles and skill files derived from organizational standards
- Side-by-side level comparisons to identify growth areas

---

## The Web Application

- **Explore roles** — Select discipline, track, and level to see complete role
  definitions with skill matrices and behaviour profiles
- **Browse skills** — View all skills with detailed level descriptions
- **Compare levels** — See what changes between levels side by side
- **Prepare interviews** — Generate role-specific question sets for hiring
- **Preview agent profiles** — See exactly what agent configuration looks like
  before deploying

---

## Getting Started

```sh
npm install @forwardimpact/pathway
npx fit-pathway dev                                       # Launch web app
npx fit-pathway job software_engineering J060 --track=platform  # Job definition
```

<div class="grid">

<!-- part:card:../docs/getting-started/leadership/pathway -->

<!-- part:card:../docs/getting-started/engineers/pathway -->

</div>

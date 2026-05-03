---
title: Pathway
description: Navigate engineering skills and careers with clarity — browse career paths, generate agent teams, build progression plans.
layout: product
toc: false
hero:
  image: /assets/scene-pathway.svg
  alt: An engineer, an AI robot, and a business professional stand at the base of mountains, studying the trail ahead
  subtitle: Navigate engineering skills and careers with clarity. Whether you're an engineer exploring career progression, a manager building job descriptions, or a team lead deploying AI coding agents — Pathway delivers it through a web app, a CLI, and a static site generator.
  cta:
    - label: View on GitHub
      href: https://github.com/forwardimpact/monorepo/tree/main/products/pathway
    - label: View on npm
      href: https://www.npmjs.com/package/@forwardimpact/pathway
      secondary: true
---

> Pathway is your interface to the agent-aligned engineering standard. Feed it a
> discipline, a track, and a level — and it produces a complete job definition.
> Drop the level and you get an agent profile instead. Same data, same formula,
> different outputs.

### What you get

- An interactive web app to explore roles, skills, and career paths
- A CLI for generating job descriptions and agent profiles
- Claude Code agent profiles derived from your agent-aligned engineering
  standard
- Agent skill files following the open Agent Skills Standard
- A static site export for publishing your agent-aligned engineering standard
- Interview question sets tailored to each role

---

### Who it's for

**Empowered Engineers** exploring where they are and where they're heading.
Browse skills, see what's expected at the next level, and identify growth areas.

**Leadership** building job descriptions and interview question sets. Select a
discipline, track, and level — Pathway generates a complete, consistent job
definition.

**Coding Agents** aligning with organizational standards. Pathway generates
agent profiles and skill files from the same engineering standard humans use.

---

## The Web Application

The interactive browser gives you:

- **Job Builder** — Select discipline, track, and level to explore complete role
  definitions with skill matrices and behaviour profiles
- **Skill Browser** — View all skills with detailed level descriptions
- **Career Progression** — Compare levels side by side and see what changes
- **Interview Prep** — Generate role-specific question sets for hiring
- **Agent Preview** — See exactly what agent profiles will look like before
  deploying

---

## Getting Started

```sh
npm install @forwardimpact/pathway
npx fit-pathway dev                                       # Launch web app
npx fit-pathway job software_engineering J060 --track=platform  # Job definition
```

<div class="grid">

<a href="/docs/getting-started/leadership/pathway/">

### Leadership

Preview your agent-aligned engineering standard in the browser, generate job
definitions, and create interview question sets.

</a>

<a href="/docs/getting-started/engineers/pathway/">

### Empowered Engineers

Browse career paths, generate AI agent teams, and explore job definitions from
the CLI and web app.

</a>

</div>

---
title: Pathway
description: Navigate the trail — browse career paths, generate agent teams, and explore your progression.
---

<div class="page-header">
<img src="/assets/icons/pathway.svg" alt="Pathway" />

## Navigate the Trail

</div>

<div class="product-value">
<p>
Pathway is your interface to the engineering framework. Whether you're an
engineer exploring career progression, a manager building job descriptions, or a
team lead deploying AI coding agents — Pathway delivers it through a web app, a
CLI, and a static site generator.
</p>
</div>

### What you get

<ul class="benefits">
<li>An interactive web app to explore roles, skills, and career paths</li>
<li>A CLI for generating job descriptions and agent profiles</li>
<li>VS Code Custom Agent profiles derived from your framework</li>
<li>Agent skill files following the open Agent Skills Standard</li>
<li>A static site export for publishing your career framework</li>
<li>Interview question sets tailored to each role</li>
</ul>

### Who it's for

**Engineers** who want to understand where they are and where they're heading.
Browse skills, explore what's expected at the next grade, and identify growth
areas.

**Managers** building job descriptions. Select a discipline, track, and grade —
Pathway generates a complete, consistent job definition.

**Teams adopting AI agents.** Generate VS Code agent profiles and skill files
that match your engineering standards, constrained by lifecycle stage.

---

## Quick Start

<div class="quickstart">

### Browse your framework

```sh
npx fit-pathway dev   # Launch at http://localhost:3000
```

### Generate a job definition

```sh
npx fit-pathway job software_engineering L3 --track=platform
```

### Deploy agent profiles

```sh
npx fit-pathway agent software_engineering --track=platform --output=.
```

### Publish as a static site

```sh
npx fit-pathway build --url=https://pathway.myorg.com
```

</div>

---

## Web Application

The interactive browser at `http://localhost:3000` gives you:

- **Job Builder** — Select discipline, track, and grade to explore complete role
  definitions with skill matrices and behaviour profiles
- **Skill Browser** — View all skills with detailed level descriptions
- **Career Progression** — Compare grades side by side and see what changes
- **Interview Prep** — Generate role-specific question sets for hiring
- **Agent Preview** — See exactly what agent profiles will look like before
  deploying

---

## Agent Generation

Pathway generates two types of AI agent artifacts:

**VS Code Custom Agents** (`.agent.md`) — Stage-specific agents with tools,
handoffs, and constraints derived from your skill framework. One agent per
lifecycle stage — specify, plan, code, review, deploy.

**Agent Skill Files** (`SKILL.md`) — Following the open
[Agent Skills Standard](https://agentskills.io/), these portable skill files
work across VS Code, GitHub Copilot, and other AI coding tools.

See [Agents](agents.md) for the full derivation model and output format.

---

## Further Reading

- [Agents](agents.md) — How agent profiles are derived and structured
- [Reference](reference.md) — File organization, CLI commands, and templates

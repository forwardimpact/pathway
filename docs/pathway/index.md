---
title: Pathway
description: Navigate engineering skills and careers with clarity — browse career paths, generate agent teams, build progression plans.
toc: false
---

<div class="hero">
  <div class="page-container">
    <div class="hero-illustration">
      <img src="/assets/heros/pathway.svg" alt="An engineer, an AI robot, and a business professional stand at the base of mountains, studying the trail ahead" />
    </div>
    <h1 class="text-hero">Pathway</h1>
    <p class="text-subtitle">
      Navigate engineering skills and careers with clarity. Whether you're an
      engineer exploring career progression, a manager building job descriptions,
      or a team lead deploying AI coding agents — Pathway delivers it through a
      web app, a CLI, and a static site generator.
    </p>
    <div class="hero-cta">
      <a href="/docs/pathway/" class="btn btn-primary">Documentation</a>
      <a href="https://github.com/forwardimpact/monorepo/" class="btn btn-secondary">View on GitHub</a>
    </div>
  </div>
</div>

<div class="section section-warm">
  <div class="page-container content-product">

<div class="value-box">
<p>
Pathway is your interface to the engineering framework. Feed it a discipline,
a track, and a grade — and it produces a complete job definition. Swap the
grade for a lifecycle stage and you get an agent profile instead. Same data,
same formula, different outputs.
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

  </div>
</div>

<div class="section">
  <div class="page-container content-product">

### Who it's for

**Engineers** who want to understand where they are and where they're heading.
Browse skills, explore what's expected at the next grade, and identify growth
areas.

**Managers** building job descriptions. Select a discipline, track, and grade —
Pathway generates a complete, consistent job definition.

**Teams adopting AI agents.** Generate VS Code agent profiles and skill files
that match your engineering standards, constrained by lifecycle stage.

---

## The Web Application

The interactive browser gives you:

- **Job Builder** — Select discipline, track, and grade to explore complete role
  definitions with skill matrices and behaviour profiles
- **Skill Browser** — View all skills with detailed level descriptions
- **Career Progression** — Compare grades side by side and see what changes
- **Interview Prep** — Generate role-specific question sets for hiring
- **Agent Preview** — See exactly what agent profiles will look like before
  deploying

---

## Quick Start

```sh
npx fit-pathway dev                                       # Launch web app
npx fit-pathway job software_engineering L3 --track=platform  # Job definition
npx fit-pathway agent software_engineering --track=platform   # Agent profiles
npx fit-pathway build --url=https://pathway.myorg.com         # Static site
```

  </div>
</div>

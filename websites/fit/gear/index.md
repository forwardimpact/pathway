---
title: Gear
description: The agent-shaped utilities you carry into the field — CLIs, retrieval primitives, evaluation tooling, and service infrastructure for builders deploying humans and agents.
layout: product
toc: false
hero:
  image: /assets/scene-concept.svg
  alt: An engineer in a hoodie, an AI robot, and a business professional wave hello
  subtitle: Gear is the catalog of agent-shaped utilities for builders deploying humans and agents. CLIs, retrieval primitives, evaluation tooling, and service infrastructure — installed from npm and the forwardimpact/fit-skills skill pack so builders and agents share one inventory.
  cta:
    - label: Browse the catalog
      href: https://github.com/forwardimpact/monorepo/tree/main/libraries
    - label: Library Guides
      href: /docs/libraries/
      secondary: true
---

> Gear gives builders and agents a shared inventory of capabilities. Each is a
> focused tool — agent-friendly by design, with CLIs that print grep-friendly
> help, JSON output, and links back to the same documentation humans and agents
> read.

### What's in the catalog

The catalog is organized into five capability categories. Browse the full tables
in
[libraries/README.md](https://github.com/forwardimpact/monorepo/blob/main/libraries/README.md).

<div class="grid">

<a href="https://github.com/forwardimpact/monorepo/tree/main/libraries#agent-capability">

### Agent Capability

What the agent surface looks like — entry points, voice, skill data, and the
human-facing output agents produce. CLIs, REPLs, prompt templates, and
documentation site builders.

</a>

<a href="https://github.com/forwardimpact/monorepo/tree/main/libraries#agent-retrieval">

### Agent Retrieval

How agents fetch and shape context — from raw bytes through typed records to
schema-aware graph and vector inference.

</a>

<a href="https://github.com/forwardimpact/monorepo/tree/main/libraries#agent-self-improvement">

### Agent Self-Improvement

Tooling that closes the Plan-Do-Study-Act loop: trace evaluation, synthetic data
generation, and XmR control charts that distinguish signal from noise.

</a>

<a href="https://github.com/forwardimpact/monorepo/tree/main/libraries#agent-infrastructure">

### Agent Infrastructure

How agent services run — gRPC framework, structured logging, process
supervision, configuration loading, and the bridge that exposes services as MCP
tools.

</a>

<a href="https://github.com/forwardimpact/monorepo/tree/main/libraries#foundations">

### Foundations

Cross-cutting primitives — secrets, retries, hashing, project finder, macOS
bundle assembly, and shared test fixtures.

</a>

</div>

---

### Who it's for

**Builders** composing agentic products. Pull in just the libraries you need;
every CLI works standalone via `npx fit-<name>`.

**Agents** deployed into the field. Each library ships a matching skill in the
`forwardimpact/fit-skills` pack, so agents land on the same docs as humans.

---

## Getting Started

```sh
npm install @forwardimpact/libcli @forwardimpact/libstorage  # any subset
npx skills add forwardimpact/fit-skills
```

<div class="grid">

<a href="/docs/libraries/">

### Library Guides

Task-oriented walkthroughs for evaluations, multi-agent collaboration, and trace
analysis using the Gear catalog.

</a>

<a href="https://github.com/forwardimpact/monorepo/tree/main/libraries">

### Browse on GitHub

Source code and per-library README for every entry in the catalog.

</a>

</div>

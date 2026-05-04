---
title: Gear
description: Shared libraries and services for platform builders and agents — CLIs, retrieval, evaluation, and infrastructure published to npm.
layout: product
toc: false
hero:
  image: /assets/scene-gear.svg
  alt: An engineer in a hoodie, an AI robot, and a business professional wave hello
  subtitle: Carry the right gear. Shared libraries and services for platform builders and agents — CLIs, retrieval primitives, evaluation tooling, and service infrastructure published to npm and the forwardimpact/fit-skills skill pack.
  cta:
    - label: Browse the catalog
      href: https://github.com/forwardimpact/monorepo/tree/main/libraries
    - label: Library Guides
      href: /docs/libraries/
      secondary: true
---

Platform builders composing agentic products need focused, interoperable
libraries and services — not monolithic frameworks. Gear provides individual
capabilities that work standalone or together, with humans and agents sharing
the same interface and documentation.

## What becomes possible

### For Platform Builders

Give humans and agents shared capabilities through the same interface, with
tooling to prove changes actually improved outcomes. Every CLI prints
grep-friendly help and JSON output; every library ships a matching skill in the
`forwardimpact/fit-skills` pack so agents land on the same docs as humans.

33 libraries organized into five capability categories, all published to npm
under `@forwardimpact/lib*`. Browse the full tables in
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

---
title: Map
description: The data product for your engineering system — agent-aligned engineering standard definitions, organization structure, GitHub activity, and GetDX snapshots.
layout: product
toc: false
hero:
  image: /assets/scene-map.svg
  alt: An engineer, an AI robot, and a business professional kneel around a large unfolded map, tracing routes together
  subtitle: Map is the data product for the FIT suite. It defines your agent-aligned engineering standard in plain YAML and stores operational signals — organization hierarchy, GitHub activity, and GetDX snapshot results — in one model.
  cta:
    - label: View on GitHub
      href: https://github.com/forwardimpact/monorepo/tree/main/products/map
    - label: View on npm
      href: https://www.npmjs.com/package/@forwardimpact/map
      secondary: true
---

> Map is the data product that provides shared context for every product in the
> suite. Teams define the agent-aligned engineering standard once, import
> operational signals continuously, and make that data available to Pathway,
> Guide, Landmark, and Outpost through stable contracts.

### What you get

- Agent-aligned engineering standard definitions for skills, behaviours, levels,
  disciplines, and tracks
- A simple people directory with reporting structure
- Team views derived from reporting hierarchy (manager-rooted subtrees)
- GitHub activity data for objective marker evidence analysis
- GetDX snapshot imports for quarterly developer-experience results
- Validation tooling and schema artifacts (JSON Schema + RDF/SHACL)

---

### Who it's for

**Leadership** defining what good engineering looks like. Author your
agent-aligned engineering standard in YAML, import operational signals from
GitHub and GetDX, and give every downstream product a shared foundation.

**Coding Agents** operating within those standards. Map provides the shared
definitions that Pathway uses to generate aligned agent profiles and skill
files.

---

## Getting Started

### Standard layer

Define your agent-aligned engineering standard and validate it.

```sh
npm install @forwardimpact/map
npx fit-map init
npx fit-map validate
```

### Activity layer

The activity layer adds operational signals — organization people, GitHub
activity, and GetDX snapshots — on top of Supabase. Set up Supabase and run the
ingestion commands by following the leadership guide:

[Set up the activity layer →](/docs/getting-started/leadership/map/#activity-install-the-supabase-cli)

<div class="grid">

<a href="/docs/getting-started/leadership/map/">

### Leadership

Initialize your agent-aligned engineering standard, validate schemas, set up the
activity layer, and ingest operational signals from GitHub and GetDX.

</a>

</div>

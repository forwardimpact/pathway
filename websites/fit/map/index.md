---
title: Map
description: The data product for your engineering system — framework definitions, organization structure, GitHub activity, and GetDX snapshots.
layout: product
toc: false
hero:
  image: /assets/heros/map.svg
  alt: An engineer, an AI robot, and a business professional kneel around a large unfolded map, tracing routes together
  subtitle: Map is the data product for the FIT suite. It defines your framework in plain YAML and stores operational signals — organization hierarchy, GitHub activity, and GetDX snapshot results — in one model.
  cta:
    - label: View on GitHub
      href: https://github.com/forwardimpact/monorepo/tree/main/products/map
    - label: View on npm
      href: https://www.npmjs.com/package/@forwardimpact/map
      secondary: true
---

> Map is the data product that provides shared context for every product in the
> suite. Teams define the engineering framework once, import operational signals
> continuously, and make that data available to Pathway, Guide, Landmark, and
> Basecamp through stable contracts.

### What you get

- Framework definitions for skills, behaviours, levels, disciplines, and tracks
- A simple people directory with reporting structure
- Team views derived from reporting hierarchy (manager-rooted subtrees)
- GitHub activity data for objective marker evidence analysis
- GetDX snapshot imports for quarterly developer-experience results
- Validation tooling and schema artifacts (JSON Schema + RDF/SHACL)

---

### Who it's for

**Engineering leaders** defining standards and reviewing outcomes in one place.
Map connects framework expectations to operational signals without splitting the
data model across products.

**Platform teams** building internal tooling. Map exposes a stable shared model
for product and analytics use cases.

---

## Getting Started

```sh
npm install @forwardimpact/map
npx fit-map init
npx fit-map validate
```

<div class="grid">

<a href="/docs/getting-started/leadership/map/">

### Leadership

Initialize your framework, validate schemas, set up the activity layer, and
ingest operational signals from GitHub and GetDX.

</a>

</div>

---
title: "Getting Started: Pathway for Leadership"
description: "Preview your agent-aligned engineering standard in the browser, generate job definitions, and create interview question sets."
---

Pathway is your interface to the agent-aligned engineering standard — browse
roles, generate job definitions, and preview everything in the browser.

## Prerequisites

- Node.js 18+
- npm
- Standard data initialized (see
  [Getting Started: Map for Leadership](/docs/getting-started/leadership/map/))

## Install

```sh
npm install @forwardimpact/pathway
```

## Preview

Start the development server to see your agent-aligned engineering standard in
the browser:

```sh
npx fit-pathway dev
# Open http://localhost:3000
```

Browse disciplines, levels, and skills to verify everything looks correct.

## Generate job definitions

Generate a complete job definition by combining a discipline, level, and
optional track:

```sh
npx fit-pathway job software_engineering J060 --track=platform
```

## Generate interview questions

Create role-specific interview question sets:

```sh
npx fit-pathway interview software_engineering J060
```

---

## Next steps

- [Pathway product page](/pathway/) — web app features, CLI commands, and static
  site generation
- [Authoring agent-aligned engineering standards](/docs/products/authoring-standards/)
  — full guide to defining all entity types
- [YAML schema reference](/docs/reference/yaml-schema/) — complete file format
  documentation

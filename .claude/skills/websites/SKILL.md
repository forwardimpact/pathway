---
name: websites
description: >
  Maintain the two published websites (forwardimpact.team and kata.team).
  Use when editing website pages, assets, templates, or the GitHub Actions
  publish workflows.
---

# Websites

Two websites are published from this monorepo, both built by the `fit-doc` CLI
(see the `fit-doc` skill for commands, front matter, and auto-generated
outputs).

| Site                       | Source           | Domain                   |
| -------------------------- | ---------------- | ------------------------ |
| Forward Impact Engineering | `websites/fit/`  | `www.forwardimpact.team` |
| Kata Agent Team            | `websites/kata/` | `www.kata.team`          |

### Local preview

```sh
bunx fit-doc serve --src=websites/fit --watch
bunx fit-doc serve --src=websites/kata --watch
```

## Publishing Pipeline

Both sites follow the same deployment pattern. Each has a workflow in
`.github/workflows/` and a corresponding GitHub Pages repo.

| Workflow            | Artifact     | Pages repo                 |
| ------------------- | ------------ | -------------------------- |
| `website-fit.yaml`  | `fit-pages`  | `forwardimpact/fit-pages`  |
| `website-kata.yaml` | `kata-pages` | `forwardimpact/kata-pages` |

Steps:

1. **Trigger** — push to `main` (path-filtered to `websites/{name}/**`,
   `design/{name}/**`, and the workflow file) or `workflow_dispatch`
2. **Build** — `bunx fit-doc build --src=websites/{name} --out=dist`
3. **Extra assets** — site-specific files copied into `dist/` (FIT copies
   JSON/RDF schemas from `products/map/schema/`)
4. **CNAME** — copied to `dist/` for custom domain routing
5. **Upload** — `dist/` uploaded as a named artifact
6. **Dispatch** — GitHub App token triggers `repository_dispatch` (event type
   `deploy`) on the pages repo, passing `run_id`

The pages repo downloads the artifact and deploys to GitHub Pages. Both
workflows use the same GitHub App secrets (`KATA_APP_ID` /
`KATA_APP_PRIVATE_KEY`).

## FIT Site

The FIT site is the main product website — product pages, documentation, and
getting-started guides. Explore `websites/fit/` to discover the current
structure and pages.

### Design assets

Design sources live in `design/fit/` and are copied into `websites/fit/assets/`
via a `justfile` pre-build hook. Design guidelines:

- `design/fit/index.md` — palette, typography, CSS tokens
- `design/fit/scenes.md` — product scene illustrations
- `design/fit/icons.md` — product icon system

### Schema files

The FIT workflow copies JSON schemas (`products/map/schema/json/`) and RDF
schemas (`products/map/schema/rdf/`) into `dist/schema/`. These appear at
`/schema/json/` and `/schema/rdf/` on the live site.

## Kata Site

The Kata site is a minimal placeholder — a single page with no CSS or design
assets. Source is at `websites/kata/`.

# Websites

Two sites built by `fit-doc`
([internals](fit/docs/internals/fit-doc/index.md)).

| Site                       | Source           | Domain                   |
| -------------------------- | ---------------- | ------------------------ |
| Forward Impact Engineering | `websites/fit/`  | `www.forwardimpact.team` |
| Kata Agent Team            | `websites/kata/` | `www.kata.team`          |

Preview locally:

```sh
bunx fit-doc serve --src=websites/fit --watch
bunx fit-doc serve --src=websites/kata --watch
```

## Page Conventions

Every page is a directory containing `index.md`. No other `.md` filenames.

- **Frontmatter** — `title` (rendered as H1) and `description` (meta) are
  required. Optional: `toc: false`, `layout: product|home`,
  `hero: { image, alt, title, subtitle, cta }`.
- **Headings** — body headings start at `##` (the build system renders H1 from
  `title`; a manual `# Title` produces a duplicate).
- **Links** — absolute directory paths (`/docs/products/agent-teams/`, not
  relative, not `index.md`). External links use full URLs.
- **Code blocks** — always specify a language tag (`sh`, `yaml`, `json`,
  `mermaid`, etc.).
- **Navigation is manual.** When a page is added, moved, or removed, update
  every hub page and card grid that references it. There is no build-time check
  for stale links.

### Page Types

**Product pages** (`/map/`, `/pathway/`, etc.) — `layout: product` with hero,
situation paragraph, **What becomes possible** by persona (Engineering Leaders,
Empowered Engineers, Platform Builders from [JTBD.md](/JTBD.md)), detail
sections, **Getting Started** with install commands and guide links.

**Hub pages** — `toc: false`, grid of anchor cards linking to children:

```html
<div class="grid">
<a href="/docs/products/agent-teams/">

### Agent Teams

Configure agents to meet your engineering standard...

</a>
</div>
```

**Guide pages** — organized by job heading on their hub. Big Hire guides
(150–400 lines) cover the end-to-end workflow; Little Hire guides (80–200
lines) cover a bounded task assuming the Big Hire is done. Getting-started pages
are per-persona minimal paths (50–150 lines). All guides are framed around the
reader's progress, not product features. See [README.md](README.md) for the
full guide map.

## Design Assets

Sources live in `design/fit/` and are copied into `websites/fit/assets/` via a
pre-build hook. Asset paths in pages are absolute (`/assets/scene-guide.svg`).

- `design/fit/index.md` — palette, typography, CSS tokens
- `design/fit/scenes.md` — product scene illustrations
- `design/fit/icons.md` — product icon system

## Publishing Pipeline

Both sites share the same deployment pattern. Workflows in
`.github/workflows/`:

| Workflow            | Artifact     | Pages repo                 |
| ------------------- | ------------ | -------------------------- |
| `website-fit.yaml`  | `fit-pages`  | `forwardimpact/fit-pages`  |
| `website-kata.yaml` | `kata-pages` | `forwardimpact/kata-pages` |

Push to `main` (path-filtered) triggers: build with `fit-doc`, upload artifact,
dispatch to the pages repo via GitHub App token. The pages repo deploys to
GitHub Pages.

The FIT workflow also copies JSON and RDF schemas from `products/map/schema/`
into `dist/schema/`, published at `/schema/json/` and `/schema/rdf/`.

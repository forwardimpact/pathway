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
- **Card grids use content partials.** Hub page cards are
  `<!-- part:card:relative-path -->` markers that resolve to the target page's
  frontmatter `title` and `description` at build time. The build fails if a
  partial references a nonexistent page. Hand-written `<a>` cards are only used
  for external links or same-page anchors.
- **Hand-written links are not checked.** Partials validate their targets, but
  inline markdown links are not verified at build time.
- **Cross-links** — every non-hub page ends with a `## What's next` section.
  Cards use content partials only (`<!-- part:card:path -->`), never markdown
  links. Maximum four cards. When a page has a `## Verify` section,
  `## What's next` follows it. Card targets follow JTBD structure: Big Hire
  guides link to their Little Hire children; Little Hire guides link back to
  the parent Big Hire and sibling Little Hires; Getting Started pages link to
  the product page and primary guide.

## Page Types

### Product Pages

Product pages (`/map/`, `/pathway/`, etc.) follow a consistent structure:

1. Frontmatter with `layout: product` and hero section (light metaphor
   reference in subtitle, then progress framing)
2. Situation paragraph — 2-3 sentences describing the moment someone realizes
   they need this product (no blockquote)
3. **What becomes possible** — organized by persona, each with a progress
   statement and concrete outputs. Canonical persona names from
   [JTBD.md](/JTBD.md): Engineering Leaders, Empowered Engineers, Platform
   Builders. Only personas with a relevant outcome for that product appear.
4. Product-specific detail sections
5. **Getting Started** — install commands and persona-labeled guide links

### Hub Pages

Collection pages use `toc: false` and a grid of content partials to link to
children. Cards are organized under `##` job headings with a persona label.

```html
<div class="grid">
<!-- part:card:agent-teams -->
<!-- part:card:agent-teams/organizational-context -->
</div>
```

Each `<!-- part:card:path -->` resolves to an `<a>` with the target page's
`title` and `description` from frontmatter. Paths are relative to the current
page's directory — `agent-teams` for a sibling, `../docs/libraries` for a
cross-tree reference. The build fails if a target page does not exist, so stale
card references are caught automatically.

Hand-written `<a>` cards are still used for external links (GitHub URLs) and
same-page anchors (`href="#section"`). See `gear/index.md` and
`docs/internals/kata/index.md` for examples.

### Getting Started Pages

Per-persona entry points. Minimal path from zero to first meaningful result with
a single product — install, configure, see output. No exploration, no
alternatives, no background theory. Links forward to the relevant guide for
depth. 50–150 lines.

See [README.md § Getting Started Map](README.md#getting-started-map).

### Guide Pages

Guides under `docs/products/`, `docs/libraries/`, and `docs/services/` sit
under job headings on their hub page. Each job contains two guide types:

- **Big Hire** — end-to-end workflow from situation to outcome (150–400 lines).
  Directory root for the job.
- **Little Hire** — bounded task assuming the Big Hire is done (80–200 lines).
  Nested under the Big Hire directory.

All guides are framed around the reader's progress, not product features. See
[README.md § Guide Map](README.md#guide-map).

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

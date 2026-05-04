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

### Frontmatter

Required fields:

- `title` — rendered as the page H1 by the build system
- `description` — meta description and preview text

Optional fields:

- `toc: false` — disables auto-generated table of contents (hub pages)
- `layout: product` or `layout: home` — switches layout template
- `hero:` — hero section with `image`, `alt`, `title`, `subtitle`, `cta`

### Headings

The build system renders H1 from frontmatter `title`. Pages must not contain
their own `# Title` — it would produce a duplicate. Body headings start at `##`.

### Links

- Absolute paths: `/docs/products/agent-teams/`, not `../products/agent-teams/`
- Point to directories, not files: `/docs/products/`, not `/docs/products/index.md`
- External links use full URLs

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

### Hub pages

Collection pages use a grid of anchor cards to link to children:

```html
<div class="grid">
<a href="/docs/products/agent-teams/">

### Agent Teams

Generate AI coding agent teams...

</a>
</div>
```

### Guide Pages

Guides under `docs/products/`, `docs/libraries/`, and `docs/services/` sit
under job headings on their hub page. Each job contains two guide types:

- **Big Hire** — end-to-end workflow from situation to outcome (150–400 lines)
- **Little Hire** — bounded task assuming the Big Hire is done (80–200 lines)

Getting-started pages are per-persona minimal paths (50–150 lines) linking
forward to guides. All guides are framed around the reader's progress, not
product features.

### Manual maintenance

Navigation is not generated from the file tree. When a page is added, moved, or
removed, update every hub page and card grid that references it. There is no
build-time check for stale links — broken cards and missing entries stay broken
until someone fixes them by hand.

### Code blocks

Always specify a language tag (`sh`, `yaml`, `json`, `mermaid`, etc.).

## Guide Map

See [README.md](README.md) for the full Big Hire / Little Hire guide map
covering products, libraries, and services.

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

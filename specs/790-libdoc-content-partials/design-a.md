# Design-A — Spec 790: Libdoc Content Partials

## Architecture

The build pipeline shifts from a two-pass class (discover files, collect titles,
then render each page) to a three-stage pipeline: **scan** the site tree once,
**resolve** partials per page, then **render**. Two new modules (`site-tree.js`,
`partials.js`) own the first two stages; `DocsBuilder` orchestrates the pipeline
and owns rendering, template application, and output.

```mermaid
flowchart LR
  S["site-tree.js\nscanSiteTree()"] -- SiteTree map --> P["partials.js\nresolvePartials()"]
  P -- markdown with HTML --> R["builder.js\nrender + write"]
  S -- SiteTree map --> R
  S -- SiteTree map --> X["sitemap / llms.txt"]
```

## Components

| Component | Module | Responsibility |
|---|---|---|
| `scanSiteTree` | `site-tree.js` (new) | Walk docs dir, parse frontmatter, return `SiteTree` map |
| `resolvePartials` | `partials.js` (new) | Replace `<!-- part:type:path -->` markers with HTML from the registry |
| `defaultRegistry` | `partials.js` (new) | `card` and `link` partial type renderers |
| `DocsBuilder` | `builder.js` (modified) | Orchestrate: scan, resolve, render, template, format, write |
| transforms | `transforms.js` (minor change) | Link rewriting, breadcrumbs, TOC, hero vars |
| `parseFrontMatter` | `frontmatter.js` (unchanged) | YAML frontmatter extraction |

## Data Structures

### SiteTree

```
Map<urlPath, PageMeta>

PageMeta = {
  filePath: string     // relative to docsDir, e.g. "docs/getting-started/index.md"
  urlPath:  string     // e.g. "/docs/getting-started/"
  title:    string
  description: string
}
```

Built once by `scanSiteTree`, passed immutably through the pipeline. Replaces
both the `pageTitles` map from Pass 1 and the `pages` array accumulated during
Pass 2 — sitemap and llms.txt generation read directly from the site tree.

Only pages with a `title` in frontmatter are included (matching current
behavior where titleless pages are skipped). PageMeta holds scan-time metadata
only — per-page rendering still reads the full file for markdown content and
layout/hero/toc frontmatter fields.

### Partial registry

```
Record<string, (meta: PageMeta, href: string) => string>
```

Two initial entries:

| Type | Output |
|---|---|
| `card` | `<a href="${href}">\n<h3>${title}</h3>\n<p>${description}</p>\n</a>` |
| `link` | `<a href="${href}">${title}</a>` |

Adding a third type means adding one entry to this object — no changes to the
resolver or builder (success criterion 10).

## Build Pipeline

```mermaid
flowchart TD
  subgraph "Stage 1 — Scan"
    S1[Walk docsDir, skip assets/public/CLAUDE.md/SKILL.md]
    S1 --> S2[Parse frontmatter per .md file]
    S2 --> S3["Return SiteTree map (urlPath → PageMeta)"]
  end

  subgraph "Stage 2 — Render each page"
    R1[Read file, parse frontmatter]
    R1 --> R2["resolvePartials(markdown, siteTree, pageDir, registry)"]
    R2 --> R3["marked(markdown) → HTML"]
    R3 --> R4[Transform links]
    R4 --> R5["Template vars + breadcrumbs (from siteTree)"]
    R5 --> R6[Mustache render]
    R6 --> R7[Prettier format]
    R7 --> R8[Write .html + companion .md]
  end

  subgraph "Stage 3 — Post"
    P1[Copy static assets]
    P2["sitemap.xml (from siteTree)"]
    P3["llms.txt (from siteTree)"]
  end

  S3 --> R1
  S3 -.-> R2
  S3 -.-> R5
  R8 --> P1
  S3 --> P2
  S3 --> P3
```

## Key Decisions

| Decision | Choice | Rejected | Why |
|---|---|---|---|
| Site tree scope | Single upfront scan collects path, title, description | Extend `pageTitles` map with extra fields | Adding fields piecemeal perpetuates the two-pass design; a complete scan is simpler and feeds partials, sitemap, and llms.txt from one structure |
| Partials processing order | Resolve before `marked` | Resolve after markdown-to-HTML | Partial output is raw HTML that `marked` passes through unchanged, matching how hub pages work today; post-render resolution risks double-escaping |
| Partial implementation | Pre-processing function with regex | Custom `marked` extension | HTML comments are not markdown syntax; a standalone function is simpler and independently testable without coupling to marked's extension API |
| Type dispatch | Plain object registry | Switch/case in resolver | A registry entry per type satisfies criterion 10 (no resolver changes to add a type) |
| Module decomposition | Two new focused modules (`site-tree.js`, `partials.js`) | More private methods on DocsBuilder | The class already has 12 private methods; separate modules with explicit inputs are independently testable and reduce per-module concept count |
| Module decomposition | Two focused modules | Plugin architecture with lifecycle hooks | Over-engineering; spec calls for fewer concepts, not an extensibility framework |

## Partials

### Marker syntax

```
<!-- part:<type>:<path> -->
```

Matched by: `/<!--\s*part:(\w+):([\w./-]+)\s*-->/g`

### Path resolution

Given `<!-- part:card:getting-started -->` in `docs/products/index.md`:

1. Source directory: `docs/products/`
2. Join with partial path: `docs/products/getting-started`
3. Normalize (resolve `..` segments)
4. Compute urlPath → `/docs/products/getting-started/`
5. Look up in SiteTree
6. Fail with source file and partial path if not found

### Href computation

Relative URL from current page to target page, computed via `path.relative()`:

| Current page | Target | Href |
|---|---|---|
| `/docs/` | `/docs/getting-started/` | `getting-started/` |
| `/docs/products/` | `/docs/libraries/typed-contracts/` | `../libraries/typed-contracts/` |
| `/docs/products/` | `/map/` | `../../map/` |

### Errors (both fatal)

- Unknown type: `Unknown partial type "foo" in docs/index.md`
- Missing target: `Partial target "nonexistent" not found in site tree (referenced from docs/index.md)`

## Builder Changes

### Removed from DocsBuilder

`#findMarkdownFiles`, `#collectMarkdownEntry`, `#collectPageTitles` — replaced
by `scanSiteTree`.

### Modified in DocsBuilder

- **`build()`** — calls `scanSiteTree()` instead of two-step discovery; passes
  `siteTree` to rendering, sitemap, and llms.txt; no longer accumulates a
  `pages` array.
- **`#renderPage()`** — calls `resolvePartials(markdown, siteTree, pageDir,
  registry)` before `this.#marked(markdown)`.
- **`#buildTemplateVars()`** — receives `siteTree` instead of `pageTitles`.
- **`buildBreadcrumbs()`** in `transforms.js` — accepts `SiteTree` map and
  reads `.title` from each entry instead of receiving a `Map<string, string>`.
- **`#generateSitemap()` / `#augmentLlmsTxt()`** — iterate `siteTree.values()`
  instead of receiving a separate pages array.

### Unchanged

Constructor signature, public API (`async build(docsDir, distDir, baseUrl)`),
dependency injection pattern, CLI interface, template, CSS.

## Migration

Replace `<a>` card content inside `<div class="grid">` on the 17 hub pages
(all except `websites/fit/index.md`) with `<!-- part:card:path -->` markers.
The `<div class="grid">` wrappers and `## Job Heading` sections stay
hand-written. Success criterion 6 verifies identical HTML output via diff.

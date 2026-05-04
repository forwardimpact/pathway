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

Every guide maps to a Big Hire or Little Hire from
[JTBD.md](/JTBD.md), [libraries/README.md](/libraries/README.md), or
[services/README.md](/services/README.md). Big Hire guides are directory roots;
Little Hire guides are nested children.

### Product Guides (`docs/products/`)

**Define the Engineering Standard** (Leaders → Map, Pathway)

| Hire | Path | Title |
| ---- | ---- | ----- |
| Big | `authoring-standards/` | Authoring Agent-Aligned Engineering Standards |
| Little | `authoring-standards/update-standard/` | Validate and Update the Standard |
| Little | `authoring-standards/define-role/` | Define a New Role |

**Understand Expectations** (Engineers → Pathway)

| Hire | Path | Title |
| ---- | ---- | ----- |
| Big | `career-paths/` | See What's Expected at Your Level |
| Little | `career-paths/autonomy-scope/` | Understand Autonomy and Scope |

**Find Growth Areas** (Engineers → Guide, Landmark)

| Hire | Path | Title |
| ---- | ---- | ----- |
| Big | `growth-areas/` | Find Growth Areas and Build Evidence |
| Little | `growth-areas/growth-question/` | Ask a Growth Question |
| Little | `growth-areas/check-progress/` | Check Progress Toward Next Level |

**Trust Agent Output** (Engineers → Guide, Pathway)

| Hire | Path | Title |
| ---- | ---- | ----- |
| Big | `trust-output/` | Verify Agent Work Against the Standard |
| Little | `trust-output/second-opinion/` | Get a Second Opinion on a Deliverable |
| Little | `trust-output/expected-output/` | See What the Standard Expects Before Reviewing |

**Equip Aligned Agent Teams** (Engineers → Pathway)

| Hire | Path | Title |
| ---- | ---- | ----- |
| Big | `agent-teams/` | Configure Agents to Meet Your Engineering Standard |
| Little | `agent-teams/organizational-context/` | Give Agents Organizational Context |

**Measure Engineering Outcomes** (Leaders → Landmark)

| Hire | Path | Title |
| ---- | ---- | ----- |
| Big | `engineering-outcomes/` | Demonstrate Engineering Progress |
| Little | `engineering-outcomes/culture-investments/` | Tell Whether Culture Investments Are Working |

**Staff Teams to Succeed** (Leaders → Pathway, Summit)

| Hire | Path | Title |
| ---- | ---- | ----- |
| Big | `team-capability/` | Make Staffing Decisions You Can Defend |
| Little | `team-capability/evaluate-candidate/` | Evaluate a Candidate Against Team Gaps |
| Little | `team-capability/surface-gaps/` | Surface Capability Gaps |

**Be Prepared and Productive** (Engineers → Outpost)

| Hire | Path | Title |
| ---- | ---- | ----- |
| Big | `knowledge-systems/` | Keep Track of Context Without Effort |
| Little | `knowledge-systems/meeting-prep/` | Walk Into Every Meeting Already Oriented |

### Library Guides (`docs/libraries/`)

**Operate a Predictable Agent Team** (Engineers → libwiki, libxmr)

| Hire | Path | Title |
| ---- | ---- | ----- |
| Big | `predictable-team/` | Set Up Persistent Memory and Metrics |
| Little | `predictable-team/wiki-operations/` | Send a Memo or Update a Storyboard |
| Little | `predictable-team/xmr-analysis/` | Chart a Metric and Check Variation |

**Enable Agents on Every Surface** (Builders → libcli, libformat, libui)

| Hire | Path | Title |
| ---- | ---- | ----- |
| Big | `every-surface/` | Give Agents and Humans the Same Interface |
| Little | `every-surface/add-capability/` | Add a Capability to Both Surfaces |

**Ground Agents in Context** (Builders → libgraph, libindex, libresource, libvector)

| Hire | Path | Title |
| ---- | ---- | ----- |
| Big | `ground-agents/` | Give Agents Typed, Retrievable Knowledge |
| Little | `ground-agents/query-graph/` | Query a Knowledge Graph |
| Little | `ground-agents/lookup-context/` | Look Up Context Fast |
| Little | `ground-agents/resolve-resource/` | Resolve a Resource |
| Little | `ground-agents/search-semantically/` | Search Semantically |

**Integrate with the Engineering Standard** (Builders → libskill)

| Hire | Path | Title |
| ---- | ---- | ----- |
| Big | `integrate-standard/` | Turn Standard Definitions into Queryable Data |
| Little | `integrate-standard/derive-profile/` | Derive a Skill Matrix or Agent Profile |

**Keep Service Contracts Typed** (Builders → libcodegen, libmcp, librpc, libtype)

| Hire | Path | Title |
| ---- | ---- | ----- |
| Big | `typed-contracts/` | Keep Types Synced with Proto Definitions |
| Little | `typed-contracts/expose-tool/` | Expose a Proto Method as an Agent Tool |
| Little | `typed-contracts/ship-endpoint/` | Ship a Service Endpoint |

**Keep Services Running and Visible** (Builders → librc, libsupervise, libtelemetry)

| Hire | Path | Title |
| ---- | ---- | ----- |
| Big | `service-lifecycle/` | Manage Service Lifecycle from One Interface |
| Little | `service-lifecycle/manage-service/` | Start, Stop, or Check a Service |
| Little | `service-lifecycle/add-observability/` | Add Observability |

**Prove Agent Changes** (Builders → libeval, libterrain)

| Hire | Path | Title |
| ---- | ---- | ----- |
| Big | `prove-changes/` | Prove Agent Changes |
| Little | `prove-changes/run-eval/` | Run an Eval |
| Little | `prove-changes/trace-analysis/` | Analyze Traces |
| Little | `prove-changes/generate-dataset/` | Generate an Eval Dataset |

### Service Guides (`docs/services/`)

**Ground Agents in Context** (Builders → graph, vector)

| Hire | Path | Title |
| ---- | ---- | ----- |
| Big | `ground-agents/` | Traverse Knowledge and Search Semantically |
| Little | `ground-agents/query-graph/` | Answer Relationship Questions from a Product |
| Little | `ground-agents/search-content/` | Search for Related Content from a Product |

**Integrate with the Engineering Standard** (Builders → pathway)

| Hire | Path | Title |
| ---- | ---- | ----- |
| Big | `integrate-standard/` | Query the Engineering Standard from Any Product |
| Little | `integrate-standard/fetch-profile/` | Fetch a Derived Role or Agent Profile |

**Keep Service Contracts Typed** (Builders → mcp)

| Hire | Path | Title |
| ---- | ---- | ----- |
| Big | `typed-contracts/` | Expose Backend Services as Agent Tools |
| Little | `typed-contracts/add-service/` | Add a Service to the MCP Surface |

**Prove Agent Changes** (Builders → trace)

| Hire | Path | Title |
| ---- | ---- | ----- |
| Big | `prove-changes/` | Collect Trace Spans from Any Product |
| Little | `prove-changes/send-spans/` | Send Spans from a Product |

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

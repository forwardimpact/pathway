# Forward Impact Engineering

## Goal

> "The aim of leadership should be to improve the performance of [engineers] and
> [agents], to improve quality, to increase output, and simultaneously to bring
> pride of workmanship to people."
>
> — W. Edwards Deming

## Users

Three external user groups use the system. Every product serves at least two.
Internal contributors build and maintain the monorepo; external users consume
products via npm.

- **Leadership** — Define what good engineering looks like, staff teams to
  succeed, and measure outcomes without blaming individuals.
- **Engineers** — Understand expectations, find growth areas, stay prepared for
  daily work, and receive guidance grounded in their organization's
  agent-aligned engineering standard.
- **Agents** — Operate with the same shared definitions, skill markers, and
  quality standards that humans use, so human–agent collaboration is coherent.

## Primary Products

### Map — `fit-map`

Helps leadership and agents answer _what does good engineering look like here?_
Validates, stores, and publishes agent-aligned engineering standards defined in
YAML. [Overview](websites/fit/map/index.md) ·
[Internals](websites/fit/docs/internals/map/index.md)

### Pathway — `fit-pathway`

Helps engineers and agents answer _where does my career path go from here?_ Web
app, CLI, and static site generator for job definitions, agent profiles, and
interview questions. [Overview](websites/fit/pathway/index.md) ·
[Internals](websites/fit/docs/internals/pathway/index.md)

### Guide — `fit-guide`

Helps engineers answer _how do I find my bearing?_ AI agent that reasons about
your agent-aligned engineering standard in context.
[Overview](websites/fit/guide/index.md) ·
[Internals](websites/fit/docs/internals/guide/index.md)

### Landmark — `fit-landmark`

Helps leadership and engineers answer _what milestones has my engineering
reached?_ Analysis layer combining GitHub artifact evidence with GetDX
snapshots. No LLM calls. [Overview](websites/fit/landmark/index.md) ·
[Internals](websites/fit/docs/internals/landmark/index.md)

### Summit — `fit-summit`

Helps leadership answer _is this team supported to reach peak performance?_
Models team capability as a system: skill matrices, coverage gaps, risks, and
staffing scenarios. [Overview](websites/fit/summit/index.md) ·
[Internals](websites/fit/docs/internals/summit/index.md)

### Outpost — `fit-outpost`

Helps engineers and agents answer _am I prepared for what's ahead today?_
Personal operations center providing scheduled AI tasks, knowledge graphs, and
meeting briefings (macOS status menu). [Overview](websites/fit/outpost/index.md)
· [Internals](websites/fit/docs/internals/outpost/index.md)

## Secondary Products

### Gear — `fit-skills`

Helps builders and agents answer _what do I carry into the field?_ The catalog
of agent-shaped utilities distributed via npm and the `forwardimpact/fit-skills`
skill pack. [Overview](websites/fit/gear/index.md) ·
[Catalog](libraries/README.md)

### Kata Agent Team — `kata-skills`

An autonomous, continuously improving agentic development team organized as a
Plan-Do-Study-Act cycle. Agents use spec-driven development to plan and ship,
then study their own traces and act on findings — closing the loop every day.
[Internals](websites/fit/docs/internals/kata/)

## Distribution Model

The monorepo is open source but external users never clone it. They consume
products exclusively via npm packages. The monorepo exists solely for internal
contributors.

### How External Users Consume Products

Agents are often the primary consumers. Published skills teach how a product
**works** and **uses** — not how it is implemented. Use fully qualified URLs
(e.g.
`https://www.forwardimpact.team/docs/products/authoring-standards/index.md`).

Two skill packs sync on push to `main`: `forwardimpact/fit-skills` (the `fit-*`
product and library skills) and `forwardimpact/kata-skills` (the `kata-*`
agent-team skills). Install: `npx skills add forwardimpact/fit-skills` (or
`kata-skills`). All CLIs use `#!/usr/bin/env node` — no Bun required. gRPC
products (currently Guide) need `npx fit-codegen --all`. See
[Codegen Internals](websites/fit/docs/internals/codegen/index.md).

### How Internal Contributors Develop

- **External users** — Node.js + npm, run `npx fit-*`.
- **Internal contributors** — Bun 1.2+ + bun, run `bunx fit-*` and `just`.

`just codegen` (included in `just quickstart`) runs `fit-codegen` internally.
Internal skills (`libs-*`, product internals) are never published. External docs
use `npm`/`npx`; `bun`/`bunx`/`just` appear only in internal docs.

## Contributor Workflow

Everything below this point is for internal contributors. External users should
consult the [Getting Started guides](websites/fit/docs/getting-started/).

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — Invariants, structure, quality
  commands, security policies. **Read before your first commit.**
- **[Operations Reference](websites/fit/docs/internals/operations/index.md)** —
  Environment setup, service management, common tasks.

### Checklists

Tagged checklists gate pause points. Rules: [CHECKLISTS.md](CHECKLISTS.md).

- **`<read_do_checklist>`** — Entry gate. Read each item, then do it.
- **`<do_confirm_checklist>`** — Exit gate. Do from memory, then confirm before
  crossing a boundary (commit, merge, publish).

**Every contribution** runs [§ READ-DO](CONTRIBUTING.md#read-do) then
[§ DO-CONFIRM](CONTRIBUTING.md#do-confirm). Domain checklists in
`.claude/skills/kata-*/SKILL.md`. Shared libraries:
[libraries/README.md](libraries/README.md).

## Memory and Coordination

Wiki is **memory** — own state (summaries, logs, metrics), not a handoff
channel. **Coordination** requires a named receiver and addressable artifact:
Issue, PR/issue comment, Discussion, or `agent-react`. See
[memory-protocol](.claude/agents/references/memory-protocol.md) and
[coordination-protocol](.claude/agents/references/coordination-protocol.md).

## Domain Concepts

Agent-aligned engineering standards are defined in YAML under
[products/map/starter/](products/map/starter/) (the monorepo's starter template,
which installs to `data/pathway/` in consuming projects). Use
`bunx fit-pathway <entity> --list` to discover available values.

- **Disciplines** — `disciplines/{id}.yaml`
- **Levels** — `levels.yaml`
- **Tracks** — `tracks/{id}.yaml`
- **Capabilities** & **Skills** — `capabilities/{id}.yaml` (skills nested)
- **Behaviours** — `behaviours/{id}.yaml`
- **Drivers** — `drivers.yaml`

Validate data: `bunx fit-map validate`. Vocabulary standards in the
[Authoring Agent-Aligned Engineering Standards guide](websites/fit/docs/products/authoring-standards/index.md).

## Documentation Map

One home per policy; per-product pages: [§ Products](#products).

**Internal:**

- **Project identity & orientation** — [CLAUDE.md](CLAUDE.md)
- **Contribution standards & security** — [CONTRIBUTING.md](CONTRIBUTING.md)
- **CLI/skill linking policy** — [products/](products/CLAUDE.md) ·
  [libraries/](libraries/CLAUDE.md)
- **Kata Agent Team** — [KATA.md](KATA.md) ·
  [Internals](websites/fit/docs/internals/kata/)
- **Codegen pipeline** — [Codegen](websites/fit/docs/internals/codegen/)

**External:**

- **Getting started** — [Getting Started](websites/fit/docs/getting-started/)
- **Product guides** —
  [websites/fit/docs/products/](websites/fit/docs/products/)
- **Library guides** —
  [websites/fit/docs/libraries/](websites/fit/docs/libraries/)
- **Published skills** — [fit-\*](.claude/skills/) · [kata-\*](.claude/skills/)

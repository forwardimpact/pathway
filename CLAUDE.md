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
  daily work, and receive guidance grounded in their organization's framework.
- **Agents** — Operate with the same shared definitions, skill markers, and
  quality standards that humans use, so human–agent collaboration is coherent.

## Products

### Map — `fit-map`

Helps leadership and agents answer _what does good engineering look like here?_
Validates, stores, and publishes YAML frameworks.
[Overview](websites/fit/map/index.md) ·
[Internals](websites/fit/docs/internals/map/index.md)

### Pathway — `fit-pathway`

Helps engineers and agents answer _where does my career path go from here?_ Web
app, CLI, and static site generator for job definitions, agent profiles, and
interview questions. [Overview](websites/fit/pathway/index.md) ·
[Internals](websites/fit/docs/internals/pathway/index.md)

### Basecamp — `fit-basecamp`

Helps engineers and agents answer _am I prepared for what's ahead today?_
Personal operations center providing scheduled AI tasks, knowledge graphs, and
meeting briefings (macOS status menu).
[Overview](websites/fit/basecamp/index.md) ·
[Internals](websites/fit/docs/internals/basecamp/index.md)

### Guide — `fit-guide`

Helps engineers answer _how do I find my bearing?_ AI agent that reasons about
your engineering framework in context. [Overview](websites/fit/guide/index.md) ·
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

Agents are often the primary consumers of our products. Published skills are how
they learn to use them, so skill clarity directly affects product quality. Two
skill packs sync on push to `main`:

- **`forwardimpact/fit-skills`** — `fit-*` skills for the framework products.
- **`forwardimpact/kata-skills`** — `kata-*` skills for the Kata Agent Team.

External users install with `npx skills add forwardimpact/fit-skills` (or
`kata-skills`). Each published skill should teach agents how a product **works**
and how to **use** it — not how it is **implemented**. Progressively disclose:
start with what the product does, then link to published docs. External users
have no monorepo access — use fully qualified URLs to `.md` pages (e.g.
`https://www.forwardimpact.team/docs/guides/authoring-frameworks/index.md`).

External users install products with `npm install`, bringing their own framework
data. All CLIs use `#!/usr/bin/env node` — no Bun required.

Products using gRPC (currently Guide) require generated clients. External users
run `npx fit-codegen --all` after install — generated code is
installation-specific, never bundled in npm packages. See
[Codegen Internals](websites/fit/docs/internals/codegen/index.md).

### How Internal Contributors Develop

- **External users** — Node.js + npm, run `npx fit-*`.
- **Internal contributors** — Bun 1.2+ + bun, run `bunx fit-*` and `just`.

`just codegen` (included in `just quickstart`) runs `fit-codegen` internally.
Internal skills (`libs-*`, product internals) help contributors understand
architecture — these are never published. External-facing docs use `npm`/`npx`;
`bun`/`bunx`/`just` appear only in internal docs.

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
`.claude/skills/kata-*/SKILL.md`.

## Memory and Coordination

Wiki is **memory** — own state (summaries, logs, metrics), not a handoff
channel. **Coordination** requires a named receiver and addressable artifact:
Issue, PR/issue comment, Discussion, or `agent-react`. See
[memory-protocol](.claude/agents/references/memory-protocol.md) and
[coordination-protocol](.claude/agents/references/coordination-protocol.md).

## Domain Concepts

Framework entities are defined in YAML under
[products/map/starter/](products/map/starter/) (the monorepo's starter template,
which installs to `data/pathway/` in consuming projects). Use
`bunx fit-pathway <entity> --list` to discover available values.

- **Disciplines** — `disciplines/{id}.yaml`
- **Levels** — `levels.yaml`
- **Tracks** — `tracks/{id}.yaml`
- **Capabilities** — `capabilities/{id}.yaml`
- **Skills** — `capabilities/{id}.yaml` (under `skills:`)
- **Behaviours** — `behaviours/{id}.yaml`
- **Drivers** — `drivers.yaml`

All entities use co-located `human:` and `agent:` sections. Skill agent sections
use flat `agent.focus`, `agent.readChecklist`, and `agent.confirmChecklist`
fields.

- **Skill proficiencies**: awareness → foundational → working → practitioner →
  expert
- **Behaviour maturities**: emerging → developing → practicing → role_modeling →
  exemplifying
- **Disciplines** define role types with T-shaped skill tiers
  (core/supporting/broad)
- **Tracks** are pure modifiers — adjust expectations via `skillModifiers`
- **Capabilities** group skills and define responsibilities
- **Tools** derived from `toolReferences` at runtime via `bunx fit-pathway tool`

Validate data: `bunx fit-map validate`. Vocabulary standards in the
[Authoring Frameworks guide](websites/fit/docs/guides/authoring-frameworks/index.md).

## Documentation Map

One home per policy; per-product pages: [§ Products](#products).

**Internal:**

- **Project identity & orientation** — [CLAUDE.md](CLAUDE.md)
- **Contribution standards & security** — [CONTRIBUTING.md](CONTRIBUTING.md)
- **Kata Agent Team** — [KATA.md](KATA.md) ·
  [Internals](websites/fit/docs/internals/kata/)
- **Codegen pipeline** — [Codegen](websites/fit/docs/internals/codegen/)

**External:**

- **Getting started** — [Getting Started](websites/fit/docs/getting-started/)
- **User guides** — [websites/fit/docs/guides/](websites/fit/docs/guides/)
- **Published skills** — [fit-\*](.claude/skills/) · [kata-\*](.claude/skills/)

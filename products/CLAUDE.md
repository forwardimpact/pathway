# Products

Conventions when working under `products/`. Products are the six end-user
applications (Map, Pathway, Guide, Landmark, Summit, Outpost) consumed via
`npm install` and `npx fit-<product>`. This file documents the rules a product
CLI must follow so external readers land on consistent docs from any entry
point.

## Audience

The primary audience for product CLIs and their matching skills is **external
engineers, leaders, and agents** who have limited context and no direct access
to this monorepo. They reach a tool via `npx fit-<product>` or by loading the
matching skill — without ever cloning the repo.

Write `--help` output, skill instructions, and published guides for that reader:
self-contained, no insider tooling references, no relative paths into
`products/` or `websites/`, and every doc link a fully-qualified public URL.

## Invocation context

Products with both a web UI and a CLI can share handler logic through
`InvocationContext` — a frozen `{ data, args, options }` contract that libui's
`createBoundRouter` produces from the URL and libcli's `dispatch()` produces
from argv. Use `defineRoute` to bind a URL pattern to its CLI command and graph
entity in one descriptor; the shared presenter receives the same context shape
from both surfaces. See the
[CLI Development guide](websites/fit/docs/internals/libcli/index.md) for the
full contract.

## CLIs and progressive documentation

Every product ships a CLI (a `bin/` entry in `package.json`). Three artifacts
must exist together so an external reader lands on the same docs from any entry
point:

- One or more **user guides** — markdown sources under
  `websites/fit/docs/products/<task-slug>/index.md`. A product may carry
  multiple task guides (e.g. `fit-pathway` links to `authoring-standards`,
  `agent-teams`, and `career-paths`).
- The **skill** — `.claude/skills/fit-<product>/SKILL.md`.
- The **CLI `--help`** — `documentation` entries on the libcli definition, one
  per linked guide.

### Linking rule

Skill and CLI both link each guide using the **fully-qualified URL of the
markdown source**:

```
https://www.forwardimpact.team/docs/products/<task-slug>/index.md
```

Slugs are task-shaped (e.g. `authoring-standards`, `team-capability`), not
product-name-shaped — one product may host multiple task slugs and one task slug
may cut across multiple products (e.g. `authoring-standards` is linked by both
`fit-map` and `fit-pathway`).

The `.md` extension is deliberate. Agents fetch markdown more reliably than
rendered HTML, and the `.md` URL maps one-to-one to the source file in
`websites/fit/docs/products/<task-slug>/index.md`. Use the same title and URL
across all three artifacts. Library-task guides (the builder/agent audience)
live under `/docs/libraries/` instead — see
[libraries/CLAUDE.md](../libraries/CLAUDE.md) for that policy. A product CLI may
cross-link to a library guide when the task naturally cuts across both
audiences.

### Worked example: `fit-foo` with one guide `bar`

Guide source: `websites/fit/docs/products/bar/index.md`.

Skill (`.claude/skills/fit-foo/SKILL.md`) carries this `## Documentation` block:

```markdown
## Documentation

- [Bar Guide](https://www.forwardimpact.team/docs/products/bar/index.md) —
  how to use `fit-foo` to do bar.
```

CLI definition (libcli) carries the same link:

```js
const cli = createCli({
  name: "fit-foo",
  documentation: [
    {
      title: "Bar Guide",
      url: "https://www.forwardimpact.team/docs/products/bar/index.md",
      description: "How to use fit-foo to do bar.",
    },
  ],
});
```

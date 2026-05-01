# Libraries

Conventions when working under `libraries/`. The catalog itself lives in
[README.md](README.md); this file documents the metadata that drives it and the
rules a CLI-shipping library must follow.

## Audience

The primary audience for library CLIs and their matching skills is **external
agents and engineers** who have limited context and no direct access to this
monorepo. They reach a tool via `npx fit-<name>` or by loading the matching
skill — without ever cloning the repo.

Write `--help` output, skill instructions, and published guides for that reader:
self-contained, no insider tooling references, no relative paths into
`libraries/` or `websites/`, and every doc link a fully-qualified public URL.

## `package.json` structure

Every library carries metadata the catalog generators consume. Required fields:

- **`description`** — capability-led, one sentence, agent angle baked in.
  Becomes the row in [README.md](README.md). Markdown is allowed — use backticks
  for cross-library references, code, or paths so the rendered table reads
  cleanly.
- **`keywords`** — 4–6 lowercase tokens. First token is the primary capability
  noun (`cli`, `storage`, `vector`); last is always `agent`.
- **`forwardimpact.capability`** — exactly one of `agent-capability`,
  `agent-retrieval`, `agent-self-improvement`, `agent-infrastructure`, or
  `foundations`. Determines the catalog category.
- **`forwardimpact.needs`** — array of "I need to…" phrases for the flat index
  in [README.md](README.md). Each phrase must be unique across the monorepo (the
  generator fails on duplicates). Keep entries imperative and outcome-shaped,
  not feature-shaped (`Compute a stable hash`, not `generateHash function`).

After editing any of these, regenerate the catalog:

```sh
bun run lib:capabilities
bun run lib:needs
```

`bun run check` refuses a stale catalog and points at the right command.

## CLIs and progressive documentation

If a library ships a CLI (a `bin/` entry in `package.json`), three artifacts
must exist together so an external reader lands on the same docs from any entry
point:

- The **user guide** — markdown source at
  `websites/fit/docs/guides/<name>/index.md`.
- The **skill** — `.claude/skills/fit-<name>/SKILL.md`.
- The **CLI `--help`** — `documentation` entry on the libcli definition.

### Linking rule

Skill and CLI both link the guide using the **fully-qualified URL of the
markdown source**:

```
https://www.forwardimpact.team/docs/guides/<name>/index.md
```

The `.md` extension is deliberate. Agents fetch markdown more reliably than
rendered HTML, and the `.md` URL maps one-to-one to the source file in
`websites/fit/docs/guides/<name>/index.md`. Use the same title and URL across
all three artifacts.

### Worked example: `fit-foo`

Guide source: `websites/fit/docs/guides/foo/index.md`.

Skill (`.claude/skills/fit-foo/SKILL.md`) carries this `## Documentation` block:

```markdown
## Documentation

- [Foo Guide](https://www.forwardimpact.team/docs/guides/foo/index.md) — how
  to use `fit-foo`.
```

CLI definition (libcli) carries the same link:

```js
const cli = createCli({
  name: "fit-foo",
  documentation: [
    {
      title: "Foo Guide",
      url: "https://www.forwardimpact.team/docs/guides/foo/index.md",
      description: "How to use fit-foo.",
    },
  ],
});
```

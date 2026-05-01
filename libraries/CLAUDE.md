# Libraries

Conventions when working under `libraries/`. The catalog itself lives in
[README.md](README.md); this file documents the metadata that drives it and the
rules a CLI-shipping library must follow.

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

If a library ships a CLI (a `bin/` entry in `package.json`), all three of the
following must exist — none alone is sufficient:

1. **A user guide** at `websites/fit/docs/guides/<slug>/index.md`. Written for
   the external user, not the contributor. Same standards as the rest of
   `websites/fit/`.
2. **A `fit-*` skill** at `.claude/skills/fit-<slug>/SKILL.md`. The skill's
   `## Documentation` section links the guide with the fully-qualified URL
   `https://www.forwardimpact.team/docs/guides/<slug>/index.md` (external users
   have no monorepo access — see [root CLAUDE.md](../CLAUDE.md)).
3. **A `documentation` entry on the libcli definition** so `--help` and
   `--help --json` surface the same link. Both `libcli` and `librepl` render it
   under `Documentation:` automatically:

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

The skill, the CLI help, and the published guide must share the same title and
URL. Progressive discovery: an agent that hits the CLI cold sees the guide link
in `--help`; an agent that loads the skill sees the same link; either path lands
on the same authoritative document.

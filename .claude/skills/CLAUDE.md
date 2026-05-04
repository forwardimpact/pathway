# Skills

Conventions when working under `.claude/skills/`.

## Published vs internal

Skills prefixed `fit-*` and `kata-*` are published to external consumers via
skill packs. Internal skills (used only by the monorepo's own agents) have no
prefix convention.

## `## Documentation` section

Every `fit-*` skill that has a matching CLI (`npx fit-<name>`) must end with a
`## Documentation` section listing guides as markdown links:

```markdown
## Documentation

- [Guide Title](https://www.forwardimpact.team/docs/<area>/<slug>/index.md)
  — One-sentence description
```

URLs are fully-qualified paths to the markdown source on
`www.forwardimpact.team`. Use the `.md` extension — agents fetch markdown more
reliably than rendered HTML.

## Parity with CLIs

The skill's `## Documentation` list and the CLI's `documentation` array
(defined in the libcli config) must carry **the same entries in the same
order** — same titles, same URLs. When you add, remove, or rename a link in
one, update the other in the same commit.

The CLI lives at:
- Products: `products/<name>/bin/fit-<name>.js`
- Libraries: `libraries/lib<name>/bin/fit-<name>.js`

See [libraries/CLAUDE.md](../../libraries/CLAUDE.md) and
[products/CLAUDE.md](../../products/CLAUDE.md) for the full linking rule,
worked examples, and the JTBD guide structure (Big Hire / Little Hire).

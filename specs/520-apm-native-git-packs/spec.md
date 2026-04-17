# 520 — Native APM Support for Pathway Agent Team Packs

## Problem

Organizations deploying Pathway cannot install agent team packs through
Microsoft APM. A customer running `apm install` against the documented command
receives:

```
$ apm install --verbose https://pathway.bench.pfizer/packs/se-forward-deployed.tar.gz
[*] Validating 1 package...
  Trying git ls-remote for pathway.bench.pfizer
  git ls-remote rc=128: fatal: repository '...' not found
[x] https://pathway.bench.pfizer/packs/se-forward-deployed.tar.gz -- not accessible
```

APM packages are git repositories. `apm install` resolves every argument —
whether `owner/repo`, `host/path`, or full HTTPS URL — through `git ls-remote`.
It has no tarball-URL code path. The command Pathway generates
(`apm install <siteUrl>/packs/<name>.tar.gz`) is structurally impossible for APM
to process.

Three separate issues compound the failure:

1. **Wrong command.** `getApmInstallCommand` emits a tarball URL that APM cannot
   resolve. APM accepts git repo references (`owner/repo`,
   `gitlab.com/org/repo`, `host/path`), not download links.

2. **Wrong manifest format.** `writeApmManifest` emits a custom `apm.yml` with
   a `skills:` array containing `url:` and `digest:` fields. APM's actual
   `apm.yml` is a project-level manifest listing dependencies as git repository
   references under `dependencies.apm:`. The generated file is not a valid APM
   manifest and APM ignores it.

3. **Wrong pack layout.** APM packages use an `.apm/` internal structure
   (`.apm/skills/`, `.apm/agents/`) that APM maps to target directories
   (`.claude/skills/`, `.claude/agents/`) during install. Pathway packs contain
   the deployed `.claude/` layout directly, which APM does not recognize as
   package content.

The `npx skills` path and `curl | tar` extraction continue to work. Only the
APM integration — one of the two ecosystem channels spec 320 established — is
broken.

## Why

### APM adoption is growing and Pathway is invisible to it

APM's install model is git-native: if a URL resolves via `git ls-remote`, APM
can install it. Organizations already using APM for prompt and skill management
expect `apm install <host>/packs/<name>` to work like any other package. The
current failure means Pathway packs cannot participate in APM dependency trees,
lockfiles, or security scanning.

### The existing deployment model already supports the required transport

APM resolves packages over HTTPS. Git's dumb HTTP protocol fetches objects and
refs as plain files — no server-side git process required. Any static host
(GitHub Pages, Cloudflare Pages, S3, Netlify) can serve these files. The Pathway
build already emits to a static output directory; adding bare repos alongside
the existing tarballs and `.well-known/` directories requires no hosting
changes.

### The pack content already exists in the right shape

APM's multi-skill package format stores skills under `.apm/skills/{name}/` and
agents under `.apm/agents/`. Pathway packs already contain these same files
under `.claude/skills/` and `.claude/agents/`. The transformation is a prefix
change, not a content change.

## What

Extend the Pathway build to emit a bare git repository for each agent team pack
so that `apm install <host>/packs/<name>` works natively through APM's
git-based resolution, alongside the existing tarball and `npx skills` channels.

### Requirements

1. **One bare git repo per pack.** `fit-pathway build` must produce a bare git
   repository at `packs/{name}/` for each valid discipline/track combination.
   The repository must be clonable over dumb HTTP from the static site.

2. **APM-compatible package layout.** Each repository's committed tree must use
   APM's package structure: skills under `.apm/skills/{name}/`, agents under
   `.apm/agents/`, and an `apm.yml` at the root. APM must recognize the package
   and deploy its contents to `.claude/` (or the active target) during
   `apm install`.

3. **Native install command.** `getApmInstallCommand` must produce a command of
   the form `apm install <host>/packs/<name>` that APM resolves through its
   standard git-based flow. No `curl`, no `tar`, no workaround.

4. **Valid site-root `apm.yml`.** The `apm.yml` emitted at the site root must be
   a valid APM project manifest with pack repos listed under `dependencies.apm`
   so that `apm install` in a directory containing that manifest resolves all
   packs.

5. **Coexistence with existing channels.** The `.well-known/skills/` structure
   for `npx skills` and the `.tar.gz` archives for direct extraction must
   continue to be emitted alongside the bare git repos. No existing install
   path may break.

6. **Deterministic, reproducible repositories.** Two builds of the same
   framework data at the same Pathway version must produce byte-identical bare
   repositories. Commit metadata (author, committer, timestamps, message) must
   be fixed at build time so that identical input always produces identical
   output.

### Scope

**Affected capabilities:**

- Pack generation pipeline — must emit bare git repos alongside tarballs
- Install command derivation — must produce native `apm install` commands
- Site-root manifest — must become a valid APM project manifest

**Not affected:**

- `npx skills` discovery (`.well-known/` structure unchanged)
- `install.sh` / `bundle.tar.gz` (CLI install path unchanged)
- Agent/skill derivation logic (content unchanged, only layout restructured)

### Content coverage

APM's primitive types cover skills (`.apm/skills/`) and agents
(`.apm/agents/`). Each skill's `scripts/`, `references/`, and other bundled
resources are carried alongside `SKILL.md` and remain accessible after install.

Two files in the current pack have no usable APM primitive:

- **`CLAUDE.md`** (team instructions) — APM's instructions primitive deploys to
  `.claude/instructions/`, which Claude Code does not read. Consumers must use
  the tarball path for team instructions.
- **`settings.json`** (Claude Code settings) — no APM primitive exists.
  Consumers must use the tarball path for settings.

The agent builder UI should note that `apm install` delivers skills and agent
profiles but not team instructions or settings.

### Success criteria

1. `apm install <deployed-site-host>/packs/<name>` installs skills and agent
   profiles into `.claude/` of the consumer's project. The installed skills and
   agents are content-identical to the canonical pack output for the same
   discipline/track combination.

2. `git ls-remote <deployed-site-url>/packs/<name>` succeeds and returns at
   least one ref pointing at a valid commit.

3. The `apm.yml` at the site root is a valid APM project manifest. Running
   `apm install` in a directory seeded with that manifest resolves all pack
   repositories.

4. The `.well-known/skills/index.json` manifests and `.tar.gz` archives
   continue to be emitted with identical content to the pre-change build
   (modulo the `--no-recursion` archive fix).

5. Two builds of the same input produce byte-identical bare repositories,
   tarballs, and manifests.

## Out of Scope

- **Publishing to the APM marketplace.** Listing packs in a central registry is
  a separate effort. This spec requires only that URL-based `apm install` works.
- **Smart HTTP git server.** Dumb HTTP (static files) is sufficient. No
  server-side git process, CGI, or middleware.
- **APM lockfile integration.** Consumers manage their own `apm.lock.yaml`. The
  build does not emit lockfiles inside pack repos.
- **`settings.json` distribution via APM.** No APM primitive exists. The tarball
  remains the distribution path for settings.
- **Hosting configuration.** The build emits files; deployment is the
  organization's responsibility. No changes to CI/CD pipelines or static host
  configuration.

## References

- Spec 320 — Pathway Ecosystem Distribution (parent spec, `plan implemented`)
- [APM documentation](https://microsoft.github.io/apm/) — package format,
  install resolution, dumb HTTP support
- [APM sample package](https://github.com/microsoft/apm-sample-package) —
  canonical `.apm/` directory layout
- `products/pathway/src/commands/build-packs.js` — current pack generation
- `products/pathway/src/pages/agent-builder-install.js` — install command
  derivation
- Customer report: `apm install` failure against
  `pathway.bench.pfizer/packs/se-forward-deployed.tar.gz`

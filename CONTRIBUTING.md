# Contributing

## Getting Started

```sh
bun install
just quickstart
```

`ANTHROPIC_API_KEY` is available in the shell environment — no manual key
configuration needed. `libconfig` reads it automatically.

## Core Rules

Organized by _when_ they apply, following Atul Gawande's _Checklist Manifesto_
(Ch. 6). **READ-DO**: read each item, then do it. **DO-CONFIRM**: do from
memory, then pause and confirm.

### Invariants

Architectural non-negotiables — the shape of the codebase.

- **OO+DI everywhere** — Classes accept collaborators through constructors.
  Factory functions (`createXxx`) wire real implementations. Composition roots
  (CLI `bin/` entry points) wire all instances. Tests bypass factories and
  inject mocks directly. No module-level singletons, no inline dependency
  creation. Exceptions: libskill (pure functions), libui (functional DOM),
  libsecret (stateless crypto), libtype (generated protobuf) — pure stateless
  functions do not need DI.
- **No frameworks** — Vanilla JS, ESM modules only, no CommonJS.

### READ-DO

Entry gate — read every item before starting.

<read_do_checklist goal="Internalize constraints before writing code">

- [ ] **Understand the task.** What is it actually asking? Which files will I
      touch, and which will I not?
- [ ] **Smallest plan.** No unrequested features, abstractions, or refactors. If
      it isn't asked for, don't add it.
- [ ] **Read the code** I'm about to change before writing.
- [ ] **Search shared libraries first.** Before writing a helper, utility, retry
      wrapper, argument parser, or any other generic capability, search
      `libraries/` and the `libs-*` skill group that covers the task. If a
      shared library already provides the capability, use it. If not, note that
      in the commit or plan so future contributors don't re-search.
- [ ] **Simple over easy.** Reduce complexity, don't relocate it. Three similar
      lines beat a premature abstraction. If tempted to extract a helper for a
      single use, inline it. If tempted to add configuration for a single
      consumer, hardcode it.
- [ ] **No defensive code.** Trust the architecture — let errors surface. No
      try/catch "just to be safe," no optional chaining on data that isn't
      optional.
- [ ] **Clean breaks.** Delete old code as you write new — in one commit. No
      shims, aliases, or feature flags for the old path. If there are no
      consumers yet, remove the old interface entirely.

</read_do_checklist>

### DO-CONFIRM

Exit gate — verify every item before committing.

<do_confirm_checklist goal="Verify quality before committing">

- [ ] `bun run check` passes — format and lint, all file types.
- [ ] `bun run test` passes — new logic has tests.
- [ ] My diff only contains changes the task required — no unrequested
      refactors, no scope creep.
- [ ] Commit format: `type(scope): subject` (see § Git Conventions).

</do_confirm_checklist>

## Structure

### Monorepo layout

```
products/
  map/       # fit-map — data product, validation, schema, starter YAML
  pathway/   # fit-pathway — web app, CLI, formatters
  basecamp/  # fit-basecamp — knowledge system, scheduler, macOS app
  guide/     # fit-guide — LLM agent, artifact interpretation
libraries/
  lib*/      # shared infrastructure and domain libraries
services/
  graph/ mcp/ pathway/ trace/ vector/ web/
config/
  config.json  # service definitions
data/
  synthetic/   # synthetic data DSL and generated artifacts
specs/
  {feature}/   # feature specifications and plans
wiki/          # GitHub wiki (cloned on demand) — shared agent memory
website/       # public site content and docs
```

Git tracks `*.example.*` templates in `config/` — the live files above are
gitignored and created from examples during setup.

### Per-package layout

Every package follows the same on-disk shape (spec 390). Source files live under
`src/`; the package root carries only metadata and published non-source assets.

```
<package>/
  package.json     Required
  justfile         Per-package task runner (optional)
  src/             All source files (index.js + any domain subdirs)
  bin/             One file per declared CLI binary — thin entry points only
  config/          Checked-in configuration files (optional)
  macos/           Packaged macOS app bundle, if the package ships one (optional)
  pkg/             Packaging / distribution artifacts, non-source (optional)
  proto/           Protobuf source files (optional)
  schema/          Published schemas (JSON Schema, SHACL, etc.) (optional)
  starter/         Starter data that installs to a consumer's data dir (optional)
  supabase/        Supabase edge project (optional)
  templates/       Template files consumed at runtime (optional)
  test/            Test files
```

Allowed root directories: `bin/`, `config/`, `macos/`, `pkg/`, `proto/`,
`schema/`, `src/`, `starter/`, `supabase/`, `templates/`, `test/`. Source files
live under `src/` — no `.js` or `.ts` files at the package root.

`bin/` holds one file per CLI binary — thin scripts that parse argv and hand off
to `src/`. Subcommand handlers live under `src/commands/`, package-internal
helpers under `src/lib/`.

Published `package.json` `main`, `bin`, and `exports` point at `src/`. Consumers
import via subpath aliases (`@forwardimpact/libskill/derivation`) which the
`exports` map resolves to `./src/derivation.js`. No build step, no root-level
proxy file.

### Services — the one exception

Services keep `index.js` and `server.js` at the package root (loaded by fixed
path from `config/config.example.json`), plus `proto/`, `src/`, `test/`, and
`package.json`. No `bin/` directory, no `src/index.js`.

## Pull Request Workflow

All changes go through pull requests — never push directly to `main`.

**Always commit your work before finishing a task.**

**Exception:** The release engineer may push trivial CI fixes (formatting, lint,
lock file drift) directly to `main` — limited to what `bun run check:fix` can
resolve. See
[.claude/agents/release-engineer.md](.claude/agents/release-engineer.md).

## Git Conventions

Format: `type(scope): subject`

- **Types**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `spec`
- **Scope**: package name (`map`, `libskill`, `libui`, `pathway`, `basecamp`),
  or domain area (`security`) for specs
- **Breaking**: add `!` after scope

`spec` is for new specification documents in `specs/` (e.g.
`spec(security): Supabase edge function hardening`).

### Releasing

Tag prefix matches the directory name: `libraries/libfoo` → `libfoo@v0.1.5`,
`products/pathway` → `pathway@v0.25.0`, `services/graph` → `svcgraph@v0.1.60`.

Pre-1.0 packages bump patch for any change. Post-1.0: semver (breaking=major,
feat=minor, fix/refactor=patch). The release engineer handles bumps, tagging,
and publishing — see [kata-release-review](.claude/skills/kata-release-review).

## Quality Commands

```sh
bun run check                 # Format and lint — ALL file types (run before every commit)
bun run check:fix             # Auto-fix format and lint issues
bun run test                  # Unit tests (run before every commit)
bun run test:e2e              # Playwright E2E tests (requires generated data)
bunx fit-map validate         # Validate data files
bunx fit-map validate --shacl # Validate with SHACL syntax check
```

## Security

Security policies apply to all contributors — human and agent.

- **ESLint security rules** — `eslint-plugin-security` is enabled in
  [eslint.config.js](eslint.config.js) with all active rules set to `"error"`.
  Two high-noise, low-signal rules (`detect-object-injection`,
  `detect-non-literal-fs-filename`) are turned off. To suppress a security rule
  for a verified false positive, add an inline disable with an audit
  justification:
  ```js
  // eslint-disable-next-line security/detect-unsafe-regex -- <why this is safe>
  ```
  Never use block-level or file-level disables for security rules. Each
  suppression must explain why the flagged code is safe.
- **Vulnerability audit** — `npm audit --audit-level=high` runs in CI (via
  temporary lockfile generation) and gates publish workflows.
- **CI secret scanning** — Gitleaks runs on every push and pull request via the
  `secret-scanning` job in
  [.github/workflows/check-security.yml](.github/workflows/check-security.yml).
- **GitHub Actions** — All third-party actions are pinned to SHA hashes. Use
  `Dependabot` for updates. Never change a pin to a tag.
- **Reporting** — See [SECURITY.md](SECURITY.md). Contact
  `hi.security@senzilla.io`.

## Dependency Policy

- **Prefer built-ins.** Reach for Node.js built-ins before npm packages (`fetch`
  over `undici`, `crypto.randomUUID()` over `uuid`), and consolidate overlapping
  packages — one YAML parser, one markdown renderer.
- **Align versions.** Declare the same range across workspaces. Bun hoists
  packages at the same version to a single copy, which is fine — don't remove a
  runtime dep from a `package.json` just because bun deduplicates.
- **No nested duplicates.** The same package resolved at two major versions
  (e.g. `protobufjs@8` alongside `@grpc/proto-loader/protobufjs@7`) is not
  allowed. Before merging a major version bump, run `bun pm ls` and inspect
  `bun.lock` for `invalid` markers. If a bump forces co-installed packages onto
  a separate version, close the PR until dependents release compatible ranges.
- **Audit after changes.** Run `just audit-vulnerabilities` after adding or
  updating dependencies.

### Classification

Every dependency belongs in one category. Apply in order — first match wins.

- **Always needed** — imported synchronously at load time → `dependencies`
- **Backend-specific** — selected by env var, alternatives exist →
  `optionalDependencies` + dynamic `import()`
- **Feature-gated** — user opts in, core works without it →
  `optionalDependencies` + dynamic `import()`
- **Build-tool** — consumers already have it → `peerDependencies`
- **Build-time only** — `bin/` scripts or codegen only → `devDependencies`

### Optional Dependency Pattern

Backend-specific and feature-gated dependencies must use dynamic `import()` at
the point of use — never at module top — wrapped in `try/catch` that throws
naming the feature, the package, and the exact install command. Never silently
fall back — let the caller decide.

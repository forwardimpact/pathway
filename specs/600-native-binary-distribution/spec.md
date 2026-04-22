# Spec 600 — Native Binary Distribution via Homebrew

## Problem

External users of Forward Impact products must install Node.js before they can
run any `fit-*` CLI. Today's distribution model states this as policy:

> External users — Node.js + npm, run `npx fit-*`.
>
> — [`CLAUDE.md` § Distribution Model](../../CLAUDE.md)

Every published CLI carries a Node shebang that makes this coupling concrete —
for example, `products/pathway/bin/fit-pathway.js` begins:

```
#!/usr/bin/env node
```

The same is true for `fit-map`, `fit-basecamp`, `fit-guide`, `fit-landmark`,
`fit-summit`, and `fit-codegen`. In practice this produces three costs:

1. **Adoption friction on fresh machines.** A new developer evaluating Forward
   Impact on a clean macOS laptop must first install a Node toolchain (nvm,
   Homebrew, Volta, or a vendor installer) before they can run `npx fit-map`.
   Leadership and engineers doing a first-look evaluation pay a setup tax before
   seeing any product value.
2. **Version coupling to the user's Node.** Our CLIs run under whatever Node the
   user happens to have on `PATH`. Breakages caused by old LTS versions, ESM/CJS
   interop drift, or site-installed shims surface as Forward Impact bugs even
   when the cause is the host Node.
3. **A second post-install step for Guide.** `fit-guide` additionally requires
   `npx fit-codegen --all` after install because its gRPC clients are generated,
   installation-specific, and never bundled in the npm package (see
   [Codegen Internals](../../website/docs/internals/codegen/index.md)). The
   smoothest possible install is "install one thing, run it"; today's Guide path
   needs two.

We want a zero-Node install path for macOS developers that installs a single
bundled executable, runs immediately, and does not drag the user's Node version
into our support surface.

## Proposal

Add a **second distribution channel**, alongside (not replacing) the existing
npm channel. External users keep `npm install` / `npx fit-*` as today; new users
on macOS additionally get a zero-Node option via Homebrew.

Three new capabilities:

1. **Native binary build targets.** Each `fit-*` CLI has a single documented
   build entry point that produces a fully-bundled standalone native executable —
   no Node, no Bun, no runtime dependency on user-side tooling. The executables
   cover all seven current CLIs (`fit-map`, `fit-pathway`, `fit-basecamp`,
   `fit-guide`, `fit-landmark`, `fit-summit`, `fit-codegen`). The build toolchain
   and entry-point naming are design decisions.
2. **Release-workflow artifact publishing.** Release automation, triggered on
   release tag, builds the binaries and attaches them to the GitHub release as
   downloadable assets, one per CLI per target triple. The CI platform and
   workflow layout are design decisions.
3. **Homebrew tap distribution.** A Homebrew tap exposes one installable package
   per CLI. Each package installs its matching GitHub release artifact and
   places the binary on the user's `PATH`. Tap location, packaging format
   (cask vs. formula), and release-sync mechanism are design decisions (see
   Open Questions).

The intent is deliberately narrow: preserve every existing install path,
behaviour, and CLI surface unchanged, and add one new way to get the same
executables onto a macOS machine without installing Node.

## Scope

### Included

- All seven `fit-*` CLIs listed above, each buildable as a standalone native
  binary.
- macOS arm64 as the primary and required target at acceptance.
- A release automation workflow that builds the binaries on release tag and
  attaches them to the GitHub release.
- A Homebrew tap with one installable package per CLI.
- Documentation of the brew install flow on the per-product Overview pages
  linked from [`CLAUDE.md` § Products](../../CLAUDE.md) for every affected
  product.
- A zero-second-step install for `fit-guide`. A brew-installed `fit-guide` must
  be usable immediately after install with no additional command from the user —
  no `npm install`, no `npx fit-codegen`, no PATH-dependent toolchain step. The
  mechanism (whether generated artifacts ship inside the binary, whether
  `fit-codegen` is invoked transparently, or another approach) is a design
  decision.

### Excluded (explicit non-goals)

- **Windows support.** Not in this spec. A separate spec can revisit after the
  macOS path is proven.
- **Linux distribution.** Whether Linux users get Linuxbrew, apt/dnf packaging,
  raw tarballs, or none of the above is out of scope. Linux users continue via
  the existing npm channel for now.
- **Code signing and notarization.** Unsigned binaries will trigger Gatekeeper
  warnings on macOS that the user must acknowledge before first run. The
  security and UX implications are real but resolving them — Developer ID
  certificate, notarization pipeline, hardened runtime, stapling — is deferred
  to a follow-up spec. This spec must not claim signing as complete.
- **Replacing or modifying the existing npm channel.** `npm install` /
  `npx fit-*` continues to work identically. No CLI is removed from npm, no
  shebang is rewritten, and no existing user workflow changes.
- **Auto-update mechanism inside the binaries.** Users upgrade via
  `brew upgrade`; in-process self-update is not in scope.

## Success Criteria

1. A single documented build entry point produces a standalone macOS arm64
   native binary for each of the seven `fit-*` CLIs. Each binary runs its
   `--help` successfully on a macOS arm64 machine that has neither `node` nor
   `bun` on `PATH`.
2. A release-automation workflow, triggered by a release tag, builds the full
   binary set and attaches the binaries to the GitHub release as downloadable
   assets, with a deterministic asset-name scheme that identifies the CLI and
   target triple.
3. A Homebrew tap contains one installable package per CLI. Each package
   references the GitHub release artifact for the CLI and target triple.
4. On a clean macOS arm64 machine with Homebrew installed but no Node and no
   Bun, running `brew install <tap>/fit-<cli>` for each of the seven CLIs
   leaves each corresponding `fit-<cli>` command on `PATH` answering `--help`.
   The concrete tap path is fixed by design.
5. After installing `fit-guide` exclusively via brew — no npm, no post-install
   command — the user can run `fit-guide --help` and every user-visible
   command documented in the [Guide Overview](../../website/guide/index.md) with
   no additional install step. No `fit-codegen` invocation, `npm install`, or
   toolchain step is required from the user between `brew install` and first
   successful command.
6. Every per-product Overview page linked from [`CLAUDE.md` § Products](../../CLAUDE.md)
   for a CLI in scope carries a "Install" section (or equivalent) that
   documents the brew install command alongside the existing npm flow.
7. The existing npm distribution is unchanged: for each of the seven CLIs,
   `npm install` followed by `npx fit-<cli> --help` succeeds on a reference
   Node LTS environment after the release that ships the brew channel. No
   `bin` script, `package.json` `bin` entry, or shebang has changed.

## Open questions

Each item below is a decision the design must make; none block the spec.

- **Cross-compile strategy.** Build natively on macOS arm64 runners only
  (single-arch matrix), or matrix across multiple runner architectures for
  future-proofing. Affects workflow cost and cross-compile risk.
- **Signing and notarization timing.** Defer entirely to a follow-up spec (this
  spec's current stance) vs. land a minimal signed-but-unnotarized path now.
  Design must document the user-visible Gatekeeper experience under whichever
  option is chosen.
- **Tap repository location.** A separate Forward Impact tap repo published to
  from this monorepo, vs. a tap subdirectory inside the monorepo that a release
  job syncs outward. Affects release automation and tap discoverability.
- **Version sync between npm and brew.** How a release tag that publishes to
  npm also updates package hashes and version strings in the tap — one
  workflow, two workflows, or a follow-up job. Design must state the mechanism
  so a single release does not leave the two channels on different versions.
- **Non-arm64 macOS and Linux behaviour.** Whether `brew install` on a
  non-arm64 macOS machine or on Linuxbrew fails fast with a clear message,
  falls back to advising the npm path, or ships an Intel/Linux build. The spec
  requires arm64-only at acceptance; the failure mode on other architectures is
  a design decision.
- **`fit-guide` codegen mechanism.** The spec requires zero second-step install
  for `fit-guide`; the design chooses between bundling generated artifacts into
  the binary, having `fit-guide` invoke a bundled `fit-codegen` transparently,
  or another approach. Affects offline usability and artifact size.

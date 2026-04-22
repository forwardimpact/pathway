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

1. **Native binary build targets.** Each `fit-*` CLI has a justfile recipe that
   produces a fully-bundled standalone native executable — no Node, no Bun, no
   runtime dependency on user-side tooling. The executables cover all seven
   current CLIs (`fit-map`, `fit-pathway`, `fit-basecamp`, `fit-guide`,
   `fit-landmark`, `fit-summit`, `fit-codegen`).
2. **Release-workflow artifact publishing.** A GitHub Actions workflow,
   triggered on release tag, builds the binaries and attaches them to the GitHub
   release as downloadable assets, one per CLI per target triple.
3. **Homebrew tap with cask formulae.** A Homebrew tap exposes a cask per CLI.
   Each cask installs its matching GitHub release artifact and places the binary
   on the user's `PATH`. The tap's location and release-sync mechanism are
   design decisions (see Open Questions).

The intent is deliberately narrow: preserve every existing install path,
behaviour, and CLI surface unchanged, and add one new way to get the same
executables onto a macOS machine without installing Node.

## Scope

### Included

- All seven `fit-*` CLIs listed above, each buildable as a standalone native
  binary.
- macOS arm64 as the primary and required target at acceptance.
- A GitHub Actions release workflow that builds the binaries on release tag and
  attaches them to the GitHub release.
- Homebrew cask formulae — one per CLI — in a Forward Impact tap.
- Documentation of the brew install flow on the website overview pages for each
  affected product (the per-product Overview pages linked from
  [`CLAUDE.md` § Products](../../CLAUDE.md)).
- A stated story for the `fit-guide` codegen dependency so a brew-installed
  `fit-guide` is usable without the user reaching back into npm. The story picks
  one of: (a) `fit-codegen` itself is a standalone native binary the user can
  invoke, (b) brew-installed `fit-guide` ships the generated artifacts it needs,
  or (c) another approach documented in design. The selection is a WHAT; the HOW
  is a design decision.

### Excluded (explicit non-goals)

- **Windows support.** Not in this spec. A separate spec can revisit after the
  macOS path is proven.
- **Linux distribution.** Whether Linux users get Linuxbrew, apt/dnf packaging,
  raw tarballs, or none of the above is out of scope. Linux users continue via
  the existing npm channel for now.
- **Code signing and notarization.** Unsigned binaries will trigger Gatekeeper
  warnings on macOS and need a user-side bypass (right-click open, or
  `xattr -d com.apple.quarantine`). The security and UX implications are real
  but resolving them — Developer ID certificate, notarization pipeline, hardened
  runtime, stapling — is deferred to a follow-up spec. This spec must not claim
  signing as complete.
- **Replacing or modifying the existing npm channel.** `npm install` /
  `npx fit-*` continues to work identically. No CLI is removed from npm, no
  shebang is rewritten, and no existing user workflow changes.
- **Auto-update mechanism inside the binaries.** Users upgrade via
  `brew upgrade`; in-process self-update is not in scope.

## Success Criteria

1. A single justfile entry point (working name `just build-binaries`) produces a
   standalone macOS arm64 native binary for each of the seven `fit-*` CLIs. Each
   binary runs its `--help` successfully on a macOS arm64 machine that has
   neither `node` nor `bun` on `PATH`. Each binary sits within a size ceiling
   agreed in design (low tens to low hundreds of MB is expected for
   fully-bundled runtimes; the exact ceiling is a design decision).
2. A GitHub Actions workflow, triggered by a release tag, builds the full binary
   set and attaches the binaries to the GitHub release as downloadable assets,
   with a deterministic asset-name scheme that identifies the CLI and target
   triple.
3. A Homebrew tap (working name `forwardimpact/homebrew-tap`) contains one cask
   formula per CLI. Each formula references the GitHub release artifact for the
   CLI and target triple.
4. On a clean macOS arm64 machine with Homebrew installed but no Node and no
   Bun, `brew install forwardimpact/tap/fit-pathway` results in a working
   `fit-pathway` command on `PATH` that answers `fit-pathway --help`.
   **Stretch:** the equivalent command works for every one of the seven CLIs.
5. `fit-guide` installed exclusively via brew — no npm, no post-install `npx`
   step required from the user — is able to complete whatever codegen or
   artifact setup it needs and answer a framework question. The spec commits to
   one of the three options listed under Scope § Included; the implementation
   follows the chosen option.
6. The per-product Overview pages on the website describe the brew install flow
   for each affected product alongside the existing npm flow.

## Open questions

Each item below is a decision the design must make; none block the spec.

- **Cross-compile strategy.** Build natively on macOS arm64 runners only
  (single-arch matrix), or matrix across multiple runner architectures for
  future-proofing. Affects workflow cost and cross-compile risk.
- **Signing and notarization timing.** Defer entirely to a follow-up spec (this
  spec's current stance) vs. land a minimal signed-but-unnotarized path now.
  Design must document the user-visible Gatekeeper experience under whichever
  option is chosen.
- **Tap repository location.** A separate `forwardimpact/homebrew-tap` repo
  published to from this monorepo, vs. a tap subdirectory inside the monorepo
  that a release job syncs outward. Affects release automation and tap
  discoverability.
- **Version sync between npm and brew.** How a release tag that publishes to npm
  also updates cask SHAs and version strings in the tap — one workflow, two
  workflows, or a follow-up job. Design must state the mechanism so a single
  release does not leave the two channels on different versions.
- **Non-arm64 macOS behaviour.** Whether `brew install forwardimpact/tap/...` on
  a non-arm64 machine fails fast with a clear message, falls back to advising
  the npm path, or ships an Intel build. The spec requires arm64-only at
  acceptance; the failure mode on other architectures is a design decision.
- **`fit-codegen` runtime behaviour.** If `fit-codegen` becomes a standalone
  binary that `fit-guide` can invoke, whether it ships its proto and template
  inputs bundled inside the executable or fetches them over the network at first
  run. Affects offline usability and artifact size.

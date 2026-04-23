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

Four new capabilities:

1. **macOS `.app` bundle build targets.** Every compiled artifact ships as a
   real macOS `.app` bundle, not a bare Mach-O. Three categories of bundle are
   produced: (a) one per-product bundle for each of the six products
   (`fit-basecamp.app`, `fit-guide.app`, `fit-landmark.app`, `fit-map.app`,
   `fit-pathway.app`, `fit-summit.app`), (b) a shared `FIT Services.app`
   containing the gRPC servers from `services/`, (c) a shared `FIT Utilities.app`
   containing the library CLIs from `libraries/*` that have a `bin` field
   (including `fit-codegen`, `fit-terrain`, `fit-eval`, and the rest). Each
   bundle carries its own `Contents/Info.plist`, `entitlements.plist`, and
   ad-hoc code signature with a stable `CFBundleIdentifier`. No Node, no Bun,
   no runtime dependency on user-side tooling.
2. **Release-workflow artifact publishing.** Release automation, triggered on
   release tag, builds the bundles and attaches them to the GitHub release as
   downloadable assets, one `.app.zip` per bundle per target triple. The CI
   platform and workflow layout are design decisions.
3. **Homebrew tap distribution.** A Homebrew tap exposes eight cask packages:
   one per product bundle plus `fit-services` and `fit-utilities` for the two
   shared bundles. Each product cask `depends_on` the two shared-bundle casks,
   and every cask's `binary` stanza symlinks the `fit-*` Mach-Os out of
   `Contents/MacOS/` onto the user's `PATH`.
4. **macOS TCC compatibility.** Each bundle carries a stable
   `CFBundleIdentifier`-based designated requirement across rebuilds, declares
   the entitlements bun's JavaScriptCore JIT needs
   (`com.apple.security.cs.allow-jit`,
   `com.apple.security.cs.disable-library-validation`), and exposes any
   `NS*UsageDescription` strings via `Contents/Info.plist` for TCC-gated
   resources the bundle's executables access. Adding Developer ID signing +
   notarization in a follow-up spec is a drop-in **replacement of the signing
   identity**, not a rebuild of the metadata layer.

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
- **Apple Developer ID signing and notarization.** Obtaining a paid Developer
  ID certificate, running `notarytool submit`, stapling, and the
  Gatekeeper-clean first-run experience are deferred to a follow-up spec.
  This spec lands **ad-hoc** signing (`codesign --sign -`) on every bundle
  with correct entitlements and `Contents/Info.plist`, so the follow-up is a
  signing-identity swap only. Unsigned-by-Apple bundles still trigger
  Gatekeeper warnings on first run, which the user must acknowledge. This
  spec must not claim Developer ID signing as complete.
- **TCC prompts for resources no current CLI accesses.** Only `fit-basecamp`
  requests Calendar, Contacts, and Downloads today. The other bundles ship
  with the minimal JIT entitlement set and no usage-description strings.
  Adding new TCC-gated resources to any CLI is a per-bundle change, not a
  spec-600 concern.
- **Symlink-from-Terminal TCC responsibility.** When a user invokes a CLI
  via its PATH symlink (`/usr/local/bin/fit-<cli>` → the `.app` bundle's
  `Contents/MacOS/fit-<cli>`), Terminal becomes the TCC-responsible process
  rather than the bundle. This only matters for CLIs that request
  TCC-gated resources and is out of scope; `fit-basecamp`'s scheduler is
  invoked by `fit-basecamp.app`, not from Terminal, so its TCC grants
  attach to the bundle correctly.
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
   Bun, running `brew install <tap>/fit-<cli>` for each of the seven CLIs leaves
   each corresponding `fit-<cli>` command on `PATH` answering `--help`. The
   concrete tap path is fixed by design.
5. After installing `fit-guide` exclusively via brew — no npm, no post-install
   command — the user can run `fit-guide --help` and every user-visible command
   documented in the [Guide Overview](../../website/guide/index.md) with no
   additional install step. No `fit-codegen` invocation, `npm install`, or
   toolchain step is required from the user between `brew install` and first
   successful command.
6. Every per-product Overview page linked from
   [`CLAUDE.md` § Products](../../CLAUDE.md) for a CLI in scope carries a
   "Install" section (or equivalent) that documents the brew install command
   alongside the existing npm flow.
7. The existing npm distribution is unchanged: for each of the seven CLIs,
   `npm install` followed by `npx fit-<cli> --help` succeeds on a reference Node
   LTS environment after the release that ships the brew channel. No `bin`
   script, `package.json` `bin` entry, or shebang has changed.
8. **Stable bundle identity.** Rebuilding any bundle from the same source tree
   and re-installing via `brew upgrade` on a machine that previously granted a
   TCC permission keeps the grant — the user is not re-prompted. Verified by:
   `codesign -dvvv <Bundle>.app` shows
   `Identifier=com.forwardimpact.<bundle>`, and the bundle's signed cdhash is
   stable across clean rebuilds of the same commit.
9. **Entitlements and Info.plist present on every bundle.** For each of the
   eight bundles (six product bundles, `FIT Services.app`, `FIT Utilities.app`),
   `Contents/Info.plist` contains `CFBundleIdentifier =
   com.forwardimpact.<bundle>` and `CFBundleShortVersionString` matching the
   release tag; `codesign -d --entitlements - <Bundle>.app` prints an
   entitlements plist containing `com.apple.security.cs.allow-jit`.
10. **`fit-basecamp` TCC responsibility chain intact.** The `fit-basecamp.app`
    bundle built through the shared bundle-assembly recipe still inherits TCC
    grants when launched, and its scheduler still disclaims responsibility
    when spawning `claude`. Verified by: Basecamp's existing Calendar and
    Contacts integration continues to work after migrating to the shared
    recipe.
11. **Homebrew cask install adds CLIs to PATH.** After
    `brew install --cask forwardimpact/tap/fit-<product>` for any product,
    both `/Applications/Forward Impact/fit-<product>.app` and
    `/usr/local/bin/fit-<product>` exist, and the CLI answers `--help`
    successfully. The product cask's `depends_on` pulls in the
    `fit-services` and `fit-utilities` casks automatically, leaving the
    shared-bundle CLIs (e.g. `fit-codegen`, `fit-terrain`) on PATH as well.

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
- **Version sync between npm and brew.** How a release tag that publishes to npm
  also updates package hashes and version strings in the tap — one workflow, two
  workflows, or a follow-up job. Design must state the mechanism so a single
  release does not leave the two channels on different versions.
- **Non-arm64 macOS and Linux behaviour.** Whether `brew install` on a non-arm64
  macOS machine or on Linuxbrew fails fast with a clear message, falls back to
  advising the npm path, or ships an Intel/Linux build. The spec requires
  arm64-only at acceptance; the failure mode on other architectures is a design
  decision.
- **`fit-guide` codegen mechanism.** The spec requires zero second-step install
  for `fit-guide`; the design chooses between bundling generated artifacts into
  the binary, having `fit-guide` invoke a bundled `fit-codegen` transparently,
  or another approach. Affects offline usability and artifact size.

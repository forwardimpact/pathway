# Design 600 — Native Binary Distribution via Homebrew

See [`spec.md`](./spec.md) for WHAT/WHY. This document captures WHICH components
exist and WHERE they interact.

## Architecture

```mermaid
graph LR
  MR[monorepo<br/>justfile] -->|bun build --compile| BIN[dist/binaries/<br/>fit-*-darwin-arm64]
  Tag[release tag<br/>cli@vX.Y.Z] -->|triggers| WF[publish-brew.yml]
  WF -->|build on macos-14| BIN
  WF -->|gh release upload| REL[GitHub Release assets]
  WF -->|PR via PAT| TAP[forwardimpact/<br/>homebrew-tap]
  User[macOS arm64 user] -->|brew install| TAP
  TAP -->|cask url| REL
```

Three cooperating surfaces: a **local build pipeline** (justfile + bun) used by
contributors and CI, a **release workflow** that uploads artifacts and opens a
cask-update PR, and a **separate tap repository** users tap. The existing npm
path is untouched.

## Component 1 — Native binary build (justfile)

**Entry point.** Each CLI's existing `bin/fit-<name>.js` is already a runnable
ES module — it becomes the `bun build --compile` entry unchanged. The
`#!/usr/bin/env node` shebang is a no-op in a compiled binary and the npm path
keeps using it, so no source rewrite is needed.

**Recipe shape.** One **parameterized recipe** `build-binary CLI TARGET` drives
`bun build --compile --minify --sourcemap=none --target=bun-<TARGET>`. A
top-level `build-binaries` recipe fans out over the seven CLIs for the default
target (`darwin-arm64`).

| Field          | Value                                                     |
| -------------- | --------------------------------------------------------- |
| Target triple  | `bun-darwin-arm64` (acceptance); `bun-darwin-x64` Phase 2 |
| Output path    | `dist/binaries/<cli>-<os>-<arch>`                         |
| Size ceiling   | 150 MB per binary (bun runtime ~60 MB + app code/deps)    |
| Startup budget | `--help` in < 500 ms cold on an M-series mac              |

**Rejected — one recipe per CLI.** Seven near-identical recipes duplicate the
flag set; a parameterized recipe keeps flags in one place.

**Rejected — `pkg`/`nexe` bundlers.** Bun already produces single-file
executables and is our primary runtime; a second toolchain adds surface for no
gain.

**Codegen as build prerequisite.** `build-binary` depends on `codegen` (the
existing `just codegen` recipe that runs `fit-codegen --all`). Generated gRPC
clients and types land in `generated/` before `bun build --compile`; bun's
bundler follows the import graph and embeds them into the executable. Generated
code is baked into every binary — brew users never run codegen.

**Rejected — lazy codegen at first run.** Requires either embedding protoc (~20
MB + ABI risk) or requiring it on `PATH` (violates zero-dependency promise).

## Component 2 — GitHub Actions release workflow

New workflow: `.github/workflows/publish-brew.yml`.

**Trigger.** Tag push matching `*@v*` — the same pattern `publish-npm.yml` uses.
A single tag fires both workflows in parallel.

**Job matrix.**

| Job              | Runner          | Per CLI | Output                                  |
| ---------------- | --------------- | ------- | --------------------------------------- |
| `build`          | `macos-14`      | matrix  | `fit-<cli>-…-darwin-arm64` + sha256     |
| `release-assets` | `macos-14`      | once    | `gh release upload` for all             |
| `tap-pr`         | `ubuntu-latest` | once    | PR against `forwardimpact/homebrew-tap` |

`macos-14` is GitHub's arm64 runner — native build, no cross-compile risk.
Matrix dimension is **CLI only** (seven parallel jobs); target stays single
until Phase 2.

**Rejected — monolithic build job.** Seven sequential builds add ~5–7 minutes;
matrix parallelism keeps release feedback under 3 minutes.

**Rejected — `release`-event trigger.** Tag push is how npm already fires;
keeping one trigger shape means one `git tag` launches both channels.

**Artifact naming.** `fit-<cli>-<version>-<os>-<arch>` (e.g.
`fit-pathway-0.25.32-darwin-arm64`). Version in the filename keeps old release
assets immutable and gives casks a stable, versioned URL. A matching `.sha256`
sidecar is uploaded alongside each binary via
`shasum -a 256 <file> > <file>.sha256`.

**Interaction with `publish-npm.yml`.** Two independent workflows on the same
trigger; both read `products/<cli>/package.json` for the version, so npm and
brew cannot diverge.

## Component 3 — Homebrew tap and casks

**Tap repository.** Separate repo `forwardimpact/homebrew-tap`. Users run
`brew tap forwardimpact/tap` then `brew install forwardimpact/tap/fit-pathway`.

**Rejected — tap directory inside this monorepo.** Brew only taps repos, not
subdirectories; users would need a brittle custom tap URL. A separate repo also
lets casks be updated without a monorepo PR cycle.

**Cask vs formula.** Casks, not formulae. Formulae compile from source; casks
install prebuilt artifacts. Our binaries ship prebuilt from CI, and casks unlock
`depends_on arch:` gating.

**Cask shape.** One cask per CLI at `Casks/fit-<cli>.rb`:

| Field        | Value                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| `version`    | npm package version (e.g. `"0.25.32"`)                                    |
| `sha256`     | sha256 of the arm64 binary                                                |
| `url`        | `…/releases/download/<cli>@v#{version}/fit-<cli>-#{version}-darwin-arm64` |
| `binary`     | artifact, renamed to `fit-<cli>` on install                               |
| `depends_on` | `arch: :arm64` — blocks install on non-arm64                              |
| `livecheck`  | GitHub Releases API, `<cli>@v*` tag series                                |
| `zap`        | no-op — CLIs are stateless; user data in `data/*` is theirs               |

**Update automation — chosen: PR via PAT.** The `tap-pr` job clones
`forwardimpact/homebrew-tap`, updates `version` and `sha256` in the relevant
`Casks/fit-<cli>.rb`, and opens a PR `chore: bump fit-<cli> to <version>`. Repo
secret `HOMEBREW_TAP_PAT` scopes to the tap repo only.

**Rejected — `homebrew-releaser` action.** Opinionated about formula shape, less
flexible for per-cask `arch` gating, and hides the diff from review.

**Rejected — manual updates.** Guarantees drift between npm and brew versions.

## Component 4 — fit-guide codegen story

The spec leaves the choice open. **This design chooses option (b): the
`fit-guide` binary ships its generated gRPC artifacts baked in** (via Component
1's codegen prerequisite). Bun's compile bundler already embeds `generated/`
imports, so this option adds zero new moving parts.

`fit-codegen` is still built as a standalone binary (spec requires all seven),
but brew users of `fit-guide` never need to invoke it.

**Rejected — option (a) exclusive (fit-guide invokes fit-codegen at first
run).** Requires embedding protoc or finding it on `PATH` — violates the
zero-dependency install promise.

## Component 5 — Non-arm64 macOS behaviour

Casks use `depends_on arch: :arm64`. Homebrew's built-in arch check produces a
standard "Cask depends on hardware: ARM64" error on Intel macs and Linuxbrew —
no bespoke stub needed. Docs add one line: "Intel macOS and Linux users continue
via npm."

**Rejected — custom-stub cask with bespoke error.** Brew's native check is
already clear and discoverable; a stub is code for identical UX.

x64 macOS is not in this spec — reserved for Phase 2. The `bun-darwin-x64`
target is pre-reserved in the parameterized recipe so Phase 2 is a matrix
expansion, not a redesign.

## Component 6 — Version sync (single source of truth)

The **git tag** `<cli>@v<version>` is the single source of truth. Flow:

1. Developer runs release-please (or `git tag cli@vX.Y.Z`).
2. Tag push fires both `publish-npm.yml` and `publish-brew.yml`.
3. `publish-npm.yml` reads `products/<cli>/package.json` and publishes to npm.
4. `publish-brew.yml` reads the same `package.json`, builds binaries, uploads
   release assets, and opens the tap PR using that version.
5. Merging the tap PR makes `brew upgrade` available.

Both workflows read the same file in the same commit — versions cannot diverge,
only timing (tap PR awaits human merge).

## Open questions for plan phase

- **Exact justfile syntax** for the `build-binaries` fan-out over the CLI list.
- **Exact workflow YAML**, including bun-install cache keys across matrix jobs.
- **Tap repo bootstrap**: `forwardimpact/homebrew-tap` creation,
  `HOMEBREW_TAP_PAT` provisioning, seeding initial cask files.
- **Gatekeeper UX copy** on per-product Overview pages — exact
  `xattr -d com.apple.quarantine` guidance (signing is deferred per spec).
- **Release-notes template** — whether `publish-brew.yml` appends a brew install
  snippet to the `gh release` body.

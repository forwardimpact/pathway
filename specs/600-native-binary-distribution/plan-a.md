# Plan 600-A — Native Binary Distribution via Homebrew

See [`spec.md`](./spec.md) for WHAT/WHY and [`design.md`](./design.md) for
WHICH/WHERE. This plan captures HOW to implement and WHEN to sequence changes.

## Approach

The implementation has four steps: build recipes, release workflow, tap
repository, and documentation. Steps 1 and 2 are strictly sequential (the
workflow uses the recipes). Step 3 (tap repo) can run in parallel with steps 1–2
since it creates an external repo with placeholder casks. Step 4 (docs) can run
in parallel with step 3. However, the tap repo and `HOMEBREW_TAP_PAT` secret
must both exist before the first real release tag is pushed — otherwise the
`tap-pr` job fails.

The fit-guide codegen story resolves automatically: `just codegen` runs before
`bun build --compile`, so generated gRPC clients are bundled into every binary
via bun's import-graph traversal. No special handling needed — the existing
`generated/` symlink in `librpc/src/generated` is followed at build time
(confirmed by basecamp's `build-scheduler` recipe in
`products/basecamp/justfile:35`).

**Naming convention (deliberate design divergence).** The design specifies
output path `dist/binaries/<cli>-<os>-<arch>`. This plan uses
`dist/binaries/fit-<cli>-bun-darwin-arm64` as the local build output — the
`bun-` prefix is bun's target triple convention and is required by the
`--target` flag. The `release-assets` job renames to the design's asset naming
scheme (`fit-<cli>-<version>-darwin-arm64`) at upload time.

## Step 1 — Build recipes in justfile

Add a parameterized recipe `build-binary` and a fan-out recipe `build-binaries`
to the root justfile.

### Recipe: `build-binary`

```just
# Build a standalone native binary for a CLI
build-binary CLI TARGET="bun-darwin-arm64":
    #!/usr/bin/env bash
    set -euo pipefail
    # Resolve entry point — products first, then libraries
    ENTRY="products/{{CLI}}/bin/fit-{{CLI}}.js"
    if [ ! -f "$ENTRY" ]; then
      ENTRY="libraries/lib{{CLI}}/bin/fit-{{CLI}}.js"
    fi
    if [ ! -f "$ENTRY" ]; then
      echo "Error: no entry point found for fit-{{CLI}}" >&2
      exit 1
    fi
    mkdir -p dist/binaries
    bun build --compile \
      --target "{{TARGET}}" \
      --no-compile-autoload-dotenv \
      --no-compile-autoload-bunfig \
      --outfile "dist/binaries/fit-{{CLI}}-{{TARGET}}" \
      "$ENTRY"
    # Size gate (design: 150 MB ceiling)
    SIZE=$(stat -f%z "dist/binaries/fit-{{CLI}}-{{TARGET}}" 2>/dev/null \
        || stat -c%s "dist/binaries/fit-{{CLI}}-{{TARGET}}")
    MAX=$((150 * 1024 * 1024))
    if [ "$SIZE" -gt "$MAX" ]; then
      echo "Error: fit-{{CLI}} binary is $(( SIZE / 1024 / 1024 )) MB (ceiling: 150 MB)" >&2
      exit 1
    fi
    echo "fit-{{CLI}}: $(( SIZE / 1024 / 1024 )) MB"
```

**Flags explained:**

- `--target` — sets the output platform triple; defaults to `bun-darwin-arm64`
  per the design. Phase 2 passes `bun-darwin-x64`.
- `--no-compile-autoload-dotenv` / `--no-compile-autoload-bunfig` — CLIs must
  not read `.env` or `bunfig.toml` from the user's working directory; they have
  their own config mechanisms (`fit-rc`, `config.json`).
- `--outfile dist/binaries/fit-<cli>-<target>` — deterministic output path.
  `dist/` is already in `.gitignore` (line 57). The local filename uses bun's
  target triple (`bun-darwin-arm64`) because that's what `--target` requires.
  The `release-assets` job renames to the design's versioned scheme at upload.

**Entry point resolution:** Six CLIs live under `products/<cli>/bin/`, but
`fit-codegen` lives under `libraries/libcodegen/bin/`. The recipe checks
`products/` first, falls back to `libraries/lib<cli>/`, and fails with a clear
error if neither exists. This covers the seven CLIs without a lookup table.

**Codegen dependency (design divergence).** The design says `build-binary`
depends on `codegen`. This plan breaks that dependency on the individual recipe
to avoid re-running codegen seven times in the CI matrix. Instead, `codegen`
runs once before the matrix: the CI workflow runs it via `bootstrap` → `just
install` → `install-bun` → `fit-codegen --all`, and the `build-binaries`
fan-out recipe depends on `codegen` for local use. Risk: a contributor running
`just build-binary guide` without codegen gets a broken binary. This is
acceptable — the fan-out recipe is the documented entry point, not the
per-CLI recipe.

**Size gate.** The recipe checks the binary against the design's 150 MB ceiling
and fails if exceeded. Uses `stat -f%z` (macOS) with `stat -c%s` (Linux)
fallback.

### Recipe: `build-binaries`

```just
# Build all CLI binaries for the default target
build-binaries: codegen
    just build-binary map
    just build-binary pathway
    just build-binary basecamp
    just build-binary guide
    just build-binary landmark
    just build-binary summit
    just build-binary codegen
```

This depends on `codegen` to ensure generated code is current. Sequential
execution is intentional — parallel `bun build --compile` can exhaust memory on
CI runners (each embeds the ~60 MB bun runtime). This recipe is for local
contributor use; CI uses the workflow's single-CLI build per tag.

### Recipe placement

Add both recipes under a new `# ── Binaries` section after the existing
`# ── CLI` section. This groups binary builds near the CLIs they compile.

### Files

| File | Action |
| ---- | ------ |
| `justfile` | Modified — add `build-binary` and `build-binaries` recipes |

### Verification

```sh
just codegen
just build-binary pathway
./dist/binaries/fit-pathway-bun-darwin-arm64 --help
# Expect: pathway help output, exit 0
# On CI (Linux): binary is macOS-only — verify file exists and is Mach-O
file dist/binaries/fit-pathway-bun-darwin-arm64
```

## Step 2 — Release workflow

Create `.github/workflows/publish-brew.yml` triggered by release tags.

### Key design decisions

**Single-CLI build per tag.** The workflow extracts the CLI name from the tag
(e.g. `pathway` from `pathway@v0.25.32`) and builds only that CLI. This matches
`publish-npm.yml`'s per-CLI tag semantics — a tag releases one CLI, not all
seven. Building all seven would pollute the release with unrelated assets and
waste expensive macOS runner minutes.

**Codegen chain.** The bootstrap action runs `./scripts/bootstrap.sh` which
calls `just install` → `install-bun` → `fit-codegen --all`. This ensures
generated code exists before the build. An explicit `just codegen` step is added
after bootstrap as a defensive measure against bootstrap refactors.

**Release creation.** `publish-npm.yml` does not create GitHub Releases;
`publish-macos.yml` creates one only for `basecamp@v*`. This workflow must
create the release if it does not exist, then upload the binary.

### Workflow structure

```yaml
name: Publish Brew

on:
  push:
    tags: ["*@v*"]

jobs:
  build:
    runs-on: macos-14
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@<pinned-sha>  # v6

      - name: Extract CLI and version from tag
        id: meta
        run: |
          CLI_NAME="${GITHUB_REF_NAME%%@v*}"
          VERSION="${GITHUB_REF_NAME#*@v}"
          echo "cli=${CLI_NAME}" >> $GITHUB_OUTPUT
          echo "version=${VERSION}" >> $GITHUB_OUTPUT

      - uses: ./.github/actions/bootstrap

      - name: Ensure codegen is current
        run: just codegen

      - name: Build binary
        run: just build-binary ${{ steps.meta.outputs.cli }}

      - name: Smoke test
        run: |
          BINARY="dist/binaries/fit-${{ steps.meta.outputs.cli }}-bun-darwin-arm64"
          ./"$BINARY" --help

      - name: Generate sha256
        id: hash
        run: |
          CLI="${{ steps.meta.outputs.cli }}"
          VERSION="${{ steps.meta.outputs.version }}"
          BINARY="dist/binaries/fit-${CLI}-bun-darwin-arm64"
          ASSET="fit-${CLI}-${VERSION}-darwin-arm64"
          shasum -a 256 "$BINARY" | awk '{print $1}' > "dist/binaries/${ASSET}.sha256"
          echo "sha256=$(cat "dist/binaries/${ASSET}.sha256")" >> $GITHUB_OUTPUT

      - name: Create or reuse GitHub Release
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          TAG="${GITHUB_REF_NAME}"
          gh release create "$TAG" --title "$TAG" --generate-notes 2>/dev/null \
            || echo "Release $TAG already exists"

      - name: Upload release assets
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          TAG="${GITHUB_REF_NAME}"
          CLI="${{ steps.meta.outputs.cli }}"
          VERSION="${{ steps.meta.outputs.version }}"
          BINARY="dist/binaries/fit-${CLI}-bun-darwin-arm64"
          ASSET="fit-${CLI}-${VERSION}-darwin-arm64"
          gh release upload "$TAG" \
            "${BINARY}#${ASSET}" \
            "dist/binaries/${ASSET}.sha256" \
            --clobber

  tap-pr:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Extract CLI and version from tag
        id: meta
        run: |
          CLI_NAME="${GITHUB_REF_NAME%%@v*}"
          VERSION="${GITHUB_REF_NAME#*@v}"
          echo "cli=${CLI_NAME}" >> $GITHUB_OUTPUT
          echo "version=${VERSION}" >> $GITHUB_OUTPUT

      - name: Download sha256 from release
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          TAG="${GITHUB_REF_NAME}"
          CLI="${{ steps.meta.outputs.cli }}"
          VERSION="${{ steps.meta.outputs.version }}"
          gh release download "$TAG" \
            --pattern "fit-${CLI}-${VERSION}-darwin-arm64.sha256" \
            --dir .
          echo "sha256=$(cat fit-${CLI}-${VERSION}-darwin-arm64.sha256)" >> $GITHUB_OUTPUT
        id: hash

      - name: Checkout tap repo
        uses: actions/checkout@<pinned-sha>  # v6
        with:
          repository: forwardimpact/homebrew-tap
          token: ${{ secrets.HOMEBREW_TAP_PAT }}
          path: tap

      - name: Configure git identity
        working-directory: tap
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

      - name: Update cask
        env:
          CLI_NAME: ${{ steps.meta.outputs.cli }}
          VERSION: ${{ steps.meta.outputs.version }}
          SHA256: ${{ steps.hash.outputs.sha256 }}
        run: |
          CASK_FILE="tap/Casks/fit-${CLI_NAME}.rb"
          sed \
            -e "s|__VERSION__|${VERSION}|g" \
            -e "s|__SHA256__|${SHA256}|g" \
            -e "s|__CLI__|${CLI_NAME}|g" \
            > "$CASK_FILE" << 'TEMPLATE'
          cask "fit-__CLI__" do
            version "__VERSION__"
            sha256 "__SHA256__"

            url "https://github.com/forwardimpact/monorepo/releases/download/__CLI__@v#{version}/fit-__CLI__-#{version}-darwin-arm64"
            name "fit-__CLI__"
            desc "Forward Impact __CLI__ CLI"
            homepage "https://www.forwardimpact.team/__CLI__/"

            depends_on arch: :arm64

            binary "fit-__CLI__-#{version}-darwin-arm64", target: "fit-__CLI__"

            livecheck do
              url "https://github.com/forwardimpact/monorepo/releases?q=__CLI__@v"
              strategy :github_releases
              regex(/^__CLI__@v(\d+(?:\.\d+)+)$/i)
            end
          end
          TEMPLATE

      - name: Open PR
        working-directory: tap
        env:
          GH_TOKEN: ${{ secrets.HOMEBREW_TAP_PAT }}
        run: |
          CLI="${{ steps.meta.outputs.cli }}"
          VERSION="${{ steps.meta.outputs.version }}"
          BRANCH="update/fit-${CLI}-${VERSION}"
          git checkout -b "$BRANCH"
          git add "Casks/fit-${CLI}.rb"
          git commit -m "Update fit-${CLI} to ${VERSION}"
          git push origin "$BRANCH"
          gh pr create \
            --title "Update fit-${CLI} to ${VERSION}" \
            --body "Automated cask update from monorepo release ${GITHUB_REF_NAME}." \
            --base main
```

### Workflow changes from design

The design's table shows a 3-job structure with a 7-CLI matrix `build` job, a
separate `release-assets` job, and a `tap-pr` job. This plan simplifies to 2
jobs:

- **`build`** (macos-14) — builds the single tagged CLI, runs `--help` smoke
  test, creates the release, and uploads the asset. Collapsing build + release
  into one job avoids artifact transfer and a second macOS runner.
- **`tap-pr`** (ubuntu-latest) — downloads the sha256 sidecar from the release
  and opens a cask-update PR. Runs on cheap Linux since it only does git + gh
  operations.

### Cask template approach

The cask is generated using a quoted heredoc (`<< 'TEMPLATE'`) piped through
`sed`. The quoted delimiter prevents shell expansion of `#{version}` (Ruby
interpolation that must survive literally). Shell variables (`VERSION`, `SHA256`,
`CLI_NAME`) are injected via sed placeholders (`__VERSION__`, `__SHA256__`,
`__CLI__`). This avoids the fragile mixing of shell `${}` and Ruby `#{}`
expansion.

### Livecheck strategy

Casks use `strategy :github_releases` (not `:github_latest`). The
`:github_latest` strategy checks only the single "latest" release, which may
belong to a different CLI. `:github_releases` scans all releases and applies the
per-CLI regex.

### Interaction with existing workflows

- `publish-npm.yml` fires on the same `*@v*` tag pattern. Both workflows run in
  parallel — no coordination needed.
- `publish-macos.yml` fires only on `basecamp@v*` and also calls
  `gh release create`. For `basecamp@v*` tags, both workflows may race to create
  the release. Both use `--clobber` / `2>/dev/null || ...` to handle the race
  idempotently — whichever creates first wins, the other uploads to it.

### Action SHA pins

Resolve at implementation time from versions already in use:

| Action | Current pin source |
| ------ | ------------------ |
| `actions/checkout` | `publish-npm.yml`: `de0fac2e…` (v6) |

No `upload-artifact`/`download-artifact` needed — the simplified 2-job workflow
uses `gh release download` instead of artifact transfer.

### Secret: `HOMEBREW_TAP_PAT`

A GitHub Personal Access Token (classic) scoped to `repo` on
`forwardimpact/homebrew-tap`. Must be added to the monorepo's repository
secrets before the first release tag. Add a comment in the workflow documenting
the scope and rotation cadence.

### Files

| File | Action |
| ---- | ------ |
| `.github/workflows/publish-brew.yml` | Created |

### Verification

- Push a test tag (e.g. `pathway@v0.0.0-test.1`) and verify:
  1. Single binary built for `pathway` only
  2. Release created with versioned asset name
  3. `--help` smoke test passes in CI log
  4. Tap PR opens with correct cask content (version, sha256, no leading
     whitespace, `#{version}` Ruby interpolation intact)
- Delete test tag and release after verification.

## Step 3 — Bootstrap Homebrew tap repository

Create the external repository `forwardimpact/homebrew-tap` with initial
structure. This step can run in parallel with steps 1–2.

### Repository structure

```
forwardimpact/homebrew-tap/
├── README.md
├── Casks/
│   ├── fit-map.rb
│   ├── fit-pathway.rb
│   ├── fit-basecamp.rb
│   ├── fit-guide.rb
│   ├── fit-landmark.rb
│   ├── fit-summit.rb
│   └── fit-codegen.rb
└── .github/
    └── dependabot.yml
```

### Initial cask content

Each cask is a placeholder that the first release will overwrite:

```ruby
cask "fit-pathway" do
  version "0.0.0"
  sha256 :no_check

  url "https://github.com/forwardimpact/monorepo/releases/download/pathway@v#{version}/fit-pathway-#{version}-darwin-arm64"
  name "fit-pathway"
  desc "Forward Impact Pathway CLI — navigate engineering skills and careers"
  homepage "https://www.forwardimpact.team/pathway/"

  depends_on arch: :arm64

  binary "fit-pathway-#{version}-darwin-arm64", target: "fit-pathway"

  livecheck do
    url "https://github.com/forwardimpact/monorepo/releases?q=pathway@v"
    strategy :github_releases
    regex(/^pathway@v(\d+(?:\.\d+)+)$/i)
  end
end
```

Each CLI gets a tailored `desc` matching its product tagline from the Overview
page. The `sha256 :no_check` placeholder is safe — no release asset exists at
`v0.0.0`, so `brew install` would fail with a download error, not an integrity
bypass.

### README.md content

Brief: what the tap is, how to use it, Gatekeeper caveat, link to npm as
alternative.

### This step is manual

The tap repository is external — it cannot be created by a monorepo PR. The
implementer creates it via `gh repo create forwardimpact/homebrew-tap --public`,
pushes the initial structure, and adds the `HOMEBREW_TAP_PAT` secret to the
monorepo. Both the tap repo and the secret must exist before the first release
tag is pushed.

### Verification

```sh
brew tap forwardimpact/tap
brew info forwardimpact/tap/fit-pathway
# Expect: cask metadata displayed, version 0.0.0
```

## Step 4 — Product overview documentation

Add a brew install section to each of the seven product Overview pages and to
the codegen internals page. Each page gets a "Getting Started" section update
showing both npm and brew paths.

### Pattern

For each product overview page, add a brew install block immediately after the
existing npm install block in the "Getting Started" section:

**Before** (example from `website/pathway/index.md`):

```md
## Getting Started

```sh
npm install @forwardimpact/pathway
npx fit-pathway dev
```
```

**After:**

```md
## Getting Started

### Install via npm

```sh
npm install @forwardimpact/pathway
npx fit-pathway dev
```

### Install via Homebrew (macOS arm64)

```sh
brew tap forwardimpact/tap
brew install forwardimpact/tap/fit-pathway
fit-pathway dev
```

> **Unsigned binary.** This binary is not yet code-signed or notarized. macOS
> will show a Gatekeeper warning on first run. To allow it: open **System
> Settings → Privacy & Security**, scroll to the "fit-pathway was blocked"
> message, and click **Open Anyway**. A follow-up release will add signing.
```

### fit-guide special case

The Guide overview page currently shows a three-step npm install (install →
codegen → init). The brew section omits the codegen step:

```md
### Install via Homebrew (macOS arm64)

```sh
brew tap forwardimpact/tap
brew install forwardimpact/tap/fit-guide
fit-guide init
```

Generated gRPC clients are bundled into the brew binary — no `fit-codegen` step
needed.
```

### fit-codegen

`fit-codegen` is a library, not a product — it has no Overview page under
`website/`. Its brew availability is documented in the
[Codegen Internals](../../website/docs/internals/codegen/index.md) page:

```md
### Install via Homebrew (macOS arm64)

External users on macOS can also install fit-codegen directly:

```sh
brew tap forwardimpact/tap
brew install forwardimpact/tap/fit-codegen
fit-codegen --all
```
```

### Files

| File | Action |
| ---- | ------ |
| `website/map/index.md` | Modified — add brew install section |
| `website/pathway/index.md` | Modified — add brew install section |
| `website/basecamp/index.md` | Modified — add brew install section |
| `website/guide/index.md` | Modified — add brew install section (no codegen) |
| `website/landmark/index.md` | Modified — add brew install section |
| `website/summit/index.md` | Modified — add brew install section |
| `website/docs/internals/codegen/index.md` | Modified — add brew install section |

### Verification

- `just docs-build` completes without errors.
- Manual review: each page shows both install paths, Gatekeeper caveat present,
  Guide page omits codegen step.
- SC7 (npm unchanged): no files in `products/*/bin/` or `products/*/package.json`
  are modified by this plan. Existing `publish-npm.yml` and CI quality checks
  exercise the npm path — no new verification needed.

## Risks

1. **Binary size.** Each binary embeds the bun runtime (~60 MB) plus bundled
   dependencies. The 150 MB ceiling from the design is enforced by the
   `build-binary` recipe's size gate. If a CLI exceeds it, the build fails
   immediately.
2. **Symlink resolution.** The `generated/` symlink in `librpc/src/generated` →
   `<repo>/generated/` must be resolved by bun's bundler at compile time.
   Confirmed working by basecamp's `build-scheduler` recipe
   (`products/basecamp/justfile:35`). Detectable in Step 1 verification if it
   ever regresses.
3. **Tag collision.** `publish-brew.yml` and `publish-npm.yml` both fire on
   `*@v*`. They're independent, but if `publish-brew.yml` fails, the npm release
   ships without a brew release. Mitigation: the tap PR is the human gate — a
   failed workflow is visible and retriggerable.
4. **Release creation race.** For `basecamp@v*` tags, `publish-macos.yml` also
   creates a release. Both workflows handle the race idempotently (create-or-
   reuse pattern). For all other CLIs, `publish-brew.yml` is the sole release
   creator.
5. **`HOMEBREW_TAP_PAT` rotation.** The PAT is a long-lived credential scoped
   to `forwardimpact/homebrew-tap` only. A comment in the workflow documents the
   scope. Classic PATs expire after at most 1 year — add a rotation reminder.
6. **Gatekeeper friction.** Unsigned binaries require manual approval on first
   run. Mitigation: every Overview page carries the caveat with step-by-step
   instructions. Signing is explicitly deferred per spec.
7. **Startup budget.** The design specifies a 500 ms cold-start budget for
   `--help`. The CI smoke test runs `--help` but does not time it (timing on
   shared CI runners is unreliable). Startup budget enforcement is deferred to
   manual acceptance testing on dedicated hardware.
8. **SC5 acceptance.** The CI smoke test runs `--help` only. Full SC5 coverage
   (every user-visible Guide command works without codegen) requires manual
   acceptance testing on a clean macOS machine with no Node/Bun on PATH. The
   implementer should document the acceptance test results.

## Libraries used

No new shared `@forwardimpact/lib*` libraries are consumed by this plan.

Existing libraries consumed transitively (via the CLIs being compiled):
- `@forwardimpact/librpc` — gRPC clients (guide)
- `@forwardimpact/libcodegen` — code generation (fit-codegen itself)
- All other `@forwardimpact/lib*` packages in each CLI's dependency tree are
  bundled by `bun build --compile` — no new dependencies introduced.

Build toolchain: `bun >= 1.3.11` (pinned in `.github/actions/bootstrap`),
`just` (installed by `scripts/bootstrap.sh`), `gh`.

## Execution

**Agent:** `staff-engineer` for steps 1–3 (justfile, workflow, tap
bootstrap), `technical-writer` for step 4 (documentation).

**Parallelism:** Step 3 (tap bootstrap) can run in parallel with steps 1–2.
Step 4 can start once the tap path (`forwardimpact/tap`) is known (it is — from
the design). Steps 1 → 2 are strictly sequential.

**PR boundaries:** Steps 1–2 in one monorepo PR (justfile + workflow). Step 3
is a manual external repo creation. Step 4 in a second monorepo PR (docs only).

**Ordering constraint:** The tap repo (step 3) and `HOMEBREW_TAP_PAT` secret
must exist before the first release tag triggers the workflow. Coordinate with
the release engineer.

**Recommended:** Staff engineer implements steps 1–2 and opens the PR, creates
the tap repo (step 3) in parallel, then signals technical writer to start step
4. If a single agent executes all four, run steps 1 → 2 → 3 → 4 sequentially.

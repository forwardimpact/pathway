# Plan 600-A — Native Binary Distribution via Homebrew

See [`spec.md`](./spec.md) for WHAT/WHY and [`design.md`](./design.md) for
WHICH/WHERE. This plan captures HOW to implement and WHEN to sequence changes.

## Approach

The implementation has six steps: libmacos extraction (1a), bundle build
recipes (1b), release workflow (2), basecamp TCC verification (2b), tap
repository (3), and documentation (4). Step 1a lands first and blocks all
other bundle-assembly work. Steps 1b and 2 are strictly sequential. Step 3
(tap repo) can run in parallel with steps 1–2 since it creates an external
repo with placeholder casks. Step 4 (docs) can run in parallel with step 3.
Step 2b (manual TCC verification) runs before the first `basecamp@v*` tag
is pushed through the new workflow. The tap repo and `HOMEBREW_TAP_PAT`
secret must both exist before the first real release tag is pushed —
otherwise the `tap-pr` job fails.

The fit-guide codegen story resolves automatically: `just codegen` runs before
`bun build --compile`, so generated gRPC clients are bundled into every binary
via bun's import-graph traversal. No special handling needed — the existing
`generated/` symlink in `librpc/src/generated` is followed at build time
(confirmed by basecamp's `build-scheduler` recipe in
`products/basecamp/justfile:35`).

**Naming convention (deliberate design divergence).** The design specifies
output path `dist/binaries/<cli>-<os>-<arch>` for Mach-Os and `dist/apps/` for
`.app` bundles. This plan uses `dist/binaries/fit-<cli>-bun-darwin-arm64` as
the local Mach-O output — the `bun-` prefix is bun's target triple convention
and is required by the `--target` flag. Bundle assembly then reads from
`dist/binaries/` and writes `dist/apps/<Bundle>.app`. The `release-assets`
job zips each `.app` and uploads as
`<Bundle>.app-<version>-darwin-arm64.zip`.

## Step 1a — Extract `libraries/libmacos`

Create the shared macOS library every bundle-assembly step depends on, and
migrate basecamp to consume it. This step blocks Step 1b onward.

### Actions

- Create `libraries/libmacos/` with `package.json`, `src/`, `templates/`,
  `scripts/`. Declare `"os": ["darwin"]` so Linux CI skips it cleanly.
- Move `products/basecamp/src/posix-spawn.js` →
  `libraries/libmacos/src/posix-spawn.js`. Rewrite basecamp's imports
  (`products/basecamp/src/agent-runner.js` and any other caller). Add
  `libraries/libmacos/src/tcc-responsibility.js` — a thin wrapper that
  spawns a child, disclaims TCC responsibility, and returns an
  exit-code Promise.
- Generalize `products/basecamp/pkg/macos/build-app.sh` into
  `libraries/libmacos/scripts/build-app.sh` accepting:
  `--bundle-name`, `--bundle-id`, `--primary-exec`, `--extra-exec`
  (repeatable), `--info-plist`, `--entitlements`, `--resource`
  (repeatable), `--version`, `--out-dir`. Output path
  `<out-dir>/<bundle-name>.app`.
- Extract the codesign call into `libraries/libmacos/scripts/sign-app.sh`
  and have `build-app.sh` invoke it as its final stage.
- Commit default templates:
  - `templates/entitlements.plist` — JIT +
    `com.apple.security.cs.disable-library-validation` only.
  - `templates/entitlements-gui.plist` — seeded from basecamp's current
    `Basecamp.entitlements` (Calendar, Contacts, Network).
  - `templates/Info.plist.hbs` — template with `{{bundleId}}`,
    `{{bundleName}}`, `{{executable}}`, `{{version}}`, `{{minOS}}`,
    `{{lsuiElement}}` placeholders.
- Delete `products/basecamp/pkg/macos/build-app.sh`. Update basecamp's
  justfile `build-app` recipe to call `libraries/libmacos/scripts/build-app.sh`
  with basecamp-specific arguments (Swift launcher as `CFBundleExecutable`,
  `fit-basecamp` as a secondary Mach-O, `Basecamp.entitlements` as
  entitlements path, `LSUIElement=true`).

### Files

| File                                                  | Action                                               |
| ----------------------------------------------------- | ---------------------------------------------------- |
| `libraries/libmacos/package.json`                     | Created — `"os": ["darwin"]`                         |
| `libraries/libmacos/src/posix-spawn.js`               | Created — moved from `products/basecamp/src/`        |
| `libraries/libmacos/src/tcc-responsibility.js`        | Created                                              |
| `libraries/libmacos/scripts/build-app.sh`             | Created — generalized from basecamp's `build-app.sh` |
| `libraries/libmacos/scripts/sign-app.sh`              | Created                                              |
| `libraries/libmacos/templates/entitlements.plist`     | Created                                              |
| `libraries/libmacos/templates/entitlements-gui.plist` | Created — seeded from `Basecamp.entitlements`        |
| `libraries/libmacos/templates/Info.plist.hbs`         | Created                                              |
| `products/basecamp/src/posix-spawn.js`                | Deleted — moved to libmacos                          |
| `products/basecamp/src/agent-runner.js`               | Modified — import from `libmacos`                    |
| `products/basecamp/pkg/macos/build-app.sh`            | Deleted — superseded by `libmacos/scripts/build-app.sh` |
| `products/basecamp/justfile`                          | Modified — `build-app` recipe calls `libmacos/scripts/build-app.sh` |

### Verification

```sh
cd products/basecamp
just build-app
# Expect: dist/Basecamp.app produced with Swift launcher as CFBundleExecutable
#         and fit-basecamp in Contents/MacOS/; codesign -dvvv passes
bun test
# Expect: basecamp's existing test suite passes, including agent-runner paths
#         that exercise posix-spawn via libmacos
```

### Agent & parallelism

**Agent:** staff-engineer.
**Parallelism:** First step. Blocks Step 1b, Step 2, Step 2b.

## Step 1b — Bundle recipes in root justfile

Replaces the original Step 1. Drive every bundle through
`libmacos/scripts/build-app.sh` from root-level justfile recipes.

### Recipe: `build-binary`

```just
# Build a standalone native Mach-O for a product, service, or library CLI
build-binary NAME TARGET="bun-darwin-arm64":
    #!/usr/bin/env bash
    set -euo pipefail
    # Resolve entry point — products, then services, then libraries
    ENTRY="products/{{NAME}}/bin/fit-{{NAME}}.js"
    OUT_NAME="fit-{{NAME}}"
    if [ ! -f "$ENTRY" ]; then
      ENTRY="services/{{NAME}}/server.js"
      OUT_NAME="fit-service-{{NAME}}"
    fi
    if [ ! -f "$ENTRY" ]; then
      ENTRY="libraries/lib{{NAME}}/bin/fit-{{NAME}}.js"
      OUT_NAME="fit-{{NAME}}"
    fi
    if [ ! -f "$ENTRY" ]; then
      echo "Error: no entry point found for {{NAME}}" >&2
      exit 1
    fi
    mkdir -p dist/binaries
    bun build --compile \
      --target "{{TARGET}}" \
      --no-compile-autoload-dotenv \
      --no-compile-autoload-bunfig \
      --outfile "dist/binaries/${OUT_NAME}-{{TARGET}}" \
      "$ENTRY"
    # Size gate (design: 150 MB ceiling)
    SIZE=$(stat -f%z "dist/binaries/${OUT_NAME}-{{TARGET}}" 2>/dev/null \
        || stat -c%s "dist/binaries/${OUT_NAME}-{{TARGET}}")
    MAX=$((150 * 1024 * 1024))
    if [ "$SIZE" -gt "$MAX" ]; then
      echo "Error: ${OUT_NAME} binary is $(( SIZE / 1024 / 1024 )) MB (ceiling: 150 MB)" >&2
      exit 1
    fi
    echo "${OUT_NAME}: $(( SIZE / 1024 / 1024 )) MB"
```

**Flags explained:**

- `--target` — sets the output platform triple; defaults to `bun-darwin-arm64`
  per the design. Phase 2 passes `bun-darwin-x64`.
- `--no-compile-autoload-dotenv` / `--no-compile-autoload-bunfig` — CLIs must
  not read `.env` or `bunfig.toml` from the user's working directory; they have
  their own config mechanisms (`fit-rc`, `config.json`).
- `--outfile dist/binaries/<name>-<target>` — deterministic output path. `dist/`
  is already in `.gitignore` (line 57). The local filename uses bun's target
  triple (`bun-darwin-arm64`) because that's what `--target` requires. The
  bundle-assembly step (`build-app-*` below) reads from this path.

**Entry point resolution:** Six product CLIs live under
`products/<name>/bin/fit-<name>.js`. Five gRPC services live under
`services/<name>/server.js` and compile to `fit-service-<name>`. Library CLIs
live under `libraries/lib<name>/bin/fit-<name>.js` (`fit-codegen`,
`fit-terrain`, `fit-eval`, etc.). The recipe checks products, then services,
then libraries, and fails with a clear error if none match.

**Codegen dependency (design divergence).** The design says `build-binary`
depends on `codegen`. This plan breaks that dependency on the individual recipe
to avoid re-running codegen seven times in the CI matrix. Instead, `codegen`
runs once before the matrix: the CI workflow runs it via `bootstrap` →
`just install` → `install-bun` → `fit-codegen --all`, and the `build-binaries`
fan-out recipe depends on `codegen` for local use. Risk: a contributor running
`just build-binary guide` without codegen gets a broken binary. This is
acceptable — the fan-out recipe is the documented entry point, not the per-CLI
recipe.

**Size gate.** The recipe checks the binary against the design's 150 MB ceiling
and fails if exceeded. Uses `stat -f%z` (macOS) with `stat -c%s` (Linux)
fallback.

### Recipe: `build-binaries`

```just
# Build all Mach-Os for the default target — products, services, library CLIs
build-binaries: codegen build-product-binaries build-service-binaries build-utility-binaries

build-product-binaries:
    just build-binary basecamp
    just build-binary guide
    just build-binary landmark
    just build-binary map
    just build-binary pathway
    just build-binary summit

build-service-binaries:
    just build-binary graph
    just build-binary mcp
    just build-binary pathway-service  # services/pathway renamed target to avoid collision
    just build-binary trace
    just build-binary vector

build-utility-binaries:
    just build-binary codegen
    just build-binary terrain
    just build-binary eval
    just build-binary doc
    just build-binary rc
    just build-binary xmr
    just build-binary storage
    just build-binary logger
    just build-binary svscan
    just build-binary trace-util  # libeval's fit-trace, disambiguated
    just build-binary visualize
    just build-binary query
    just build-binary subjects
    just build-binary process-graphs
    just build-binary process-resources
    just build-binary process-vectors
    just build-binary search
    just build-binary unary
    just build-binary tiktoken
    just build-binary download-bundle
```

Sequential execution is intentional — parallel `bun build --compile` can
exhaust memory on CI runners (each embeds the ~60 MB bun runtime). `codegen`
runs first to ensure generated gRPC code is current. The exact list of
services and library CLIs, and any target-name disambiguation, is resolved
during Step 1a/1b implementation from `services/*/package.json` and
`libraries/*/package.json` `bin` fields.

### Recipes: `build-app-*`

After Mach-Os are built, bundle them via `libmacos/scripts/build-app.sh`:

```just
# Assemble a per-product .app bundle
build-app-product NAME:
    bash libraries/libmacos/scripts/build-app.sh \
      --bundle-name "fit-{{NAME}}" \
      --bundle-id "com.forwardimpact.{{NAME}}" \
      --primary-exec "dist/binaries/fit-{{NAME}}-bun-darwin-arm64" \
      --info-plist "products/{{NAME}}/macos/Info.plist" \
      --entitlements "products/{{NAME}}/macos/entitlements.plist" \
      --version "$(jq -r .version products/{{NAME}}/package.json)" \
      --out-dir dist/apps

# Assemble FIT Services.app
build-app-services:
    bash libraries/libmacos/scripts/build-app.sh \
      --bundle-name "FIT Services" \
      --bundle-id "com.forwardimpact.services" \
      --primary-exec "dist/binaries/fit-service-graph-bun-darwin-arm64" \
      --extra-exec "dist/binaries/fit-service-mcp-bun-darwin-arm64" \
      --extra-exec "dist/binaries/fit-service-pathway-bun-darwin-arm64" \
      --extra-exec "dist/binaries/fit-service-trace-bun-darwin-arm64" \
      --extra-exec "dist/binaries/fit-service-vector-bun-darwin-arm64" \
      --info-plist "services/macos/Info.plist" \
      --entitlements "services/macos/entitlements.plist" \
      --version "$(jq -r .version package.json)" \
      --out-dir dist/apps

# Assemble FIT Utilities.app
build-app-utilities:
    bash libraries/libmacos/scripts/build-app.sh \
      --bundle-name "FIT Utilities" \
      --bundle-id "com.forwardimpact.utilities" \
      --primary-exec "dist/binaries/fit-codegen-bun-darwin-arm64" \
      --extra-exec "dist/binaries/fit-terrain-bun-darwin-arm64" \
      # … remaining library-CLI Mach-Os as --extra-exec
      --info-plist "libraries/macos/Info.plist" \
      --entitlements "libraries/macos/entitlements.plist" \
      --version "$(jq -r .version package.json)" \
      --out-dir dist/apps

# Fan-out: build every Mach-O, then every bundle
build-apps: build-binaries
    just build-app-product basecamp
    just build-app-product guide
    just build-app-product landmark
    just build-app-product map
    just build-app-product pathway
    just build-app-product summit
    just build-app-services
    just build-app-utilities
```

### Per-bundle metadata files

Create `Info.plist` and `entitlements.plist` alongside each bundle's source
tree:

- `products/<name>/macos/Info.plist` for the five non-basecamp products —
  render `libmacos/templates/Info.plist.hbs` with
  `bundleId=com.forwardimpact.<name>`, `executable=fit-<name>`,
  `minOS=13.0`, no `NS*UsageDescription` entries. Basecamp already has
  `products/basecamp/macos/Info.plist` — leave it alone.
- `products/<name>/macos/entitlements.plist` for the five non-basecamp
  products — copy `libmacos/templates/entitlements.plist` (JIT +
  disable-library-validation). Basecamp continues to reference
  `products/basecamp/macos/Basecamp.entitlements`.
- `services/macos/Info.plist` and `services/macos/entitlements.plist` —
  metadata for `FIT Services.app`. Identifier `com.forwardimpact.services`,
  `CFBundleExecutable=fit-service-graph`.
- `libraries/macos/Info.plist` and `libraries/macos/entitlements.plist` —
  metadata for `FIT Utilities.app`. Identifier
  `com.forwardimpact.utilities`, `CFBundleExecutable=fit-codegen`.

### Service compile targets

Each `services/<name>/package.json` needs a `bin` entry or the equivalent
so `build-binary <name>` finds an entry point that compiles to
`fit-service-<name>`. Add per-service `bin` fields during Step 1b
implementation.

### Recipe placement

Add the binary and bundle recipes under a new `# ── Bundles` section after
the existing `# ── CLI` section of the root justfile.

### Files

| File                                              | Action                                         |
| ------------------------------------------------- | ---------------------------------------------- |
| `justfile`                                        | Modified — add binary and bundle recipes       |
| `products/guide/macos/Info.plist`                 | Created                                        |
| `products/guide/macos/entitlements.plist`         | Created                                        |
| `products/landmark/macos/Info.plist`              | Created                                        |
| `products/landmark/macos/entitlements.plist`      | Created                                        |
| `products/map/macos/Info.plist`                   | Created                                        |
| `products/map/macos/entitlements.plist`           | Created                                        |
| `products/pathway/macos/Info.plist`               | Created                                        |
| `products/pathway/macos/entitlements.plist`       | Created                                        |
| `products/summit/macos/Info.plist`                | Created                                        |
| `products/summit/macos/entitlements.plist`        | Created                                        |
| `services/macos/Info.plist`                       | Created                                        |
| `services/macos/entitlements.plist`               | Created                                        |
| `libraries/macos/Info.plist`                      | Created                                        |
| `libraries/macos/entitlements.plist`              | Created                                        |
| `services/*/package.json`                         | Modified — add `bin` fields for compile target |

### Verification

```sh
just codegen
just build-app-product pathway
# Expect: dist/apps/fit-pathway.app exists
codesign -dvvv dist/apps/fit-pathway.app
# Expect: Identifier=com.forwardimpact.pathway, Signature=adhoc, non-empty cdhash
plutil -p dist/apps/fit-pathway.app/Contents/Info.plist
# Expect: CFBundleIdentifier=com.forwardimpact.pathway, CFBundleShortVersionString=<version>
codesign -d --entitlements - dist/apps/fit-pathway.app
# Expect: entitlements plist with com.apple.security.cs.allow-jit
codesign --verify --deep --strict dist/apps/fit-pathway.app
# Expect: exit 0
./dist/apps/fit-pathway.app/Contents/MacOS/fit-pathway --help
# Expect: pathway help output, exit 0 in < 500 ms

# Build every bundle
just build-apps
ls dist/apps/
# Expect: fit-basecamp.app, fit-guide.app, fit-landmark.app, fit-map.app,
#         fit-pathway.app, fit-summit.app, FIT Services.app, FIT Utilities.app

# cdhash stability check (CI gate)
BASELINE=$(codesign -dvvv dist/apps/fit-pathway.app 2>&1 | grep CDHash)
git stash && just build-app-product pathway && git stash pop
AFTER=$(codesign -dvvv dist/apps/fit-pathway.app 2>&1 | grep CDHash)
[ "$BASELINE" = "$AFTER" ] || { echo "cdhash drift"; exit 1; }
```

## Step 2 — Release workflow

Create `.github/workflows/publish-brew.yml` triggered by release tags.

### Key design decisions

**Single-bundle build per tag.** The workflow extracts the bundle name from
the tag and builds only that bundle. Tag shapes:

- `<product>@v*` (e.g. `pathway@v0.25.32`) — builds `fit-<product>.app` via
  `just build-app-product <product>`.
- `services@v*` — builds `FIT Services.app` via `just build-app-services`.
- `utilities@v*` — builds `FIT Utilities.app` via `just build-app-utilities`.

This matches `publish-npm.yml`'s per-package tag semantics — a tag releases
one artifact, not the full set. Building everything per tag would pollute
each release with unrelated assets and waste expensive macOS runner minutes.

**Codegen chain.** The bootstrap action runs `./scripts/bootstrap.sh` which
calls `just install` → `install-bun` → `fit-codegen --all`. This ensures
generated code exists before the build. An explicit `just codegen` step is added
after bootstrap as a defensive measure against bootstrap refactors.

**Release creation.** `publish-npm.yml` does not create GitHub Releases;
`publish-macos.yml` creates one only for `basecamp@v*`. This workflow must
create the release if it does not exist, then upload the zipped bundle.

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

      - name: Extract bundle and version from tag
        id: meta
        run: |
          NAME="${GITHUB_REF_NAME%%@v*}"
          VERSION="${GITHUB_REF_NAME#*@v}"
          case "$NAME" in
            services)   KIND=services;   BUNDLE="FIT Services.app";         CASK=fit-services   ;;
            utilities)  KIND=utilities;  BUNDLE="FIT Utilities.app";        CASK=fit-utilities  ;;
            *)          KIND=product;    BUNDLE="fit-${NAME}.app";          CASK=fit-${NAME}    ;;
          esac
          echo "name=${NAME}"       >> $GITHUB_OUTPUT
          echo "version=${VERSION}" >> $GITHUB_OUTPUT
          echo "kind=${KIND}"       >> $GITHUB_OUTPUT
          echo "bundle=${BUNDLE}"   >> $GITHUB_OUTPUT
          echo "cask=${CASK}"       >> $GITHUB_OUTPUT

      - uses: ./.github/actions/bootstrap

      - name: Ensure codegen is current
        run: just codegen

      - name: Build bundle
        run: |
          case "${{ steps.meta.outputs.kind }}" in
            services)   just build-app-services   ;;
            utilities)  just build-app-utilities  ;;
            product)    just build-app-product ${{ steps.meta.outputs.name }} ;;
          esac

      - name: Smoke test
        run: |
          BUNDLE="dist/apps/${{ steps.meta.outputs.bundle }}"
          codesign --verify --deep --strict "$BUNDLE"
          # For product bundles, run the matching CLI's --help.
          # Shared bundles expose multiple CLIs; exercise the primary exec only.
          case "${{ steps.meta.outputs.kind }}" in
            product)    "$BUNDLE/Contents/MacOS/fit-${{ steps.meta.outputs.name }}" --help ;;
            services)   "$BUNDLE/Contents/MacOS/fit-service-graph" --help                  ;;
            utilities)  "$BUNDLE/Contents/MacOS/fit-codegen" --help                        ;;
          esac

      - name: Zip bundle and hash
        id: hash
        run: |
          VERSION="${{ steps.meta.outputs.version }}"
          CASK="${{ steps.meta.outputs.cask }}"
          BUNDLE="dist/apps/${{ steps.meta.outputs.bundle }}"
          ASSET="${CASK}-${VERSION}-darwin-arm64.zip"
          # Use `ditto` to preserve codesign metadata through zip.
          ditto -c -k --sequesterRsrc --keepParent "$BUNDLE" "dist/apps/${ASSET}"
          shasum -a 256 "dist/apps/${ASSET}" | awk '{print $1}' > "dist/apps/${ASSET}.sha256"
          echo "asset=${ASSET}" >> $GITHUB_OUTPUT
          echo "sha256=$(cat "dist/apps/${ASSET}.sha256")" >> $GITHUB_OUTPUT

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
          ASSET="${{ steps.hash.outputs.asset }}"
          gh release upload "$TAG" \
            "dist/apps/${ASSET}" \
            "dist/apps/${ASSET}.sha256" \
            --clobber

  tap-pr:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Extract bundle and version from tag
        id: meta
        run: |
          NAME="${GITHUB_REF_NAME%%@v*}"
          VERSION="${GITHUB_REF_NAME#*@v}"
          case "$NAME" in
            services)   KIND=services;   CASK=fit-services   ;;
            utilities)  KIND=utilities;  CASK=fit-utilities  ;;
            *)          KIND=product;    CASK=fit-${NAME}    ;;
          esac
          echo "name=${NAME}"       >> $GITHUB_OUTPUT
          echo "version=${VERSION}" >> $GITHUB_OUTPUT
          echo "kind=${KIND}"       >> $GITHUB_OUTPUT
          echo "cask=${CASK}"       >> $GITHUB_OUTPUT

      - name: Download sha256 from release
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          TAG="${GITHUB_REF_NAME}"
          CASK="${{ steps.meta.outputs.cask }}"
          VERSION="${{ steps.meta.outputs.version }}"
          ASSET="${CASK}-${VERSION}-darwin-arm64.zip"
          gh release download "$TAG" --pattern "${ASSET}.sha256" --dir .
          echo "sha256=$(cat "${ASSET}.sha256")" >> $GITHUB_OUTPUT
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
          CASK:    ${{ steps.meta.outputs.cask }}
          NAME:    ${{ steps.meta.outputs.name }}
          VERSION: ${{ steps.meta.outputs.version }}
          SHA256:  ${{ steps.hash.outputs.sha256 }}
        run: |
          # Only the version and sha256 are updated per release; the rest of
          # the cask body lives in the tap repo (see Step 3) and is not
          # regenerated from this workflow. This avoids clobbering per-cask
          # differences (e.g. the shared fit-services / fit-utilities casks'
          # multi-binary stanza lists, and product casks' depends_on graph).
          CASK_FILE="tap/Casks/${CASK}.rb"
          sed -i \
            -e "s|^  version \".*\"|  version \"${VERSION}\"|" \
            -e "s|^  sha256 \".*\"|  sha256 \"${SHA256}\"|" \
            "$CASK_FILE"

      - name: Open PR
        working-directory: tap
        env:
          GH_TOKEN: ${{ secrets.HOMEBREW_TAP_PAT }}
        run: |
          CASK="${{ steps.meta.outputs.cask }}"
          VERSION="${{ steps.meta.outputs.version }}"
          BRANCH="update/${CASK}-${VERSION}"
          git checkout -b "$BRANCH"
          git add "Casks/${CASK}.rb"
          git commit -m "Update ${CASK} to ${VERSION}"
          git push origin "$BRANCH"
          gh pr create \
            --title "Update ${CASK} to ${VERSION}" \
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

### Cask update approach

The workflow updates only `version` and `sha256` lines in place via `sed
-i`. It does **not** regenerate the full cask body. Rationale: the eight
casks (six product + `fit-services` + `fit-utilities`) differ from each
other in ways the release workflow shouldn't re-derive every tag — product
casks declare a `depends_on cask:` list pointing at the shared-bundle
casks, and the two shared casks enumerate many `binary` stanza lines (one
per Mach-O they expose). Those structural pieces live in the tap repo
(seeded by Step 3) and are edited there by humans when the bundle contents
change. The release workflow's responsibility is narrow: bump the version
string and hash when a new `.app.zip` ships.

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

| Action             | Current pin source                  |
| ------------------ | ----------------------------------- |
| `actions/checkout` | `publish-npm.yml`: `de0fac2e…` (v6) |

No `upload-artifact`/`download-artifact` needed — the simplified 2-job workflow
uses `gh release download` instead of artifact transfer.

### Secret: `HOMEBREW_TAP_PAT`

A GitHub Personal Access Token (classic) scoped to `repo` on
`forwardimpact/homebrew-tap`. Must be added to the monorepo's repository secrets
before the first release tag. Add a comment in the workflow documenting the
scope and rotation cadence.

### Files

| File                                 | Action  |
| ------------------------------------ | ------- |
| `.github/workflows/publish-brew.yml` | Created |

### Verification

- Push a test tag (e.g. `pathway@v0.0.0-test.1`) and verify:
  1. Single bundle (`fit-pathway.app`) built, no other bundles touched.
  2. Release created with asset name `fit-pathway-0.0.0-test.1-darwin-arm64.zip`.
  3. `codesign --verify --deep --strict` passes in CI log.
  4. `--help` smoke test exits 0.
  5. Tap PR opens and updates only `version` and `sha256` lines in
     `Casks/fit-pathway.rb`; `depends_on cask:`, `binary`, and
     `livecheck` stanzas are preserved unchanged.
- Repeat with `services@v0.0.0-test.1` and `utilities@v0.0.0-test.1` to
  cover the shared-bundle paths.
- Delete test tags and releases after verification.

## Step 2b — Verify basecamp's TCC responsibility chain

Before shipping any real `basecamp@v*` tag through the new workflow,
confirm the shared `libmacos/scripts/build-app.sh` produces a
`fit-basecamp.app` bundle that still inherits Calendar and Contacts
grants from macOS TCC.

### Actions

- Build `fit-basecamp.app` via `just build-app-product basecamp`.
- On a macOS 14+ machine that has already granted Basecamp Calendar and
  Contacts access via a previous `.pkg` install: fully uninstall the
  `.pkg`-installed Basecamp, install the newly-built `.app` via the
  local Homebrew cask from a clone of the tap
  (`brew install --cask ./Casks/fit-basecamp.rb`). Launch the app,
  trigger a calendar sync via the scheduler, verify no TCC prompt
  appears and the sync succeeds.
- Repeat after bumping basecamp's patch version in `package.json` and
  rebuilding + reinstalling: no re-prompt is expected because the
  bundle identifier is stable.

### Verification

```sh
# While the sync is running, tail the TCC log to confirm the responsible
# process resolves to the bundle, not to Terminal or the PATH symlink:
log stream --predicate 'subsystem == "com.apple.tcc"'
# Expect to see responsible-process lookups resolve to
# com.forwardimpact.basecamp
```

Record the test outcome in the implementation PR's description.

### Agent & parallelism

**Agent:** staff-engineer + human tester.
**Parallelism:** Runs before the first `basecamp@v*` tag is pushed
through the new workflow. Blocks that tag; does not block Step 3 or
Step 4.

## Step 3 — Bootstrap Homebrew tap repository

Create the external repository `forwardimpact/homebrew-tap` with initial
structure. This step can run in parallel with steps 1–2.

### Repository structure

```
forwardimpact/homebrew-tap/
├── README.md
├── Casks/
│   ├── fit-basecamp.rb      # product casks — each depends_on the two shared casks
│   ├── fit-guide.rb
│   ├── fit-landmark.rb
│   ├── fit-map.rb
│   ├── fit-pathway.rb
│   ├── fit-summit.rb
│   ├── fit-services.rb      # shared bundle — FIT Services.app
│   └── fit-utilities.rb     # shared bundle — FIT Utilities.app
└── .github/
    └── dependabot.yml
```

### Initial cask content — product cask template

Each product cask installs a `.app` bundle, symlinks its CLI onto PATH,
and declares `depends_on cask:` on the two shared-bundle casks:

```ruby
cask "fit-pathway" do
  version "0.0.0"
  sha256 :no_check

  url "https://github.com/forwardimpact/monorepo/releases/download/pathway@v#{version}/fit-pathway-#{version}-darwin-arm64.zip"
  name "Forward Impact Pathway"
  desc "Forward Impact Pathway CLI — navigate engineering skills and careers"
  homepage "https://www.forwardimpact.team/pathway/"

  depends_on arch: :arm64
  depends_on cask: [
    "forwardimpact/tap/fit-services",
    "forwardimpact/tap/fit-utilities",
  ]

  app "fit-pathway.app", target: "Forward Impact/fit-pathway.app"
  binary "#{appdir}/Forward Impact/fit-pathway.app/Contents/MacOS/fit-pathway"

  livecheck do
    url "https://github.com/forwardimpact/monorepo/releases?q=pathway@v"
    strategy :github_releases
    regex(/^pathway@v(\d+(?:\.\d+)+)$/i)
  end

  zap trash: "~/Library/Preferences/com.forwardimpact.pathway.plist"
end
```

### Initial cask content — shared bundle cask template

`fit-services.rb` and `fit-utilities.rb` install their respective shared
bundles and enumerate every Mach-O inside `Contents/MacOS/` as a separate
`binary` stanza so all exposed CLIs land on PATH:

```ruby
cask "fit-utilities" do
  version "0.0.0"
  sha256 :no_check

  url "https://github.com/forwardimpact/monorepo/releases/download/utilities@v#{version}/fit-utilities-#{version}-darwin-arm64.zip"
  name "Forward Impact Utilities"
  desc "Forward Impact library CLIs — fit-codegen, fit-terrain, fit-eval, and more"
  homepage "https://www.forwardimpact.team/"

  depends_on arch: :arm64

  app "FIT Utilities.app", target: "Forward Impact/FIT Utilities.app"

  # One binary stanza per Mach-O the bundle exposes. Keeping this list
  # explicit (rather than globbing in the cask) makes the PATH surface
  # reviewable in code review when the utility set changes.
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-codegen"
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-terrain"
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-eval"
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-doc"
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-rc"
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-xmr"
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-storage"
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-logger"
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-svscan"
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-trace"
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-visualize"
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-query"
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-subjects"
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-process-graphs"
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-process-resources"
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-process-vectors"
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-search"
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-unary"
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-tiktoken"
  binary "#{appdir}/Forward Impact/FIT Utilities.app/Contents/MacOS/fit-download-bundle"

  livecheck do
    url "https://github.com/forwardimpact/monorepo/releases?q=utilities@v"
    strategy :github_releases
    regex(/^utilities@v(\d+(?:\.\d+)+)$/i)
  end

  zap trash: "~/Library/Preferences/com.forwardimpact.utilities.plist"
end
```

`fit-services.rb` follows the same shape with five `binary` stanzas for the
gRPC servers (`fit-service-{graph,mcp,pathway,trace,vector}`).

Each product cask gets a tailored `desc` matching the product tagline from
its Overview page. The `sha256 :no_check` placeholder is safe — no release
asset exists at `v0.0.0`, so `brew install` would fail with a download
error, not an integrity bypass.

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

````md
## Getting Started

```sh
npm install @forwardimpact/pathway
npx fit-pathway dev
````

````

**After:**

```md
## Getting Started

### Install via npm

```sh
npm install @forwardimpact/pathway
npx fit-pathway dev
````

### Install via Homebrew (macOS arm64)

```sh
brew tap forwardimpact/tap
brew install --cask forwardimpact/tap/fit-pathway
fit-pathway dev
```

Installing any product cask automatically pulls in the shared
`fit-services` and `fit-utilities` casks via `depends_on`. The
`fit-pathway.app` bundle lands in `/Applications/Forward Impact/` and
the `fit-pathway` CLI is symlinked onto `PATH`.

> **Unsigned bundle.** This bundle is ad-hoc signed but not yet Developer
> ID signed or notarized. macOS will show a Gatekeeper warning on first
> launch for each newly-installed bundle (the product bundle plus the
> two shared bundles). To allow them: open **System Settings → Privacy
> & Security → Open Anyway**. Once approved, TCC permission grants and
> Gatekeeper approvals persist across `brew upgrade` — you won't be
> re-prompted. A follow-up release will add Developer ID signing to
> skip the Gatekeeper step entirely.

````

### fit-guide special case

The Guide overview page currently shows a three-step npm install (install →
codegen → init). The brew section omits the codegen step:

```md
### Install via Homebrew (macOS arm64)

```sh
brew tap forwardimpact/tap
brew install --cask forwardimpact/tap/fit-guide
fit-guide init
````

Generated gRPC clients are bundled into the brew binary — no `fit-codegen` step
needed. The gRPC service bundles (graph, mcp, pathway, trace, vector)
install via the `fit-services` shared cask pulled in by `depends_on`.

````

### fit-codegen and other library CLIs

`fit-codegen` is a library, not a product — it has no Overview page under
`website/`. It is installed alongside every other library CLI by the
`fit-utilities` shared cask. Its brew availability is documented in the
[Codegen Internals](../../website/docs/internals/codegen/index.md) page:

```md
### Install via Homebrew (macOS arm64)

External users on macOS can install fit-codegen standalone via the
shared Utilities bundle:

```sh
brew tap forwardimpact/tap
brew install --cask forwardimpact/tap/fit-utilities
fit-codegen --all
````

Installing any product cask (e.g. `fit-guide`) also installs
`fit-utilities` automatically via `depends_on`.

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
9. **Bundle cdhash stability depends on deterministic builds.** Bun's
   `--compile` is not guaranteed deterministic across bun versions (embedded
   runtime may shift), and `codesign --deep` signs in directory-order. A
   rotating cdhash wipes TCC grants on `brew upgrade`. Mitigated by pinning
   the bun version in CI and adding a check that rebuilds twice and diffs the
   bundle cdhash; a mismatch fails the release.
10. **Moving `posix-spawn.js` and `build-app.sh` could break basecamp.**
    Both files currently live in `products/basecamp/` and Step 1a relocates
    them to `libraries/libmacos/`. Mitigated by Step 1a running basecamp's
    full test suite plus Step 2b's manual TCC verification on hardware
    before any `basecamp@v*` tag is pushed through the new workflow.
11. **Symlink-from-Terminal TCC responsibility.** PATH symlinks into
    `.app` bundles make Terminal the TCC-responsible process when a CLI
    is invoked interactively. No current non-basecamp CLI requests TCC
    resources, so this is latent; if a future product needs TCC from a
    Terminal invocation it must ship its own self-disclaim logic using
    `libraries/libmacos/src/posix-spawn.js`.

## Libraries used

**New library introduced by this plan:**

- `@forwardimpact/libmacos` — owns `posix-spawn.js`, `tcc-responsibility.js`,
  `build-app.sh`, `sign-app.sh`, and the Info.plist / entitlements templates.
  Darwin-only (`"os": ["darwin"]`). Created in Step 1a; consumed by every
  bundle-assembly recipe.

Existing libraries consumed transitively (via the CLIs being compiled):

- `@forwardimpact/librpc` — gRPC clients (guide, services/*)
- `@forwardimpact/libcodegen` — code generation (fit-codegen itself)
- All other `@forwardimpact/lib*` packages in each CLI's dependency tree are
  bundled by `bun build --compile` — no new dependencies introduced.

Build toolchain: `bun >= 1.3.11` (pinned in `.github/actions/bootstrap`),
`just` (installed by `scripts/bootstrap.sh`), `gh`, `ditto` (macOS native),
`codesign` (Xcode command-line tools).

## Execution

**Agent:** `staff-engineer` for Steps 1a, 1b, 2, 3 (libmacos, justfile,
workflow, tap bootstrap); `staff-engineer + human tester` for Step 2b
(hardware TCC verification); `technical-writer` for Step 4 (documentation).

**Parallelism:**

- Step 1a is first and blocks everything bundle-related.
- Step 1b → Step 2 are strictly sequential after Step 1a (the workflow
  invokes the recipes).
- Step 3 (tap bootstrap) can run in parallel with Steps 1a–2 since it
  creates an external repo with placeholder casks.
- Step 4 (docs) can start once the tap path (`forwardimpact/tap`) is
  known (it is — from the design).
- Step 2b runs on hardware before the first `basecamp@v*` tag is pushed
  through the new workflow. Blocks that tag only.

**PR boundaries:**

- Step 1a (libmacos extraction + basecamp migration) in its own monorepo
  PR — this is a refactor that should land and bake before the bundle
  pipeline lights up on top of it.
- Steps 1b–2 in a second monorepo PR (justfile recipes + workflow).
- Step 3 is a manual external repo creation.
- Step 4 in a third monorepo PR (docs only).

**Ordering constraint:** The tap repo (Step 3) and `HOMEBREW_TAP_PAT`
secret must both exist before the first release tag triggers the
workflow. Step 2b must pass before the first `basecamp@v*` tag.
Coordinate with the release engineer.

**Recommended:** Staff engineer implements Step 1a and opens the first
PR, then Steps 1b–2 in the second PR, then creates the tap repo (Step
3) manually. Technical writer starts Step 4 once the tap path is
confirmed. Step 2b runs on hardware immediately before the first
basecamp release.
```

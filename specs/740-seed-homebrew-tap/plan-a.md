# Plan — Seed `forwardimpact/homebrew-tap` with initial casks

> Spec: [`spec.md`](spec.md) · Design: [`design-a.md`](design-a.md)

## Approach

The eight cask files already live on `forwardimpact/homebrew-tap/main` in the
shape the design prescribes (single `fit-gear` shared bundle, `Forward Impact/`
app subdirectory, `:github_releases` livecheck with anchored per-cask regex,
`fit-basecamp` deprecated alias). Three monorepo-side gaps remain before the
spec's success criteria pass: `publish-brew.yml` and `justfile` still build,
sign, and publish under the legacy `services@v*` / `utilities@v*` tag pair, so
the `tap-pr` job's sed contract targets cask filenames that no longer exist;
the conventions document the spec's SC6 names is missing; and no end-to-end
check has confirmed the seeded casks survive the workflow's sed contract. This
plan closes those three gaps in two parallel strands and ends with a
verification pass that also reconciles any drift between the seeded cask bodies
and the design tables.

## Files at a glance

| Action | Path                                                                                           | Reason                                                                  |
| ------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Modify | `.github/workflows/publish-brew.yml`                                                           | Replace `services@v*` / `utilities@v*` tag pair and case branches with `gear` |
| Modify | `justfile`                                                                                     | Replace `build-{service,utility}-binaries` and `build-app-{services,utilities}` with gear recipes |
| Create | `macos/gear/Info.plist`                                                                        | Bundle metadata for `fit-gear.app`                                      |
| Create | `macos/gear/entitlements.plist`                                                                | Codesign entitlements for `fit-gear.app` (byte-copy of the existing services plist) |
| Delete | `macos/services/Info.plist`, `macos/services/entitlements.plist`                               | Replaced by `macos/gear/`                                               |
| Delete | `macos/libraries/Info.plist`, `macos/libraries/entitlements.plist`                             | Replaced by `macos/gear/`                                               |
| Create | `websites/fit/docs/internals/release/index.md`                                                 | Conventions document (spec § In scope, SC6)                             |
| Modify | `websites/fit/docs/internals/index.md`                                                         | Add `release` card to the internals hub grid                            |

## Steps

### 1. Replace the `services@v*` / `utilities@v*` tag pair with `gear@v*`

File modified: `.github/workflows/publish-brew.yml` (lines 9–16).

Before / after:

```yaml
# Before
tags:
  - "outpost@v*"
  - "guide@v*"
  - "landmark@v*"
  - "map@v*"
  - "pathway@v*"
  - "summit@v*"
  - "services@v*"
  - "utilities@v*"

# After
tags:
  - "outpost@v*"
  - "guide@v*"
  - "landmark@v*"
  - "map@v*"
  - "pathway@v*"
  - "summit@v*"
  - "gear@v*"
```

Verify: `yq '.on.push.tags' .github/workflows/publish-brew.yml` lists exactly seven entries; no `services@v*` or `utilities@v*` remain.

### 2. Collapse both `case "$NAME"` blocks onto a single `gear` branch

File modified: `.github/workflows/publish-brew.yml`. Two identical-shape blocks: the `build` job's "Extract bundle and version from tag" step (lines 33–37) and the `tap-pr` job's "Extract bundle and version from tag" step (lines 158–162).

Replace each occurrence:

```sh
# Before
case "$NAME" in
  services)   KIND=services;   BUNDLE="FIT Services.app";  CASK=fit-services  ;;
  utilities)  KIND=utilities;  BUNDLE="FIT Utilities.app"; CASK=fit-utilities ;;
  *)          KIND=product;    BUNDLE="fit-${NAME}.app";   CASK=fit-${NAME}   ;;
esac

# After
case "$NAME" in
  gear)  KIND=gear;     BUNDLE="fit-gear.app";    CASK=fit-gear    ;;
  *)     KIND=product;  BUNDLE="fit-${NAME}.app"; CASK=fit-${NAME} ;;
esac
```

The `tap-pr` block today omits `BUNDLE` from the `${GITHUB_OUTPUT}` echoes; preserve that omission.

Verify: `grep -n 'KIND=services\|KIND=utilities\|fit-services\|fit-utilities\|FIT Services\|FIT Utilities' .github/workflows/publish-brew.yml` returns no matches.

### 3. Update the `Build bundle` and `Verify cdhash stability` cases

File modified: `.github/workflows/publish-brew.yml`. Two `case "${{ steps.meta.outputs.kind }}"` blocks share identical structure and both need the same edit: lines 55–68 (`Build bundle`) and lines 91–104 (the rebuild branch inside `Verify cdhash stability`).

Replace each services/utilities pair with one gear arm:

```sh
case "${{ steps.meta.outputs.kind }}" in
  gear)
    just build-gear-binaries
    just build-app-gear
    ;;
  product)
    just build-binary "fit-${{ steps.meta.outputs.name }}"
    just build-app-product "${{ steps.meta.outputs.name }}"
    ;;
esac
```

Verify: both `case` blocks reference exactly two arms (`gear`, `product`); no `services` or `utilities` arm remains in either step.

### 4. Update the `Smoke test` step's primary CLI selection

File modified: `.github/workflows/publish-brew.yml` (lines 76–80).

```sh
# Before
case "${{ steps.meta.outputs.kind }}" in
  product)    "$BUNDLE/Contents/MacOS/fit-${{ steps.meta.outputs.name }}" --help ;;
  services)   "$BUNDLE/Contents/MacOS/fit-svcgraph" --help ;;
  utilities)  "$BUNDLE/Contents/MacOS/fit-codegen" --help ;;
esac

# After
case "${{ steps.meta.outputs.kind }}" in
  product)  "$BUNDLE/Contents/MacOS/fit-${{ steps.meta.outputs.name }}" --help ;;
  gear)     "$BUNDLE/Contents/MacOS/fit-svcgraph" --help ;;
esac
```

Verify: smoke test references no `services` or `utilities` arm; both surviving arms use the `${{ steps.meta.outputs.kind }}` value the new step 2 emits.

### 5. Refresh the in-line comment on the sed step

File modified: `.github/workflows/publish-brew.yml` (lines 205–208). The comment names `depends_on graph` as part of what survives the sed contract; the design retired inter-cask `depends_on`. Replace with:

```yaml
# Only the version and sha256 lines are updated per release. The rest of the
# cask body — binary stanzas, livecheck regex, deprecate! — is human-edited in
# the tap repo and survives releases unchanged. The casks declare no inter-cask
# dependencies, so each release rewrites exactly one cask file.
```

Verify: `grep -n 'depends_on graph' .github/workflows/publish-brew.yml` returns no matches.

### 6. Replace the legacy bundle recipes in the root `justfile`

File modified: `justfile` (`# ── Bundles` section, lines ≈175–323).

Delete: `build-service-binaries` (213–219), `build-utility-binaries` (221–242), `build-app-services` (271–283), `build-app-utilities` (285–312). Update `build-binaries` (202) and `build-apps` (314–323) to fan out through the new gear recipes.

Add `build-gear-binaries` and `build-app-gear`:

```just
# Compile every gear CLI (services + library binaries; must stay in sync with
# Casks/fit-gear.rb in the forwardimpact/homebrew-tap repo)
build-gear-binaries:
    just build-binary fit-svcgraph
    just build-binary fit-svcmcp
    just build-binary fit-svcpathway
    just build-binary fit-svctrace
    just build-binary fit-svcvector
    just build-binary fit-codegen
    just build-binary fit-terrain
    just build-binary fit-eval
    just build-binary fit-doc
    just build-binary fit-rc
    just build-binary fit-xmr
    just build-binary fit-storage
    just build-binary fit-logger
    just build-binary fit-svscan
    just build-binary fit-trace
    just build-binary fit-visualize
    just build-binary fit-query
    just build-binary fit-subjects
    just build-binary fit-process-graphs
    just build-binary fit-process-resources
    just build-binary fit-process-vectors
    just build-binary fit-search
    just build-binary fit-unary
    just build-binary fit-tiktoken
    just build-binary fit-download-bundle

# Assemble dist/apps/fit-gear.app — bundles all 25 service + library CLIs
build-app-gear:
    bash libraries/libmacos/scripts/build-app.sh \
      --bundle-name "fit-gear" \
      --primary-exec "dist/binaries/fit-svcgraph" \
      --extra-exec "dist/binaries/fit-svcmcp" \
      --extra-exec "dist/binaries/fit-svcpathway" \
      --extra-exec "dist/binaries/fit-svctrace" \
      --extra-exec "dist/binaries/fit-svcvector" \
      --extra-exec "dist/binaries/fit-codegen" \
      --extra-exec "dist/binaries/fit-terrain" \
      --extra-exec "dist/binaries/fit-eval" \
      --extra-exec "dist/binaries/fit-doc" \
      --extra-exec "dist/binaries/fit-rc" \
      --extra-exec "dist/binaries/fit-xmr" \
      --extra-exec "dist/binaries/fit-storage" \
      --extra-exec "dist/binaries/fit-logger" \
      --extra-exec "dist/binaries/fit-svscan" \
      --extra-exec "dist/binaries/fit-trace" \
      --extra-exec "dist/binaries/fit-visualize" \
      --extra-exec "dist/binaries/fit-query" \
      --extra-exec "dist/binaries/fit-subjects" \
      --extra-exec "dist/binaries/fit-process-graphs" \
      --extra-exec "dist/binaries/fit-process-resources" \
      --extra-exec "dist/binaries/fit-process-vectors" \
      --extra-exec "dist/binaries/fit-search" \
      --extra-exec "dist/binaries/fit-unary" \
      --extra-exec "dist/binaries/fit-tiktoken" \
      --extra-exec "dist/binaries/fit-download-bundle" \
      --info-plist "macos/gear/Info.plist" \
      --entitlements "macos/gear/entitlements.plist" \
      --version "$(jq -r .version package.json)" \
      --out-dir dist/apps
```

Update fan-out recipes:

```just
build-binaries: codegen build-product-binaries build-gear-binaries

build-apps: build-binaries
    just build-app-product outpost
    just build-app-product guide
    just build-app-product landmark
    just build-app-product map
    just build-app-product pathway
    just build-app-product summit
    just build-app-gear
```

Verify: `just --list | grep -E '^(build-(service|utility)-binaries|build-app-(services|utilities))'` returns nothing; `just --list | grep -E '^build-(gear-binaries|app-gear)'` lists both new recipes; `just --evaluate build-binaries build-apps` exits 0.

### 7. Create `macos/gear/` and remove the predecessor directories

Files created: `macos/gear/Info.plist`, `macos/gear/entitlements.plist`.
Files deleted: `macos/services/Info.plist`, `macos/services/entitlements.plist`, `macos/libraries/Info.plist`, `macos/libraries/entitlements.plist`. Remove the now-empty `macos/services/` and `macos/libraries/` directories.

`macos/gear/Info.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>fit-gear</string>
    <key>CFBundleDisplayName</key>
    <string>Forward Impact Gear</string>
    <key>CFBundleIdentifier</key>
    <string>team.forwardimpact.gear</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleExecutable</key>
    <string>fit-svcgraph</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHumanReadableCopyright</key>
    <string>Copyright © 2026 Forward Impact Engineering</string>
</dict>
</plist>
```

`macos/gear/entitlements.plist`: byte-copy of `macos/services/entitlements.plist` (identical to `macos/libraries/entitlements.plist`; verified `md5sum` match before this plan landed, so the union question is moot).

Verify: `ls macos/` returns `gear` only; `plutil -lint macos/gear/Info.plist` exits 0; `plutil -lint macos/gear/entitlements.plist` exits 0; `git grep -E 'macos/(services|libraries)/' -- ':!specs/' ':!**/state-of.md'` returns no matches.

### 8. Author the conventions document

File created: `websites/fit/docs/internals/release/index.md`.

Frontmatter:

```yaml
---
title: Homebrew Cask Conventions
description: How Forward Impact's Homebrew tap and publish-brew workflow stay coherent.
toc: false
---
```

Body sections (one section per cross-cutting decision named in spec § In scope; body headings start at `##` per `websites/CLAUDE.md`):

| Section heading | Coverage |
| --- | --- |
| `## Overview` | The tap repo's role; the `publish-brew.yml` workflow's role; where each authored field lives. Two paragraphs. |
| `## Sed contract` | The two fields the workflow rewrites (`version`, `sha256`); literal `sed -i` invocation; required two-space indent + double-quoted shape; what survives unchanged across releases. |
| `## Cask topology` | No inter-cask `depends_on`; six product casks each expose one CLI; `fit-gear` exposes 25 CLIs; `fit-basecamp` is a deprecated alias. Mermaid diagram from design § Cask Topology. |
| `## Binary stanza mapping` | Authoritative table — same rows as design § Binary Stanza Mapping. |
| `## Livecheck regex pattern` | `:github_releases` strategy with the cask's own download URL; per-cask `^{name}@v(\d+(?:\.\d+)+)$` regex anchoring; rationale for `^...$` against the multi-bundle releases page. |
| `## App install path` | `Forward Impact/` subdirectory under `/Applications/`; how `app` and `binary` stanzas reference it; why grouping (vs. flat install) was chosen. |
| `## Zap and uninstall paths` | `~/Library/Preferences/team.forwardimpact.{name}.plist` per cask; one row per cask. |
| `## Verification commands` | `brew style Casks/*.rb` and `brew audit --new-cask Casks/{cask}.rb`; what a human reviewer runs before merging a tap PR; how to dry-run the workflow's sed locally. |
| `## Deprecation precedent` | `fit-basecamp` rationale; date `2026-04-30`; rename target `fit-outpost`; reference to the storage-path migration command from #625 phase 8d. |
| `## What's next` | Partial-card grid (`<!-- part:card:... -->` only — no markdown link cards per `websites/CLAUDE.md`). Targets: `../operations`, `../kata`. Maximum four cards. |

Tables in the doc are denormalized from the design so editing one cask's conventions doesn't require touching the design. The doc carries no source-of-truth content the design already provides — it links to design-a.md by published URL only when a reader needs the mermaid topology in its source-of-truth form.

Verify: `bunx fit-doc serve --src=websites/fit --watch` (run in background, then kill) builds without errors; the rendered page at `/docs/internals/release/` carries every required section heading; `curl -s https://www.forwardimpact.team/docs/internals/release/index.md` is the URL the tap README's existing "Conventions" section links to (no monorepo edit to the README needed — it already targets this URL).

### 9. Add the release card to the internals hub

File modified: `websites/fit/docs/internals/index.md`. Insert `<!-- part:card:release -->` between the `operations` and `kata` partials so the rendered grid order is `librepl`, `vectors`, `operations`, `release`, `kata`.

Verify: `grep -c 'part:card:release' websites/fit/docs/internals/index.md` returns `1`; `bunx fit-doc serve --src=websites/fit` builds without complaint about a missing partial target.

### 10. Audit the seeded tap casks against the design

No files created or modified inside the monorepo. The eight cask files exist on `forwardimpact/homebrew-tap/main` (verified 2026-05-04 via `gh api repos/forwardimpact/homebrew-tap/git/trees/main?recursive=1`): `fit-pathway.rb`, `fit-map.rb`, `fit-guide.rb`, `fit-landmark.rb`, `fit-summit.rb`, `fit-outpost.rb`, `fit-gear.rb`, `fit-basecamp.rb`. Run a structural audit:

- For each live cask, confirm the stanzas design § Cask Anatomy prescribes are present in the prescribed shape: `version`, `sha256`, `url`, `name`, `desc`, `homepage`, `depends_on arch: :arm64`, `app … target: "Forward Impact/…"`, `binary` stanzas referencing `#{appdir}/Forward Impact/…`, `livecheck` block with `:github_releases` strategy and anchored regex, `zap trash:` clause.
- For `fit-basecamp.rb`, confirm `deprecate! date: "2026-04-30", because: …` matches design § Deprecated Cask. The cask carries `url`/`sha256` but no `app`, `binary`, or `livecheck`.
- Cross-check binary stanzas against design § Binary Stanza Mapping — exact name match, no extras, no omissions: 25 entries for `fit-gear.rb`, one entry per product cask.

If any cask deviates, capture the deviation in the audit log appended to this plan's PR as a comment and surface to the release-engineer. Reconciliation against the tap requires a `HOMEBREW_TAP_PAT` holder, which the staff-engineer agent does not have — reconciliation lands as a follow-up out-of-band PR on the tap repo, not as part of this plan's monorepo merge.

Verify: a written audit log enumerates each cask with a pass/fail row; no failing rows are open at end of step, or each failing row carries an opened tap-side reconciliation reference.

### 11. Dry-run the workflow's sed contract against each live cask

No files created or modified. Clone the tap, run the workflow's literal sed substitutions against each live cask with sample values, confirm the diff is exactly two changed lines, then run `brew style` against the rewritten file.

```sh
git clone https://github.com/forwardimpact/homebrew-tap /tmp/tap-audit
cd /tmp/tap-audit
SAMPLE_SHA256=$(printf 'sample' | shasum -a 256 | awk '{print $1}')
for CASK in fit-pathway fit-map fit-guide fit-landmark fit-summit fit-outpost fit-gear; do
  cp "Casks/${CASK}.rb" "Casks/${CASK}.rb.bak"
  sed -i.tmp \
    -e "s|^  version \".*\"|  version \"9.9.9\"|" \
    -e "s|^  sha256 \".*\"|  sha256 \"${SAMPLE_SHA256}\"|" \
    "Casks/${CASK}.rb"
  rm "Casks/${CASK}.rb.tmp"
  CHANGED=$(diff "Casks/${CASK}.rb.bak" "Casks/${CASK}.rb" | grep -c '^[<>]')
  test "$CHANGED" -eq 4 || echo "FAIL ${CASK}: expected 4 changed-line markers, got ${CHANGED}"
  brew style "Casks/${CASK}.rb"
  mv "Casks/${CASK}.rb.bak" "Casks/${CASK}.rb"
done
```

Verify: every iteration of the loop emits `4` (two field changes × before+after) and `brew style` exits 0. `fit-basecamp.rb` is excluded — the workflow's case statement maps `outpost@v*` to `fit-outpost`, never `fit-basecamp`, so `fit-basecamp.rb` is not sed-rewritten and the dry-run does not apply.

## Libraries used: none.

## Risks

- **`HOMEBREW_TAP_PAT` not yet provisioned on the monorepo.** The `tap-pr` job at line 190 authenticates against `forwardimpact/homebrew-tap` via `secrets.HOMEBREW_TAP_PAT`. The state-of audit (§ Must-have item 5) flags this secret as not yet set on `forwardimpact/monorepo`. This plan does not add the secret — a repo admin must create it out-of-band (classic PAT scoped `repo` to `forwardimpact/homebrew-tap` only, ≤ 1-year expiry) before the first `gear@v*` or product tag is pushed, or `tap-pr` will fail at checkout. Surface to the release-engineer as part of the kata-release-cut hand-off.
- **`fit-basecamp.rb` placeholder URL resolves to a missing asset after the first `outpost@v*` release.** The workflow's case statement maps `outpost@v*` to `CASK=fit-outpost`, never to `fit-basecamp`, so the sed step never updates `fit-basecamp.rb`. The basecamp cask's `url` interpolates `outpost@v#{version}` against the cask's own placeholder `version "0.0.0"`, which resolves to a non-existent release. A user who runs `brew install --cask fit-basecamp` after deprecation sees a 404 rather than the cleaner deprecation error. The cask has no `app` or `binary` so install was never the intended path — `brew search` discoverability is the contract — but the failure mode is worth flagging. Out of scope for this plan; capture as a follow-up against the deprecated-cask precedent.
- **Cask drift from design.** The tap was seeded externally (commit "feat: seed tap with initial casks", state-of.md § Step 3). Step 10 audits each cask against the design tables before this plan's verification gate closes. If drift is found and the staff-engineer cannot push to the tap (no `HOMEBREW_TAP_PAT`), reconciliation is deferred to a follow-up tap-side PR opened by a PAT-holder — the monorepo plan still merges, but SC4 is conditionally pending.

## Execution

Three strands. Steps 1–7 and 8–9 are independent and can run in parallel under different agents; steps 10–11 verify the whole and run after step 6 has merged so the production sed contract under audit matches the workflow shape this plan installed.

| Steps | Owner | PR title | Notes |
| --- | --- | --- | --- |
| 1, 2, 3, 4, 5, 6, 7 | `staff-engineer` | `feat(740): consolidate gear bundle into publish-brew + justfile` | All monorepo edits in one branch. Steps 1–5 are workflow YAML; step 6 is the justfile; step 7 is plist creation/deletion. |
| 8, 9 | `technical-writer` | `docs(740): homebrew cask conventions` | Conventions doc + internals card. Independent of the consolidation PR; can land in either order. |
| 10, 11 | `staff-engineer` | (verification only — no monorepo PR) | Runs after the consolidation PR merges. Audit log filed as a comment on this plan's PR; tap-side reconciliation, if needed, is opened separately by a `HOMEBREW_TAP_PAT` holder. |

Sequencing: 1–7 ‖ 8–9 (parallel); 10–11 follows 1–7 (sequential).

— Staff Engineer 🛠️

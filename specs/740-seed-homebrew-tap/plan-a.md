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

Verify: `grep -E '^\s+- "[a-z]+@v\*"' .github/workflows/publish-brew.yml | wc -l` returns `7`; `grep -nE '"(services|utilities)@v\*"' .github/workflows/publish-brew.yml` returns no matches. (Plain `grep` rather than `yq` because the YAML key `on:` parses to boolean `true` under some `yq` builds.)

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

File modified: `.github/workflows/publish-brew.yml` (lines 205–208). Replace with:

```yaml
# Only the version and sha256 lines are updated per release. The rest of the
# cask body — binary stanzas, livecheck regex, deprecate! on fit-basecamp — is
# human-edited in the tap repo and survives releases unchanged. The casks
# declare no inter-cask dependencies, so each release rewrites exactly one
# cask file.
```

Verify: `git grep -nE 'depends_on graph' -- .github` returns no matches across the repo (catches the same outdated phrase if it migrated to any other workflow file).

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

Update fan-out recipes (explicit before/after to prevent partial edits):

```just
# Before
build-binaries: codegen build-product-binaries build-service-binaries build-utility-binaries

build-apps: build-binaries
    just build-app-product outpost
    just build-app-product guide
    just build-app-product landmark
    just build-app-product map
    just build-app-product pathway
    just build-app-product summit
    just build-app-services
    just build-app-utilities

# After
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

Verify: `just --list | grep -E '^(build-(service|utility)-binaries|build-app-(services|utilities))'` returns nothing; `just --list | grep -E '^build-(gear-binaries|app-gear)'` lists both new recipes; `just --show build-binaries` and `just --show build-apps` print the post-edit recipe bodies above (no `services` / `utilities` references); `just --dry-run build-apps` exits 0.

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

Verify: `ls macos/` returns `gear` only; `plutil -lint macos/gear/Info.plist` exits 0; `plutil -lint macos/gear/entitlements.plist` exits 0; `git grep -nE 'macos/(services|libraries)/' -- ':!specs'` returns no matches (specs are excluded because design-a.md, state-of.md, and this plan reference the predecessor paths historically).

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
| `## Cask topology` | No inter-cask `depends_on`; six product casks each expose one CLI; `fit-gear` exposes 25 CLIs; `fit-basecamp` is a deprecated alias. Reproduce the Mermaid diagram from design § Cask Topology — the conventions doc is the long-lived reference for tap reviewers and stands on its own without a hop to the design. |
| `## Binary stanza mapping` | Authoritative table — same rows as design § Binary Stanza Mapping. |
| `## Livecheck regex pattern` | `:github_releases` strategy with the cask's own download URL; per-cask `^{name}@v(\d+(?:\.\d+)+)$` regex anchoring; rationale for `^...$` against the multi-bundle releases page. |
| `## App install path` | `Forward Impact/` subdirectory under `/Applications/`; how `app` and `binary` stanzas reference it; why grouping (vs. flat install) was chosen. |
| `## Zap and uninstall paths` | `~/Library/Preferences/team.forwardimpact.{name}.plist` per cask; one row per cask. |
| `## Verification commands` | `brew style Casks/*.rb` and `brew audit --new-cask Casks/{cask}.rb`; what a human reviewer runs before merging a tap PR; how to dry-run the workflow's sed locally. |
| `## Deprecation precedent` | `fit-basecamp` rationale; date `2026-04-30`; rename target `fit-outpost`; reference to the storage-path migration command from #625 phase 8d. |
| `## What's next` | Partial-card grid (`<!-- part:card:... -->` only — no markdown link cards per `websites/CLAUDE.md`). Targets: `../operations`, `../kata`. Maximum four cards. |

Tables in the doc are denormalized from the design so editing one cask's conventions doesn't require touching the design. The conventions doc is the long-lived reference for tap reviewers; once it lands, the tap README's existing link to `https://www.forwardimpact.team/docs/internals/release/` resolves (the README already targets this URL — no monorepo edit to the tap README is needed).

Verify: `bunx fit-doc build --src=websites/fit` exits 0 and produces `dist/docs/internals/release/index.html`; `grep -c '^## ' websites/fit/docs/internals/release/index.md` returns at least `9` (one per required section heading from the table above plus `## What's next`).

### 9. Add the release card to the internals hub

File modified: `websites/fit/docs/internals/index.md`. Insert `<!-- part:card:release -->` between the `operations` and `kata` partials so the rendered grid order is `librepl`, `vectors`, `operations`, `release`, `kata`. Order rule: read-flow grouping (developer toolchain → site infra → human-process → automation), not alphabetical; `release` slots into the human-process bucket alongside `operations`.

Step 9 must follow step 8 within the same `technical-writer` PR — `fit-doc build` fails if a `part:card:` target points at a nonexistent page (`websites/CLAUDE.md` § Hub Pages: "the build fails if a partial references a nonexistent page"). Land step 8's `release/index.md` first.

Verify: `grep -c 'part:card:release' websites/fit/docs/internals/index.md` returns `1`; `bunx fit-doc build --src=websites/fit` exits 0 and emits `dist/docs/internals/index.html` with a card linking to `/docs/internals/release/`.

### 10. Audit the seeded tap casks against the design

No files created or modified inside the monorepo. The eight cask files exist on `forwardimpact/homebrew-tap/main` (verified 2026-05-04 via `gh api repos/forwardimpact/homebrew-tap/git/trees/main?recursive=1`): `fit-pathway.rb`, `fit-map.rb`, `fit-guide.rb`, `fit-landmark.rb`, `fit-summit.rb`, `fit-outpost.rb`, `fit-gear.rb`, `fit-basecamp.rb`. Run a structural audit:

- For each live cask, confirm the stanzas design § Cask Anatomy prescribes are present in the prescribed shape: `version`, `sha256`, `url`, `name`, `desc`, `homepage`, `depends_on arch: :arm64`, `app … target: "Forward Impact/…"`, `binary` stanzas referencing `#{appdir}/Forward Impact/…`, `livecheck` block with `:github_releases` strategy and anchored regex, `zap trash:` clause.
- For `fit-basecamp.rb`, confirm `deprecate! date: "2026-04-30", because: …` matches design § Deprecated Cask. The cask carries `url`/`sha256` but no `app`, `binary`, or `livecheck`. **Also** confirm the `desc` field names the storage-path manual-migration command from #625 phase 8d as spec § In scope requires — the seeded cask's `desc` reads "Renamed to fit-outpost — install forwardimpact/tap/fit-outpost instead", which does **not** name the migration command and is therefore expected to fail this row of the audit.
- Cross-check binary stanzas against design § Binary Stanza Mapping — exact name match, no extras, no omissions: 25 entries for `fit-gear.rb`, one entry per product cask.

Reconciliation: the staff-engineer cannot push to `forwardimpact/homebrew-tap` (no `HOMEBREW_TAP_PAT`). For each failing row, file a comment on this plan's PR with the deviation and open a tap-side issue at `forwardimpact/homebrew-tap` titled `spec/740: <cask> drift — <criterion>`, assigning the release-engineer. SC4 ("executable names match … performed at seed time") passes for the live casks whose audit row is clean, and is conditionally pending for any failing row until the tap-side reconciliation issue closes. The basecamp `desc` row above is the known expected failure.

Verify: a written audit log enumerates each cask with a pass/fail row per criterion; no consensus failing rows remain unowned (each carries a tap-side issue link).

### 11. Dry-run the workflow's sed contract against each live cask

No files created or modified. The dry-run runs the workflow's literal `sed -i` (no backup suffix) against each live cask with sample values, confirms the diff is exactly two changed lines, then runs `brew style` against the rewritten file.

Host requirement: `brew style` requires a Homebrew install with cask support — macOS arm64 native or Linuxbrew with `brew tap homebrew/cask` (Linuxbrew's cask support is partial and may surface false negatives). The `staff-engineer` agent typically runs on Linux; route this step to a macOS runner or a contributor's local macOS shell. If neither is available, file the dry-run as a deferred verification owned by the release-engineer's first `gear@v*` release rehearsal.

```sh
# Run on macOS arm64 with Homebrew installed.
git clone https://github.com/forwardimpact/homebrew-tap /tmp/tap-audit
cd /tmp/tap-audit
SAMPLE_SHA256=$(printf 'sample' | shasum -a 256 | awk '{print $1}')
for CASK in fit-pathway fit-map fit-guide fit-landmark fit-summit fit-outpost fit-gear; do
  cp "Casks/${CASK}.rb" "/tmp/${CASK}.rb.bak"
  # Literal workflow sed contract — no backup suffix; matches publish-brew.yml line 210.
  sed -i \
    -e "s|^  version \".*\"|  version \"9.9.9\"|" \
    -e "s|^  sha256 \".*\"|  sha256 \"${SAMPLE_SHA256}\"|" \
    "Casks/${CASK}.rb"
  # `diff | grep -c '^[<>]'` counts each changed line twice (one `<` for the before
  # line, one `>` for the after line); two field substitutions ⇒ 4 markers. The seeded
  # version "0.0.0" and sha256 "00…" never collide with the sample values, so 4 is the
  # invariant.
  CHANGED=$(diff "/tmp/${CASK}.rb.bak" "Casks/${CASK}.rb" | grep -c '^[<>]')
  test "$CHANGED" -eq 4 || { echo "FAIL ${CASK}: expected 4 changed-line markers, got ${CHANGED}"; exit 1; }
  brew style "Casks/${CASK}.rb"
  mv "/tmp/${CASK}.rb.bak" "Casks/${CASK}.rb"
done
```

Verify: every iteration of the loop produces a clean `brew style` (exit 0) with no `FAIL` line emitted; the loop exits 0 overall. `fit-basecamp.rb` is excluded — the workflow's case statement maps `outpost@v*` to `fit-outpost`, never `fit-basecamp`, so `fit-basecamp.rb` is not sed-rewritten and the dry-run does not apply.

## Libraries used: none.

## Risks

- **`HOMEBREW_TAP_PAT` not yet provisioned on the monorepo.** The `tap-pr` job at line 190 authenticates against `forwardimpact/homebrew-tap` via `secrets.HOMEBREW_TAP_PAT`. State-of audit § Must-have item 5 flags this secret as not yet set on `forwardimpact/monorepo`. This plan does not add the secret — a repo admin (release-engineer) creates it out-of-band (classic PAT scoped `repo` to `forwardimpact/homebrew-tap` only, ≤ 1-year expiry) before the first `gear@v*` or product tag is pushed, or `tap-pr` will fail at checkout. Owner: `release-engineer`. Verification gate: secret presence audit during the first `kata-release-cut` rehearsal that follows this plan's merge.
- **Cask drift from design.** The tap was seeded externally (commit "feat: seed tap with initial casks", state-of.md § Step 3). Step 10 audits each cask against the design tables before this plan's verification gate closes; the basecamp `desc`-vs-spec row is a known expected fail. Reconciliation requires a `HOMEBREW_TAP_PAT` holder, so the staff-engineer files an issue per failing row at `forwardimpact/homebrew-tap` (title pattern `spec/740: <cask> drift — <criterion>`) and assigns `release-engineer`. SC4 conditionally passes for clean rows and remains pending for failing rows until each tap-side issue closes.

## Known limitations (visible from this plan; surface as follow-up, not blocking)

- **`fit-basecamp.rb` placeholder URL resolves to a 404 after the first `outpost@v*` release.** The workflow's case statement maps `outpost@v*` to `CASK=fit-outpost`, never `fit-basecamp`; the sed step never updates `fit-basecamp.rb`. The basecamp cask's `url` interpolates `outpost@v#{version}` against the cask's own placeholder `version "0.0.0"`, resolving to a non-existent release. A user who runs `brew install --cask fit-basecamp` after deprecation sees a 404 rather than the cleaner deprecation error. The cask has no `app` or `binary` so install was never the intended path — `brew search` discoverability is the contract — but the failure mode is worth tracking. Owner: `release-engineer` files a follow-up issue at `forwardimpact/homebrew-tap` titled `fit-basecamp: replace placeholder url with versionless deprecated stub` after this plan merges.

## Execution

Three strands. The two PR-shipping strands (steps 1–7 and 8–9) and the verification strand (steps 10–11) are all independent — the seeded casks on tap main don't change shape based on which monorepo PR lands first, and the dry-run runs the literal sed contract against tap state, not against the post-merge workflow. The verification strand is sequenced second only because its findings are most useful once the implementer can route any drift back into a follow-up tap PR with the consolidation PR's context.

| Steps | Owner | PR title | Notes |
| --- | --- | --- | --- |
| 1, 2, 3, 4, 5, 6, 7 | `staff-engineer` | `feat(740): consolidate gear bundle into publish-brew + justfile` | All monorepo edits in one branch. Steps 1–5 are workflow YAML; step 6 is the justfile; step 7 is plist creation/deletion. |
| 8, 9 | `technical-writer` | `docs(740): homebrew cask conventions` | Conventions doc + internals card in one branch. Step 8 lands first within the PR's commit history so step 9's `part:card:release` partial resolves at build time. Independent of the consolidation PR; can land in either order. |
| 10, 11 | `staff-engineer` (audit) + macOS host (sed dry-run) | (verification only — no monorepo PR) | Audit log filed as a comment on this plan's PR. Step 11's `brew style` dry-run requires a macOS arm64 host with Homebrew installed; if the runner is Linux-only, defer step 11 to the release-engineer's first `gear@v*` rehearsal. Tap-side reconciliation issues, if any, are opened separately at `forwardimpact/homebrew-tap` and assigned to the release-engineer. |

Sequencing: 1–7 ‖ 8–9 (parallel); 10–11 follows the consolidation PR merge for context, but does not block on it (the audit can run against tap main any time).

— Staff Engineer 🛠️

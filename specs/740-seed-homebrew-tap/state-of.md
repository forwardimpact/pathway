# State of Spec 740 — Seed `forwardimpact/homebrew-tap`

Research date: 2026-05-03

## Executive Summary

Spec 740 (seed the Homebrew tap with initial casks) is the final missing piece
that connects spec 600's fully-built release pipeline to actual end-user
installs. The monorepo side of spec 600 is ~75% complete — build recipes,
bundle assembly, and the publish-brew workflow all exist. But the tap repository
is empty, so every brew publish run fails. Two independent bugs (#627, #647)
also block end-to-end success. PR #648 (this spec) is approved but **on hold**
pending a reframing of `fit-utilities` by the project owner.

## Spec 600 Implementation Status

### Step 1a — `libraries/libmacos` extraction: COMPLETE

All files present and functional:
- `src/posix-spawn.js`, `src/tcc-responsibility.js`, `src/index.js`
- `scripts/build-app.sh`, `scripts/sign-app.sh`
- `templates/entitlements.plist`, `templates/entitlements-gui.plist`,
  `templates/Info.plist.hbs`
- `test/tcc-responsibility.test.js`
- Basecamp (now Outpost) migrated to consume libmacos

### Step 1b — Root justfile bundle recipes: COMPLETE

All recipes exist under `# ── Bundles` in the root `justfile`:

- `build-binary NAME TARGET` — generic, scans `package.json` bin fields
- `build-product-binaries` — 6 products (outpost, guide, landmark, map,
  pathway, summit)
- `build-service-binaries` — 5 gRPC servers (fit-svc{graph,mcp,pathway,trace,
  vector})
- `build-utility-binaries` — 20 library CLIs
- `build-app-product NAME`, `build-app-services`, `build-app-utilities`
- `build-apps` — fan-out for all 8 bundles

Per-bundle metadata exists:
- `products/{guide,landmark,map,pathway,summit}/macos/{Info.plist,
  entitlements.plist}`
- `products/outpost/macos/{Info.plist,Outpost.entitlements}`
- `macos/services/{Info.plist,entitlements.plist}`
- `macos/libraries/{Info.plist,entitlements.plist}`

All 5 service `package.json` files have `bin` entries.

### Step 2 — Release workflow: COMPLETE

`.github/workflows/publish-brew.yml` exists with:
- Tag filter: 8 explicit patterns (`outpost@v*`, `guide@v*`, `landmark@v*`,
  `map@v*`, `pathway@v*`, `summit@v*`, `services@v*`, `utilities@v*`)
- `build` job (macos-14): compile, codesign, cdhash stability gate, ditto zip,
  sha256 sidecar, gh release create/upload
- `tap-pr` job (ubuntu-latest): downloads sha256, checks out
  `forwardimpact/homebrew-tap`, updates `version` and `sha256` via `sed -i`,
  opens PR

The sed contract the casks must satisfy:
```
sed -i \
  -e "s|^  version \".*\"|  version \"${VERSION}\"|" \
  -e "s|^  sha256 \".*\"|  sha256 \"${SHA256}\"|" \
  "tap/Casks/${CASK}.rb"
```

### Step 2b — Basecamp/Outpost TCC verification: NO EVIDENCE

No explicit record of the manual hardware TCC test. Outpost was renamed from
Basecamp post-spec-600; the TCC responsibility chain should be re-verified
against the Outpost bundle identity before the first `outpost@v*` tag.

### Step 3 — Homebrew tap repository: EMPTY

`forwardimpact/homebrew-tap` exists (created 2026-04-23) but the GitHub API
returns `"This repository is empty."` — no branches, no `Casks/` directory, no
cask files. This is the gap spec 740 fills.

### Step 4 — Product overview documentation: NOT DONE

No product overview page has a brew install section:
- `websites/fit/pathway/index.md` — npm only
- `websites/fit/guide/index.md` — npm only
- `websites/fit/landmark/index.md` — npm only
- `websites/fit/map/index.md` — npm only
- `websites/fit/summit/index.md` — npm only
- `websites/fit/outpost/index.md` — mentions Homebrew only for Claude Code
  prerequisite, not for Outpost itself

No Gatekeeper caveat documented. No codegen internals page update.

The conventions doc location `websites/fit/docs/internals/release/` does not
exist yet.

## Spec 740 Current State

### PR #648

- Branch: `spec/730-seed-homebrew-tap`
- Status: **OPEN**, label `hold`
- `spec:approved` but merge blocked by hold
- Hold reason: project owner will return with a "new framing of fit-utilities"
  that may reshape the spec's scope

### What spec 740 covers

Nine cask files for the tap repo:
1. `fit-pathway.rb` — product cask
2. `fit-map.rb` — product cask
3. `fit-guide.rb` — product cask
4. `fit-landmark.rb` — product cask
5. `fit-summit.rb` — product cask
6. `fit-outpost.rb` — product cask
7. `fit-services.rb` — shared bundle (5 gRPC servers)
8. `fit-utilities.rb` — shared bundle (20 library CLIs)
9. `fit-basecamp.rb` — deprecated alias → `fit-outpost`

Plus a cask conventions document in `websites/fit/docs/internals/release/`.

### What spec 740 does NOT cover

- Runtime `__dirname`/bunfs fix (#627) — separate, parallel work
- VERSION injection for library/service bins (#647) — follow-on to #627
- Tagging `outpost@v3.0.0` (#625 phase 8b)
- npm deprecation of `@forwardimpact/basecamp` (#625 phase 8c)
- TCC re-authorization release notes (#625 phase 8d)
- Product overview brew install documentation (spec 600 step 4)
- Tap-side CI (`brew style`, `brew audit`)

## Open Issues

### #645 — Seed forwardimpact/homebrew-tap with initial casks

Central issue. The empty tap blocks all brew publishing. Spec 740 is the
response.

### #625 — Outpost rename: Phase 8 cross-repo follow-ups

Phases 8a–8d are blocked by the empty tap:
- **8a**: Author `fit-outpost.rb` cask + deprecate `fit-basecamp` — blocked by
  empty tap
- **8b**: Tag `outpost@v3.0.0`, verify publish-brew + publish-macos — blocked
  by 8a
- **8c**: `npm deprecate @forwardimpact/basecamp` — independent, can proceed
- **8d**: Release notes for outpost v3.0.0 — blocked by 8b

### #627 — Brew publish smoke test fails on bun --compile + readFileSync

All product brew publishes have been failing since ~2026-04-28. Compiled
binaries resolve `__dirname` to `/$bunfs/root`, causing
`readFileSync(join(__dirname, "..", "package.json"))` to ENOENT.

Fix: inject VERSION at compile time via `--define`.

- Fix PR: #646 (open, fixes 5 product CLIs — outpost, guide, landmark, map,
  pathway, summit)

### #647 — Apply VERSION-injection pattern to library and service CLI bins

Same `__dirname`/bunfs pattern in ~20 library/service CLI bins. Lower priority
since `utilities@v*` and `services@v*` tags are cut less frequently.

- Fix PR: #650 (open, depends on #646 merging first)

## Open PRs

| PR   | Title                                     | Branch                            | Status        |
| ---- | ----------------------------------------- | --------------------------------- | ------------- |
| #648 | spec(740): seed homebrew-tap              | `spec/730-seed-homebrew-tap`      | Open, on hold |
| #646 | fix: inject VERSION at compile time       | `fix/brew-bunfs-version-injection`| Open          |
| #650 | fix: VERSION injection for library bins   | `fix/647-version-injection-lib..` | Open          |
| #607 | design(700): git-installable pack repos   | `spec/700-git-installable-packs`  | Open          |

## Dependency Graph

```
Empty tap (#645)
  └─ spec 740 / PR #648 (ON HOLD — fit-utilities reframing)
       └─ #625 phases 8a–8d (outpost rename cross-repo)

bunfs __dirname (#627)
  └─ PR #646 (product CLIs)
       └─ #647 → PR #650 (library/service CLIs)

Both #645 and #627 must resolve for end-to-end brew publish to work.
They are independent and can proceed in parallel.

Spec 600 Step 4 (docs) is independent of both — can start once cask
names and tap path are confirmed.
```

## Executable Surface Cross-Reference

The casks must advertise exactly the executables each bundle produces. Current
source-of-truth:

### Product bundles (one CLI each)

| Bundle           | Executable     |
| ---------------- | -------------- |
| fit-outpost.app  | fit-outpost    |
| fit-guide.app    | fit-guide      |
| fit-landmark.app | fit-landmark   |
| fit-map.app      | fit-map        |
| fit-pathway.app  | fit-pathway    |
| fit-summit.app   | fit-summit     |

### FIT Services.app (5 CLIs)

fit-svcgraph, fit-svcmcp, fit-svcpathway, fit-svctrace, fit-svcvector

### FIT Utilities.app (20 CLIs)

fit-codegen, fit-terrain, fit-eval, fit-doc, fit-rc, fit-xmr, fit-storage,
fit-logger, fit-svscan, fit-trace, fit-visualize, fit-query, fit-subjects,
fit-process-graphs, fit-process-resources, fit-process-vectors, fit-search,
fit-unary, fit-tiktoken, fit-download-bundle

**Note:** The `fit-utilities` reframing may change this list. The hold on
PR #648 is specifically about reconsidering this shared bundle's scope and
composition.

## Gaps to Close for Full Spec 600 + 740 Completion

### Must-have (blocks end-to-end brew install)

1. **Seed the tap** (spec 740): Author 9 cask files in
   `forwardimpact/homebrew-tap`. Blocked by `hold` on PR #648 pending
   fit-utilities reframing.
2. **Fix bunfs __dirname** (#627): Merge PR #646 so product binaries resolve
   `--version` without ENOENT.
3. **Fix library/service __dirname** (#647): Merge PR #650 so `utilities@v*`
   and `services@v*` binaries also work.
4. **Add `HOMEBREW_TAP_PAT` secret** to the monorepo. Must exist before the
   first release tag triggers the workflow.

### Should-have (spec 600 completeness)

5. **Product overview documentation** (spec 600 step 4): Add brew install
   sections with Gatekeeper caveat to all 6 product overview pages + codegen
   internals page.
6. **Cask conventions document**: Author
   `websites/fit/docs/internals/release/` conventions page. Spec 740 requires
   it; spec 600 plan step 3 anticipated it.
7. **TCC verification** (spec 600 step 2b): Perform manual hardware test of
   Outpost bundle's Calendar/Contacts TCC chain before first `outpost@v*` tag.

### Expansion opportunity for spec 740

Bringing spec 600 step 4 (documentation) into spec 740's scope would let a
single spec/plan/implement cycle close out both specs completely. The docs
work is independent of the tap seeding but logically adjacent — once cask
names and the tap path are fixed, the brew install sections can be written.
This would turn spec 740 from "seed the tap" into "complete the Homebrew
distribution channel."

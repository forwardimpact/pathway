# Spec 730 — Seed `forwardimpact/homebrew-tap` with initial casks

## Problem

The `forwardimpact/homebrew-tap` repository exists (created 2026-04-23) but
holds **zero casks**: empty default branch, no `Casks/` directory, no
conventions doc. Every brew publish run in `.github/workflows/publish-brew.yml`
fails downstream of this gap:

- The `tap-pr` job on line 209 runs
  `sed -i -e "s|^  version \".*\"|  version \"${VERSION}\"|" "tap/Casks/${CASK}.rb"`.
  No file exists, so the sed targets a missing path and the workflow errors.
- The workflow's tag filter on lines 9–16 covers eight bundles —
  `outpost`, `guide`, `landmark`, `map`, `pathway`, `summit`, `services`,
  `utilities` — all of which require a corresponding `Casks/{cask}.rb` to be
  updateable on release.
- Issue #625 phase 8a was scoped as "copy `Casks/fit-basecamp.rb` →
  `Casks/fit-outpost.rb`". The source cask does not exist either, so phase 8a
  cannot run as written.
- Issue #627 documents 20+ consecutive brew-publish failures (earliest visible:
  2026-04-28; most recent: 2026-04-30 21:35Z) for all five product publishes
  attempted to date. The runtime `__dirname`/bunfs failure that #627 names is
  one cause; the empty tap is a second, independent cause that #627 did not
  surface because the smoke test fails first.

The first cask authored sets the precedent the next seven inherit. The
`depends_on` graph between product casks and the two shared bundles, the
livecheck regex shape against the `<bundle>@v<semver>` tag scheme, the binary
stanzas that surface every CLI on PATH, and the deprecation precedent for the
`basecamp → outpost` rename are cross-cutting first-mover decisions. Authoring
them once, in concert, is qualitatively different from copy-pasting an existing
template — there is no template yet.

## Why

Two distribution promises are unmet until the tap is seeded:

1. **Spec 600 SC11.** "After the documented `brew install` command for any
   product cask runs on a clean macOS arm64 machine, every `fit-*` CLI surfaced
   by that product and by the two shared bundles that `depends_on` pulls in is
   on the user's `PATH` and answers `--help`." Today no `brew install` command
   resolves at all — the tap has no casks to install.
2. **Issue #625 8a–8d.** The Outpost rename's cross-repo follow-ups (cask
   author, tag, npm deprecate, release notes) are blocked behind 8a. 8b/8c/8d
   remain queued.

Seeding the tap also retires a class of confusion. The publish-brew workflow's
existing comment ("the rest of the cask body — depends_on graph, binary
stanzas, livecheck regex — lives in the tap repo and is edited there by humans
when bundle contents change") presumes a tap whose casks already encode those
decisions. Until the tap is seeded, that comment describes a contract no party
can fulfill.

## Scope

### In scope

- Authoring eight live casks plus one deprecated cask in
  `forwardimpact/homebrew-tap`, written in concert so the depends_on graph,
  livecheck strategy, binary stanzas, zap/uninstall paths, and the
  publish-brew sed contract are consistent across all of them.
- The cask conventions document inside the monorepo at
  `websites/fit/docs/internals/release/casks.md`. The tap repo's README links
  to it but does not duplicate it. Rationale: the conventions describe an
  artifact whose bytes are written by `.github/workflows/publish-brew.yml`
  living in this repo; the conventions decay together with the workflow when
  either changes, and review of the workflow PR co-locates with review of the
  conventions PR.
- The deprecated `Casks/fit-basecamp.rb` cask, ship-ready with
  `deprecate! date: "2026-04-30", because: :renamed_formula` and a description
  that names the storage-path manual-migration command from #625 8d. Reason:
  legacy users who run `brew search fit-basecamp` after the tap is published
  must be redirected to `fit-outpost`; an absent cask surfaces nothing, and a
  live cask without `deprecate!` lies about supported state.

### Out of scope

- The runtime `__dirname`/bunfs fix tracked in #627. That is a substantive
  change to product `bin/*.js` and `libcli`. This spec and #627 are
  independent: both are required for end-to-end brew publish to work, but they
  touch disjoint artifacts (tap repo state vs. monorepo runtime code) and can
  proceed in parallel. Neither blocks the other's design or implementation.
- Tagging `outpost@v3.0.0` (#625 phase 8b) and the npm deprecation (#625 phase
  8c). Those depend on this spec landing but are not its work product.
- The TCC re-authorization release notes (#625 phase 8d). Released-notes
  copywriting is downstream of the cask landing.
- Linux or Intel-Mac casks. Spec 600 fixed the channel as macOS arm64 only;
  this spec inherits that constraint without revisiting it.
- Multi-version installation (`brew install fit-pathway@<old>`). Each cask
  serves the latest released version per the sed-in-place workflow. Multi-tag
  archival is a follow-up if needed.
- Tap-side CI for the casks themselves (`brew style`, `brew audit`). The
  conventions doc names the commands a human reviewer should run; automating
  them in the tap repo is a follow-up.

### Affected products

All eight bundles whose tags `publish-brew.yml` accepts:

| Tag prefix    | Cask name        | Bundle                  | App on disk                    |
| ------------- | ---------------- | ----------------------- | ------------------------------ |
| `pathway@v*`  | `fit-pathway`    | product                 | `fit-pathway.app`              |
| `map@v*`      | `fit-map`        | product                 | `fit-map.app`                  |
| `guide@v*`    | `fit-guide`      | product                 | `fit-guide.app`                |
| `landmark@v*` | `fit-landmark`   | product                 | `fit-landmark.app`             |
| `summit@v*`   | `fit-summit`     | product                 | `fit-summit.app`               |
| `outpost@v*`  | `fit-outpost`    | product                 | `fit-outpost.app`              |
| `services@v*` | `fit-services`   | shared (gRPC services)  | `FIT Services.app`             |
| `utilities@v*`| `fit-utilities`  | shared (CLI utilities)  | `FIT Utilities.app`            |
| (none)        | `fit-basecamp`   | deprecated alias        | (no app shipped; `deprecate!`) |

## Success criteria

| Claim                                                                                                                                                                            | Verifiable by                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every bundle that `publish-brew.yml` accepts has a corresponding `Casks/{cask}.rb` in the tap, plus a deprecated `Casks/fit-basecamp.rb`.                                        | `gh api repos/forwardimpact/homebrew-tap/contents/Casks` returns nine entries matching the table above.                                                                    |
| The publish-brew workflow's sed step succeeds against every live cask without manual edits.                                                                                      | Each live cask contains exactly one line matching `^  version "[^"]*"$` and exactly one matching `^  sha256 "[^"]*"$`. Verifiable by `grep -c` on each `Casks/{cask}.rb`.  |
| `brew style Casks/*.rb` and `brew audit --new-cask Casks/{cask}.rb` pass on every live cask after seed.                                                                          | Both commands run against a checkout of the seeded tap exit 0. Run as a one-shot manual check before declaring 8a complete.                                                |
| Installing any product cask surfaces every `fit-*` CLI it advertises on PATH (Spec 600 SC11) by reaching the shared services and utilities bundles through `depends_on`.         | After tagging one product through `publish-brew.yml`, `brew install --cask forwardimpact/tap/fit-{product}` followed by `which fit-svcgraph` and `which fit-codegen` both succeed. |
| `fit-basecamp` is discoverable by `brew search` and visibly deprecated, redirecting users to `fit-outpost`.                                                                      | `brew tap forwardimpact/tap && brew search fit-basecamp` lists the cask; `brew info fit-basecamp` shows the deprecation date and reason and references the rename target.  |
| The conventions doc names the depends_on graph, the binary-stanza pattern, the livecheck regex against `<bundle>@v<semver>`, the zap/uninstall paths, and the deprecation precedent. | `websites/fit/docs/internals/release/casks.md` exists, is linked from `websites/fit/docs/internals/release/index.md` and the tap repo's `README.md`, and covers the five named subjects. |
| The tap is reachable end-to-end on a clean macOS arm64 machine after this spec lands and one product tag fires.                                                                  | On a fresh runner: `brew tap forwardimpact/tap && brew install --cask fit-outpost && fit-outpost --help` exits 0 with no manual interventions.                            |

## Notes

- Asset filename and bundle name patterns are fixed by `publish-brew.yml`
  lines 33–44 and 113–123: each cask's `url` template must resolve to
  `{cask}-{version}-darwin-arm64.zip` on the GitHub release for the
  corresponding tag.
- The publish-brew sed rewrites only `version` and `sha256`. Every other
  attribute — `homepage`, `name`, `desc`, `app`, `binary`, `livecheck`, `zap`,
  `depends_on`, `deprecate!` — is human-edited in the tap repo and survives
  releases unchanged. Casks must be authored with that asymmetry in mind.
- The `fit-basecamp` deprecation date `2026-04-30` matches the date stipulated
  in #625 phase 8a and aligns with the Outpost rename's clean-break stance
  (USPTO Reg. 3202059).
- This spec lives in the monorepo because the design and plan that follow
  describe how monorepo conventions and tap conventions stay coherent. The
  resulting cask files land in `forwardimpact/homebrew-tap`, which is outside
  the spec/design/plan/implement chain's normal merge path. The plan must
  account for that boundary.

## References

- Issue #645 — this work item, with the four open questions this spec answers.
- Issue #625 — Outpost rename Phase 8 (8a/8b/8c/8d blocked behind this spec).
- Issue #627 — runtime `__dirname`/bunfs failure (independent, parallel).
- Spec 600 — Native binary distribution (parent; SC11 is the install-surface
  contract this spec realizes; "Tap repository location" was an open question
  600 deferred and 730 closes).
- `.github/workflows/publish-brew.yml` — workflow whose sed contract every
  cask must satisfy.

— Product Manager 🌱

# Plan 730 — Dependabot ↔ `.github/actions/` directory sync

## Approach

Replace the five hand-maintained `directories:` entries in
`.github/dependabot.yml` with a single `/.github/actions/*` glob (lever A from
the design), and add `scripts/check-dependabot.mjs` as the verification runtime
that asserts the coverage invariant on every PR. The script is wired into both
the local `bun run context` chain and a dedicated job in
`.github/workflows/check-security.yml`, so the merge gate fails when filesystem
and scan set diverge.

## Libraries used

`yaml` (parse).

## Steps

### Step 1 — Add `yaml` to root devDependencies

Intent: declare the YAML parser explicitly at the root workspace so the script
imports an owned dependency. (Six workspace packages already declare
`yaml@^2.8.3` directly; the pin matches.)

| Action | File           |
| ------ | -------------- |
| modify | `package.json` |
| modify | `bun.lock`     |

Edit `devDependencies` from:

```json
"devDependencies": {
  "@biomejs/biome": "2.4.14",
  "@playwright/test": "^1.59.1",
  "acorn": "^8.16.0",
  "serve": "^14.2.6"
}
```

to:

```json
"devDependencies": {
  "@biomejs/biome": "2.4.14",
  "@playwright/test": "^1.59.1",
  "acorn": "^8.16.0",
  "serve": "^14.2.6",
  "yaml": "^2.8.3"
}
```

Run `bun install` to refresh `bun.lock` (auto-generated; the modify entry
tracks the regen). Single-version resolution stays intact.

Verification: `grep '"yaml":' package.json` shows the new entry; `bun install`
exits 0; defer functional verification to Step 2.

### Step 2 — Create `scripts/check-dependabot.mjs`

Intent: assert the coverage invariant from the design end-to-end, fail loudly
on drift, exit 0 otherwise.

| Action | File                           |
| ------ | ------------------------------ |
| create | `scripts/check-dependabot.mjs` |

Behaviour, in order. Both sets are computed in **canonical full-path form**
(e.g., `/.github/actions/audit`) so all set comparisons use identical element
types.

1. **Read & parse.** Resolve repo root via
   `new URL("..", import.meta.url).pathname` (matches existing
   `check-instructions.mjs` / `check-libharness.mjs`). Read
   `.github/dependabot.yml` and `yaml.parse` it.
2. **Locate ecosystem.** Find the `updates[]` entry where
   `package-ecosystem === "github-actions"`; extract its `directories` array.
   Fail with a clear message if either is missing or empty.
3. **Classify entries.** Walk the raw `directories` array, classify each:
   - **Literal** (no `*`): keep verbatim.
   - **Glob `<prefix>/*`** (single trailing `*`, no other glob chars): mark
     for expansion.
   - **Anything else** (`**`, mid-segment `/foo*`, multiple `*`, leading
     `*`): record an `unsupported pattern: <entry>` violation. Continue
     processing — do not exit. (Accumulation: see Step 6.)
4. **Compute scan set** (canonical full paths):
   - Each literal entry: include verbatim.
   - Each glob `<prefix>/*`: enumerate `<prefix>/` via `readdirSync(prefix,
     { withFileTypes: true })`; for each direct child `<D>` that is a
     directory AND contains `action.yml` or `action.yaml`, add `<prefix>/<D>`.
     Subdirectories without an `action.yml`/`yaml` are skipped (matches
     Dependabot's effective scan: it walks the path, finds no manifest, no
     PR is opened — so they are not part of the meaningful scan set).
5. **Compute filesystem set** (canonical full paths). If `.github/actions/`
   is missing or contains no directories, the set is empty. Otherwise:
   `{ "/.github/actions/<D>" : .github/actions/<D>/ is a directory ∧
   (action.yml ∨ action.yaml exists inside) }`. Non-directory entries under
   `.github/actions/` are skipped silently.
6. **Invariant checks** (accumulate violations across all checks; one diff
   section printed per failed check; exit 1 at the end if any violation,
   exit 0 otherwise):
   - **A. coverage**: `filesystem set ⊆ scan set`. Print missing entries
     ("uncovered action directories").
   - **B. literal-entries-not-stale**: every literal entry under
     `/.github/actions/` (not the `/` root) must reference an existing
     action directory — i.e., for each literal in `/.github/actions/<D>`
     form, `<D>` ∈ filesystem set. Print stale literals ("dangling literal
     scan entries"). Glob expansions are excluded from this check
     deliberately, because by Step 4's construction they cannot dangle.
   - **C. workflow root preserved**: `/` appears literally in the raw
     pre-classification `directories` array (string compare). Print
     "missing workflow root literal" on failure.
   - **D. no unsupported patterns**: the violation list from Step 3 is
     empty. Print each unsupported pattern.

CLI shape: no flags, no args. Shebang `#!/usr/bin/env node`. ESM imports:
`node:fs`, `node:path`, `yaml`. Invocation is `bun scripts/check-dependabot.mjs`.

Verification (run after Step 3 lands the glob):

1. **Positive baseline:** from the post-Step-3 tree, `bun
   scripts/check-dependabot.mjs` exits 0.
2. **Negative-path drift:** in a throw-away worktree
   (`git worktree add ../tmp-730-neg`), edit `.github/dependabot.yml` to add
   a literal `/.github/actions/_does_not_exist`. The script must exit 1 with
   a "dangling literal" violation. (Confirms Check B fires.)
3. **Add/rename/delete replays** (separate throw-away worktrees, `git
   worktree add ../tmp-730-{add,rename,delete}`): introduce
   `.github/actions/_canary/action.yml`; rename `audit/` →
   `audit-renamed/`; delete `post-run/`. The script must exit 0 in all
   three (the glob auto-tracks). Discard worktrees after. No commits.

### Step 3 — Replace per-directory entries with the glob

Intent: collapse the five literal action-directory entries to a single glob
plus the existing root entry.

| Action | File                     |
| ------ | ------------------------ |
| modify | `.github/dependabot.yml` |

Before:

```yaml
    directories:
      - /
      - /.github/actions/audit
      - /.github/actions/bootstrap
      - /.github/actions/kata-action-agent
      - /.github/actions/kata-action-eval
      - /.github/actions/post-run
```

After:

```yaml
    directories:
      - /
      - /.github/actions/*
```

No other field changes.

Verification: `bun scripts/check-dependabot.mjs` exits 0. Filesystem set =
{`/.github/actions/audit`, `/.github/actions/bootstrap`,
`/.github/actions/kata-action-agent`, `/.github/actions/kata-action-eval`,
`/.github/actions/post-run`}. Scan set after expansion = same five paths
(no other subdirs have `action.yml`). `/` preserved as literal.

### Step 4 — Wire into the `context` chain

Intent: include the check in the local `bun run check` flow so contributors
see drift before pushing.

| Action | File           |
| ------ | -------------- |
| modify | `package.json` |

Two edits:

- Append a new row `"context:check-dependabot": "bun
  scripts/check-dependabot.mjs"` immediately after the existing
  `context:check-jtbd` row (end of the script-row block, before the
  `context:fix` row). Existing `context:check-*` keys are in chain-invocation
  order, not alphabetical — match that.
- Append `&& bun run context:check-dependabot` to the end of the `"context"`
  script's command string.

Verification: `bun run context:check-dependabot` exits 0 standalone; `bun run
context` exits 0 end-to-end (this also exercises the chain append).

### Step 5 — Add a CI gate job to `check-security.yml`

Intent: enforce the invariant in the merge-gate workflow per the design's
component 3.

| Action | File                                   |
| ------ | -------------------------------------- |
| modify | `.github/workflows/check-security.yml` |

Add a third job `dependabot-coverage` after `secret-scanning`:

```yaml
  dependabot-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6
      - uses: ./.github/actions/bootstrap
      - run: bun scripts/check-dependabot.mjs
```

`bootstrap` runs `./scripts/bootstrap.sh` → `just install` → `bun install
--frozen-lockfile`, which installs root devDeps including `yaml@2.8.3`
(verified at plan time). No `setup-node` step is needed: invocation is
`bun`, not `node`. Use the same checkout SHA-pin already pinned in this
file. Workflow-level `contents: read` permission already covers the new
job.

Verification: the new `dependabot-coverage` job appears under the `Security`
workflow run on PR #728 and shows `success`. Spec criteria 2–4 are exercised
by the Step 2 worktree replays, not by CI; the CI gate is the structural
prevention mechanism, not the replay test.

## Risks

| Risk                                                                                                              | Mitigation in this plan                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependabot's server-side glob expander differs from the `<prefix>/*` shape the script implements in Step 2.       | Both expansions evaluate the same tree at the same commit; divergence surfaces on the next directory change. Run `gh api` Dependabot listing once after merge to confirm coverage.            |
| Action directory exists with neither `action.yml` nor `action.yaml` (incomplete commit, mid-rename half-state).   | The script silently excludes such directories from both sets — by design, mirroring Dependabot's actual behaviour. The half-state cannot trigger a CI failure; the missing manifest will.     |

## Execution

Single trusted agent (`staff-engineer`) executes Steps 1–5 sequentially in one
PR — each step depends on the previous. No decomposition (~120 lines of net
change across **five files**: `package.json`, `bun.lock`, `.github/dependabot.yml`,
`scripts/check-dependabot.mjs`, `.github/workflows/check-security.yml`). The
implementer must complete Step 2's positive-baseline, negative-path drift, and
all three add/rename/delete replays after Step 3 lands and before opening the
implementation PR; record outcomes in the PR description.

— Staff Engineer 🛠️

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
imports an owned dependency (currently transitive at `node_modules/yaml@2.8.3`
via six workspace packages).

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

Run `bun install` to refresh `bun.lock` (auto-generated; modify entry tracks
the regen). `^2.8.3` matches every existing workspace pin, so resolution stays
single-version.

Verification: `grep '"yaml":' package.json` shows the new entry; `bun install`
exits 0; defer functional verification to Step 2 (the script's import of
`yaml` is the binding test).

### Step 2 — Create `scripts/check-dependabot.mjs`

Intent: assert the design's coverage invariant end-to-end, fail loudly on
drift, exit 0 otherwise.

| Action | File                            |
| ------ | ------------------------------- |
| create | `scripts/check-dependabot.mjs`  |

Behaviour, in order — accumulate violations across all checks before exiting
(no short-circuit; the implementer wants every drift visible in one run):

1. **Read & parse.** Read `.github/dependabot.yml` from repo root (resolve via
   `new URL("..", import.meta.url).pathname` — matches `check-instructions.mjs`
   and `check-libharness.mjs`, and is Node 18-safe; `import.meta.dirname` is
   Node 20.11+ only and would break under the package's `engines.node ≥ 18`).
   Parse with `yaml.parse`.
2. **Locate ecosystem.** Find the `updates[]` entry where
   `package-ecosystem === "github-actions"`; extract its `directories` array.
   Fail with a clear message if either is missing or empty.
3. **Scan-set computation** — for each entry:
   - Literal (no `*`): include verbatim.
   - Trailing `/*` only (e.g., `/.github/actions/*`): expand to one entry per
     direct child of `<prefix>` that is a directory (single path segment, no
     dotfiles, files skipped). Implemented via `readdirSync(prefix, { withFileTypes: true })`.
   - Anything else (`**`, mid-segment globs like `/foo*`, multiple `*`):
     fail with `unsupported pattern: <entry>` and exit 1.
4. **Filesystem-set computation.** If `.github/actions/` is missing or
   contains no directories, the filesystem set is empty (no error). Otherwise,
   include `<D>` iff `.github/actions/<D>/` is a directory AND
   `action.yml` or `action.yaml` exists inside it. Non-directory entries
   under `.github/actions/` are skipped silently (matches design risk row:
   stray non-action files are harmless).
5. **Invariant checks** — accumulate, do not short-circuit:
   - **A.** `filesystem set ⊆ (expanded scan set ∖ {/})` — uncovered action
     directories. Print missing entries.
   - **B.** `(expanded scan set ∖ {/}) ⊆ filesystem set` — scan-set paths
     that point at no action directory. Print stale entries.
   - **C.** `/` ∈ **pre-expansion** entries (literal-string check on the raw
     `directories` array, before glob expansion) — guards spec criterion 5.
   - **D.** No `unsupported pattern` raised in Step 3.
6. **Exit.** Print one diff section per failed check, then exit `0` if all
   four pass, `1` if any fail.

CLI shape: no flags, no args. Shebang `#!/usr/bin/env node`. ESM imports:
`node:fs`, `node:path`, `yaml`. No `chmod +x` required (invocation is
`bun scripts/check-dependabot.mjs`).

Verification: from a clean checkout of the post-Step-3 tree, run
`bun scripts/check-dependabot.mjs` and confirm exit 0. Then in three
throw-away worktrees (created via `git worktree add ../tmp-730-{add,rename,delete}`):
introduce `.github/actions/_canary/action.yml`; rename `audit` → `audit-renamed`;
delete `post-run`. The script must exit 0 in all three (the glob auto-tracks).
Discard worktrees after verification — no commits.

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

Verification: `bun scripts/check-dependabot.mjs` exits 0 (filesystem set =
{audit, bootstrap, kata-action-agent, kata-action-eval, post-run}; expanded
scan set = same plus `/`; `/` preserved).

### Step 4 — Wire into the `context` chain

Intent: include the check in the local `bun run check` flow so contributors
see drift before pushing.

| Action | File           |
| ------ | -------------- |
| modify | `package.json` |

Two edits:

- Insert row `"context:check-dependabot": "bun scripts/check-dependabot.mjs"`
  alphabetically between `context:check-catalog` and `context:check-instructions`.
- Append `&& bun run context:check-dependabot` to the `"context"` script
  (chain order is invocation order, not alphabetical — append to the end).

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

`bootstrap` provides Bun + workspace install (including the new `yaml`
devDep). No `setup-node` step is needed: invocation is `bun`, not `node`.
Use the same checkout SHA-pin already pinned in this file. Workflow-level
`contents: read` permission already covers the new job.

Verification: the new job appears in the `Security` workflow run on PR #728;
shows `success`. Spec criteria 2–4 (add/rename/delete) are verified
mechanically by virtue of the gate running on every PR diff — the gate IS
the replay test, since each replayed delta arrives at `main` only via a PR
that triggers this workflow.

## Risks

| Risk                                                                                                   | Mitigation in this plan                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependabot's glob expander on its servers differs from the `<prefix>/*` shape we implement in Step 2.  | Both expansions are evaluated at the same commit on the same tree; any divergence surfaces on the next directory change as the CI gate would still pass while Dependabot misses (or vice versa). Rebut by running a manual `gh api` Dependabot listing once after merge to confirm coverage. |
| `bootstrap` composite action does not pre-install workspace devDependencies on a fresh CI checkout.    | Verify by inspecting `.github/actions/bootstrap/action.yml` before merge; if it skips devDeps, add an explicit `bun install` step in the new CI job rather than within Step 1.                                                                                                                |

## Execution

Single trusted agent (`staff-engineer`) executes Steps 1–5 sequentially in one
PR — each step depends on the previous. No decomposition (≈100 lines of net
change across 4 files). The implementer must complete the Step 2 worktree
replays before opening the implementation PR; record outcomes in the PR
description.

— Staff Engineer 🛠️

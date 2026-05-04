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

`yaml` (parse) — added as a root devDependency (already resolved transitively
at `node_modules/yaml@2.8.3`; declaring it makes the script's import explicit).

## Steps

### Step 1 — Add `yaml` to root devDependencies

Intent: make the YAML parser an explicit dependency of the root workspace.

| Action   | File           |
| -------- | -------------- |
| modify   | `package.json` |
| modify   | `bun.lock`     |

Add `"yaml": "^2.8.3"` to `devDependencies` (alphabetically last, after
`serve`). Run `bun install` to refresh `bun.lock`.

Verification: `bun install` completes; `node -e 'import("yaml").then(m => console.log(typeof m.parse))'` prints `function`.

### Step 2 — Create `scripts/check-dependabot.mjs`

Intent: assert the coverage invariant from the design end-to-end, fail loudly
on drift, exit 0 otherwise.

| Action  | File                            |
| ------- | ------------------------------- |
| create  | `scripts/check-dependabot.mjs`  |

Behaviour, in order:

1. Read `.github/dependabot.yml`; parse with `yaml.parse`.
2. Find the `updates` entry where `package-ecosystem === "github-actions"`;
   extract its `directories:` array. Fail with a clear message if either is
   missing.
3. **Scan set computation:** for each entry, if it contains `*`, expand against
   the filesystem (single `*` matches one path segment of a directory under the
   prefix, matching design's `/.github/actions/*` shape; literal entries go in
   verbatim). Stop with `unsupported pattern` if a glob shape outside this
   contract appears.
4. **Filesystem set computation:** read `.github/actions/`, include `<D>` if
   `.github/actions/<D>/action.yml` or `.github/actions/<D>/action.yaml` exists.
5. **Invariant checks** (each prints its own diff on failure):
   - `filesystem set ⊆ (scan set ∖ {/})` — directories with an action.yml not
     covered by any scan entry.
   - `(scan set ∖ {/}) ⊆ filesystem set` — scan-set paths that point at no
     action directory.
   - `/` ∈ scan set (criterion 5 — workflow-root coverage preserved).
6. Exit `0` on all-pass, `1` on any failure. CLI shape: no flags, no args.

Add `#!/usr/bin/env node` shebang; ESM imports (`node:fs`, `node:path`,
`yaml`); use `import.meta.dirname` to resolve repo root, matching the existing
`scripts/check-*.mjs` convention.

Verification: `bun scripts/check-dependabot.mjs` exits 0 against the
post-Step-3 tree; replay the three incident deltas in scratch (introduce
`_canary/action.yml`; rename a directory; delete a directory) and confirm the
script still exits 0 in each case (the glob auto-tracks).

### Step 3 — Replace per-directory entries with the glob

Intent: collapse the five literal action-directory entries to a single glob
plus the existing root entry.

| Action | File                       |
| ------ | -------------------------- |
| modify | `.github/dependabot.yml`   |

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
scan set matches; `/` preserved).

### Step 4 — Wire into the `context` chain

Intent: include the check in the local `bun run check` flow so contributors
see drift before pushing.

| Action | File           |
| ------ | -------------- |
| modify | `package.json` |

Two edits:

- Add row: `"context:check-dependabot": "bun scripts/check-dependabot.mjs"`
  (alphabetical placement after `context:check-catalog`).
- Append `&& bun run context:check-dependabot` to the `"context"` script.

Verification: `bun run context:check-dependabot` exits 0 standalone.

### Step 5 — Add a CI gate job to `check-security.yml`

Intent: enforce the invariant in the merge-gate workflow per the design's
component 3.

| Action | File                                  |
| ------ | ------------------------------------- |
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

Use the same checkout SHA-pin and `bootstrap` composite action already used
elsewhere in the file. No new permissions block needed (workflow `contents:
read` covers it).

Verification: the new job appears in the `Security` workflow run on the PR;
shows `success`.

## Risks

| Risk                                                                                                                       | Mitigation in this plan                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependabot's first scheduled run after the change skips an action directory because its glob expander differs from ours.   | Step 2 expansion uses the literal `<dir>/*` shape the design committed to (single segment, directories only); deviation surfaces on the next add/move via the CI gate, before silent miss.   |
| `package.json` already references a missing `scripts/check-catalog.mjs` (existing CI noise on `context:check-catalog`).    | Out of scope — do not fix. If it actually fails CI on this PR, escalate as a separate issue rather than absorbing into 730.                                                                   |
| `yaml` declared as a root devDep clashes with an internal package's pinned range.                                          | Existing pins are `^2.8.3` across six packages; matching the same range avoids a workspace-resolution split.                                                                                  |

## Execution

Single trusted agent (`staff-engineer`) executes Steps 1–5 sequentially in one
PR — each step depends on the previous. No part-decomposition (one file per
step, < 100 lines of net change). The implementer should verify Step 2 against
all three incident replays before opening the PR.

— Staff Engineer 🛠️

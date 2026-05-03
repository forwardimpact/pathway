# Plan A — Spec 780 Wiki lifecycle commands

## Approach

Add four subcommands to the existing `fit-wiki` CLI. Two stacks land in
`libraries/libwiki/`: a refresh stack (`MarkerScanner` + `BlockRenderer` +
`refresh`) that consumes `libxmr.analyze` / `libxmr.renderChart` and rewrites
storyboard metric blocks in place, and a sync stack (`WikiRepo` + `SkillRoster`
+ `init` / `push` / `pull`) that wraps the system `git` binary with the same
credential and identity pattern `scripts/wiki-sync.sh` uses today. The CLI
binary grows three new command definitions; the four content edits
(storyboard template, team-storyboard, kata-session SKILL, justfile) follow.
Tests use temp directories and local bare git repos to exercise both stacks
without touching the real wiki origin. The existing `wiki/storyboard-2026-M05.md`
migration ships as a separate wiki-repo commit after the monorepo PR merges,
since the wiki is its own repository.

Libraries used: `@forwardimpact/libxmr` (`analyze`, `renderChart`), `@forwardimpact/libutil` (`Finder`), `@forwardimpact/libcli` (`createCli`), Node `child_process` (`spawnSync`), Node `fs`, Node `path`.

## Steps

### 1. Add libxmr dependency to libwiki

Files modified:

- `libraries/libwiki/package.json`

Add `"@forwardimpact/libxmr": "^1.1.0"` to `dependencies` (currently only
`libcli` and `libutil`). Run `bun install` so the lockfile updates.

Verify: `jq '.dependencies["@forwardimpact/libxmr"]' libraries/libwiki/package.json`
returns a version string (criterion #12).

### 2. Implement `WikiRepo`

Files created:

- `libraries/libwiki/src/wiki-repo.js`
- `libraries/libwiki/test/wiki-repo.test.js`

`WikiRepo` is a class wrapping `./wiki/` git operations via `spawnSync('git', ...)`.
Construct with `new WikiRepo({ wikiDir, parentDir })`. Public methods:

| Method                           | Behaviour                                                                                                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isCloned()`                     | `true` when `git -C wikiDir rev-parse --git-dir` exits 0.                                                                                                                                                          |
| `ensureCloned(url)`              | No-op when `isCloned()`. Otherwise `auth_git clone <url> wikiDir`. Anonymous-clone failure is non-fatal (matches `wiki-sync.sh` line 35-38) — return `{cloned:false, reason}`.                                     |
| `inheritIdentity()`              | `git -C wikiDir config user.name $(git -C parentDir config user.name)` and same for `user.email`. Skip silently if parent has no identity set.                                                                     |
| `fetch()`                        | `auth_git -C wikiDir fetch origin master`.                                                                                                                                                                         |
| `isClean()`                      | `true` when `git -C wikiDir status --porcelain` produces no output.                                                                                                                                                |
| `pull()`                         | `fetch()`, then `git -C wikiDir rebase origin/master`. On rebase failure: `rebase --abort` and throw a `WikiPullConflict` error carrying the git stderr. Caller maps to non-zero exit (decision W5).               |
| `commitAndPush(message)`         | `git -C wikiDir add -A`. If `git diff --cached --quiet` succeeds, return `{pushed:false, reason:'clean'}` (criterion #7). Otherwise commit with `message`, `fetch()`, `rebase origin/master`; on rebase failure run `rebase --abort` then `merge origin/master -X ours --no-edit` (decision W3); finally `auth_git push origin master`. |

`auth_git` is a private helper that prefixes the git argv with
`-c credential.helper=` and
`-c 'credential.helper=!f() { echo username=x-access-token; echo "password=${GH_TOKEN:-$GITHUB_TOKEN}"; }; f'`
when either `GH_TOKEN` or `GITHUB_TOKEN` is set; otherwise it spawns plain git.
Match the inline form used in `scripts/wiki-sync.sh` line 19-22 — credentials
never reach `.git/config` (decision W2).

Tests use `mkdtempSync` plus three local repos: a bare repo as origin, two clones.
Cover: `isCloned` false then true after `ensureCloned`; `isClean` flips with a
local edit; `pull` picks up another clone's push; `commitAndPush` is no-op on
clean tree, succeeds on dirty tree, recovers via `merge -X ours` when origin
has diverged; `inheritIdentity` propagates parent's `user.name`/`user.email`.

Verify: `bun test libraries/libwiki/test/wiki-repo.test.js` passes.

### 3. Implement `SkillRoster`

Files created:

- `libraries/libwiki/src/skill-roster.js`
- `libraries/libwiki/test/skill-roster.test.js`

Single `listSkills({ skillsDir })` function. Reads `skillsDir`
(default `<projectRoot>/.claude/skills/`), filters to entries that are
directories and start with `kata-`, returns an array of slugs sorted
ascending. Mirror the shape of `agent-roster.js`. Drop dot-prefixed entries.

Tests: empty dir → `[]`; mixed `kata-*` and `fit-*` dirs → only kata; ignore
files and `.DS_Store`; sorted output is stable.

### 4. Implement `init` command

Files created:

- `libraries/libwiki/src/commands/init.js`
- `libraries/libwiki/test/cli-init.test.js`

`runInitCommand(values, _args, cli)` resolves `projectRoot` via `Finder`,
derives `wikiUrl` from the parent repo's `origin` URL by stripping any
trailing `.git` and appending `.wiki.git` (decision W4), then:

1. `repo.ensureCloned(wikiUrl)`. On non-fatal anonymous failure print
   `init: could not clone wiki, skipping` to stderr and exit 0 (matches
   `wiki-sync.sh` behaviour for offline dev).
2. `repo.inheritIdentity()`.
3. For each `slug` in `listSkills({ skillsDir })`,
   `mkdirSync(path.join(wikiDir, 'metrics', slug), { recursive: true })`.

Idempotent by construction: every step is a no-op when its postcondition
already holds (decision I1, I2). No `.gitkeep` files created.

CLI flags: `--wiki-root` to override the default `./wiki`, `--skills-dir` to
override `./.claude/skills`. Both used by tests; agents rely on defaults.

Tests use a temp project with a fake parent repo (`git init` + `origin` set
to a local bare repo), assert `git -C wiki rev-parse --git-dir` succeeds and
`wiki/metrics/kata-spec/` exists after run (criterion #4); second run produces
no error and no new commits (criterion #5).

### 5. Implement `push` and `pull` commands

Files created:

- `libraries/libwiki/src/commands/sync.js`
- `libraries/libwiki/test/cli-sync.test.js`

Single module exports `runPushCommand` and `runPullCommand`. Each constructs
a `WikiRepo` from `Finder`-resolved `projectRoot`, calls
`repo.commitAndPush('wiki: update from session')` or `repo.pull()` respectively,
and prints a one-line outcome to stdout. `runPullCommand` catches
`WikiPullConflict` and exits non-zero with the stderr line
`fit-wiki pull: rebase conflict — local divergence detected; resolve manually or push first`
(matches `scripts/wiki-sync.sh` line 53).

Tests use the same bare-repo harness as `WikiRepo` tests:

- push with no local changes → exit 0, no new commit (criterion #7);
- push with one local change → commit lands on origin (criterion #6);
- pull picks up an external commit (criterion #8);
- pull with diverging local edit → exit non-zero, wiki tree untouched.

### 6. Implement `MarkerScanner`

Files created:

- `libraries/libwiki/src/marker-scanner.js`
- `libraries/libwiki/test/marker-scanner.test.js`

Single `scanMarkers(text)` function. Splits on `\n` and walks line by line.
Open marker matches the regex
`/^<!--\s*xmr:([^:\s]+):([^\s]+)\s*-->\s*$/`; close marker matches
`/^<!--\s*\/xmr\s*-->\s*$/`. State machine: walk top-down tracking the
current open block; on close, push `{ metric, csvPath, openLine, closeLine }`
(0-indexed) and reset; on a second open before a close, emit the unmatched
open as a `dangling-marker` warning to stderr (per Risks row 2) and reset
state to the new open. Return the array of well-formed pairs.

Tests: zero pairs in unmarked text; one pair around an example block; two
pairs separated by prose; dangling open emits stderr warning and is skipped;
malformed marker (extra colon, missing slash on close) is not recognized.

### 7. Implement `BlockRenderer`

Files created:

- `libraries/libwiki/src/block-renderer.js`
- `libraries/libwiki/test/block-renderer.test.js`

Single `renderBlock({ metric, csvPath, projectRoot, fs })` function. Resolves
`csvPath` against `projectRoot`, reads the CSV, calls `libxmr.analyze`,
filters `report.metrics` to the named metric, then formats:

```
**Latest:** {latest.value} · **Status:** {status}

```
{libxmr.renderChart(values, stats, signals)}
```

**Signals:** {signal-line}
```

`signal-line` is the comma-separated list of fired rule names
(`xRule1`, `xRule2`, `xRule3`, `mrRule1`) — exact tokens used in the existing
storyboard convention (`storyboard-template.md` line 48). Empty list renders
as `—` (em dash). For `status === 'insufficient_data'`, omit the chart and
signals lines and emit
`**Latest:** {values[n-1] ?? '—'} · **Status:** insufficient_data`.

On any error from `libxmr.analyze` or chart rendering, throw a tagged
`BlockRenderError(reason)`. The `refresh` command catches per-block
(Risks row 1).

Tests use canned CSV strings (15 stable points → predictable, 15 with one
outlier → signals_present, 5 points → insufficient_data) and assert the
returned text contains the `**Latest:**` line, a 14-line chart for the first
two cases, and the right `**Signals:**` token list. No filesystem in tests
beyond reading a temp CSV.

### 8. Implement `refresh` command

Files created:

- `libraries/libwiki/src/commands/refresh.js`
- `libraries/libwiki/test/cli-refresh.test.js`

`runRefreshCommand(values, args, cli)`:

1. `args[0]` is the storyboard path; usage-error when missing.
2. Read the file, call `scanMarkers(text)`, exit 0 with no write when the
   array is empty (criterion #3).
3. For each block in **reverse** order (bottom-up, decision R4): call
   `renderBlock` inside a `try`; on success splice the rendered lines into
   the line buffer between `openLine + 1` and `closeLine - 1` inclusive; on
   `BlockRenderError` print
   `refresh-error <storyboard.md>:<openLine+1> <reason>` to stderr and leave
   the original span untouched.
4. Write the joined buffer back to the file in a single `writeFileSync`.

Tests:

- Storyboard with no markers → file unchanged, `git diff` empty (criterion #3).
- Storyboard with one marker referencing a known CSV → block content matches
  what `bunx fit-xmr chart` produces for that metric (criterion #1).
- Refresh twice → second `diff` is empty (criterion #2).
- Two markers in one file → both blocks regenerate, surrounding prose
  preserved.
- Marker referencing a missing CSV → stderr carries `refresh-error`, file
  span unchanged, exit 0.

### 9. Wire commands into the CLI

Files modified:

- `libraries/libwiki/bin/fit-wiki.js`
- `libraries/libwiki/src/index.js`

`bin/fit-wiki.js`: extend the `commands` array on the `definition` with four
new entries (`refresh`, `init`, `push`, `pull`) — each with a `description`,
the named option set used by the command (`--wiki-root` shared by all;
`--skills-dir` for init), and `args` for `refresh`'s positional storyboard
path. Extend the `COMMANDS` dispatch map with the four new handlers. Update
the `examples` block to include one canonical invocation per command.

`src/index.js`: re-export `scanMarkers`, `renderBlock`, `WikiRepo`,
`listSkills` alongside the existing `writeMemo` / `listAgents` /
`insertMarkers` exports — these become the public libwiki surface.

Verify: `bunx fit-wiki --help` lists all five commands; `bunx fit-wiki refresh
--help` shows the storyboard positional and `--wiki-root`.

### 10. Update storyboard template

Files modified:

- `.claude/skills/kata-session/references/storyboard-template.md`

Wrap the existing `#### {metric_name}` example block (lines 37-49) so the
`**Latest:** …`, fenced chart, and `**Signals:** …` lines sit between marker
pairs:

```diff
 #### {metric_name}

+<!-- xmr:{metric_name}:wiki/metrics/{skill}/{YYYY}.csv -->
 **Latest:** {value} · **Status:** {status from `bunx fit-xmr analyze`}

 ```
 {paste the 14-line Wheeler/Vacanti X+mR chart …}
 ```

 **Signals:** {fired-rule list …}
+<!-- /xmr -->
```

The `_Note:_` line stays outside the markers — it is human-authored prose
that `refresh` does not regenerate. Update the trailing parenthetical block
explaining the layout to mention `bunx fit-wiki refresh` as the maintenance
command.

Verify: `grep -c 'xmr:' .claude/skills/kata-session/references/storyboard-template.md`
returns ≥1 (criterion #9).

### 11. Update team-storyboard reference

Files modified:

- `.claude/skills/kata-session/references/team-storyboard.md`

Rewrite the `## Storyboard updates` section (lines 54-78). Lead with
`bunx fit-wiki refresh wiki/storyboard-YYYY-MNN.md` as the canonical update
path. Keep the description of the rendered block (status header, fenced
chart, signals line) but recast it as "what `refresh` produces" rather than
"what to paste". Retain the manual `bunx fit-xmr chart` invocation as a
fallback in a parenthetical when markers are absent.

Verify: `grep -c 'fit-wiki refresh' .claude/skills/kata-session/references/team-storyboard.md`
returns ≥1 (criterion #10).

### 12. Update kata-session SKILL

Files modified:

- `.claude/skills/kata-session/SKILL.md`

Two changes:

- Read-do checklist item at line 50-52 — replace with
  `bunx fit-wiki refresh wiki/storyboard-{YYYY}-M{MM}.md`.
- Facilitator process step 4 (lines 121-128) — keep the `analyze --format json`
  call (still used for Q2 `Ask` content); replace the chart-paste sentence
  with `bunx fit-wiki refresh`. Drop the in-line "do not duplicate μ, UPL, LPL"
  prose — `team-storyboard.md` already carries it.

### 13. Switch justfile recipes

Files modified:

- `justfile`

```diff
 wiki-pull:
-    bash scripts/wiki-sync.sh pull
+    bunx fit-wiki pull

 wiki-push:
-    bash scripts/wiki-sync.sh push
+    bunx fit-wiki push
```

`wiki-audit` is unchanged (out of scope per spec § Scope (out)). The bootstrap
composite action keeps calling `just wiki-push`; the recipe is what flips
underneath (design § Boundaries).

Verify: `grep -E 'wiki-(pull|push):' -A 1 justfile` shows `bunx fit-wiki`
(criterion #11). `just wiki-pull` and `just wiki-push` succeed end-to-end
when run from the monorepo root with the wiki cloned.

### 14. Regenerate library catalog

Files modified:

- `libraries/README.md` (regenerated)

The new `forwardimpact.needs` entry on `libwiki` (add one phrase like
`"Refresh XmR chart blocks in a markdown file"`) requires
`bun run lib:fix`. `bun run check` fails on a stale catalog
([`libraries/CLAUDE.md`](../../libraries/CLAUDE.md)).

Verify: `bun run check` exits 0.

### 15. Migrate existing storyboard (wiki repo, post-merge)

Files modified (separate commit, in the `forwardimpact/monorepo.wiki.git`
repository — **not** in the monorepo PR):

- `wiki/storyboard-2026-M05.md`

After the monorepo PR merges, the implementer:

1. `bunx fit-wiki init` (or `cd wiki && git pull` if already cloned).
2. For each `#### {metric_name}` block under Current Condition, wrap the
   `**Latest:** …` / fenced chart / `**Signals:** …` triple with
   `<!-- xmr:{metric_name}:wiki/metrics/{skill}/2026.csv -->` and
   `<!-- /xmr -->`.
3. `bunx fit-wiki refresh wiki/storyboard-2026-M05.md` — confirm the
   `git diff` shows only formatting reconciliation, not content drift.
4. `bunx fit-wiki push`.

Past storyboards (`storyboard-2026-M04.md` and earlier) are not touched —
they are historical records (spec § Scope (in) row 1).

Verify: `git -C wiki log -1 --oneline` shows the migration commit;
`bunx fit-wiki refresh wiki/storyboard-2026-M05.md` is a no-op on the next run.

## Risks

| Risk                                                                                                                                       | Mitigation                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WikiRepo` tests need a working `git` binary and `mkdtempSync` inside the test sandbox. CI already has both, but `bun test` runs may need the temp repos under `os.tmpdir()` (not the worktree) so cleanup leaves no untracked files. | Use `mkdtempSync(join(tmpdir(), 'libwiki-'))` and tear down via `rmSync(..., {recursive:true})` in `afterEach`. Same pattern as `cli-memo.test.js`.                                       |
| The inline credential-helper string is a single shell-quoted argv. Any drift from `wiki-sync.sh`'s exact form silently breaks token-based clone in CI. | `auth_git` constructs the argv as a literal array passed straight to `spawnSync` (no shell), with the helper body identical to `scripts/wiki-sync.sh` lines 19-22. Add a unit test that asserts the argv begins with the two `-c credential.helper=...` flags when `GH_TOKEN` is set. |
| `bun install` may silently skip the new `libxmr` dep if the workspace lockfile is stale.                                                   | Run `bun install` at the repo root (not inside `libraries/libwiki/`) so the workspace lockfile picks the change up. Confirm via `jq '.dependencies' libraries/libwiki/package.json` and a fresh `node_modules/@forwardimpact/libxmr/package.json`. |
| The wiki repo (`monorepo.wiki.git`) does not exist for first-time downstream installations. `init` against a non-existent remote fails on the underlying `git clone`. | `WikiRepo.ensureCloned` wraps the spawn in a try/catch and returns `{cloned:false, reason}`; `init` prints the diagnostic to stderr and exits 0. New installations create the wiki by pushing the first time, exactly as `wiki-sync.sh` does today (Risks row 3 in design). |
| Storyboard prose drift between metric blocks. If a marker pair surrounds prose lines that are not pure `Latest/Chart/Signals`, refresh wipes them. | Document the marker contract in `storyboard-template.md` (step 10) — `_Note:_` and any cross-reference text sits **outside** the markers. The migration in step 15 places markers tightly around the regenerated triple. |
| `libxmr` version range `^1.1.0` could drift if libxmr cuts a 2.0. The chart format is a stable contract, but `analyze`'s status enum could expand. | Add a `BlockRenderer` test asserting the three known statuses (`predictable`, `signals_present`, `insufficient_data`) all render. Any new status would surface as a renderer failure caught by step 8's per-block try.                                                              |

## Execution

Single agent: **`staff-engineer`**. The plan is one logical unit (one
package + the four content edits that depend on its CLI surface). No part
runs in parallel — steps 6-8 (refresh stack) and steps 2-5 (sync stack)
share no files but share the `bin/fit-wiki.js` wiring in step 9, so the
gain from splitting them is small relative to coordination cost.

Sequence:

1. Step 1 — package.json dep (unblocks step 7).
2. Steps 2-5 — sync stack (`WikiRepo`, `SkillRoster`, `init`, `push`/`pull`).
3. Steps 6-8 — refresh stack (`MarkerScanner`, `BlockRenderer`, `refresh`).
4. Step 9 — CLI wiring once all four handlers exist.
5. Steps 10-13 — content edits (templates, justfile, skill text).
6. Step 14 — `bun run lib:fix`, then `bun run check`.
7. Open `plan(780): …` PR; clean sub-agent review panel of 3 per
   `kata-review` caller protocol.
8. Step 15 — wiki-repo migration after merge (separate commit on the wiki
   repo, not gating the monorepo PR).

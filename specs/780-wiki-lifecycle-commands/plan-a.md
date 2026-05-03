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
without touching the real wiki origin. The monorepo PR satisfies criteria
#1–#3 against fixtures in tests, #4–#8 against bare-repo harnesses, and
#9–#12 by static inspection. The live `wiki/storyboard-2026-M05.md` content
edit (spec § Scope (in) item 1) physically cannot land in the monorepo PR —
the wiki is a separate git repository — so step 15 ships it as a follow-up
commit on the wiki repo, with the same in-PR `refresh` code verifying it.
Spec 770 followed the same split for memo-marker insertion.

Libraries used: `@forwardimpact/libxmr` (`analyze`, `renderChart`), `@forwardimpact/libutil` (`Finder`), `@forwardimpact/libcli` (`createCli`).

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
| `inheritIdentity()`              | Read `user.name` / `user.email` from `parentDir` via `git -C parentDir config --get user.{name,email}`, then write each into `wikiDir` via `git -C wikiDir config user.{name,email} <value>`. Skip silently if a parent value is unset. No shell substitution — both reads and writes are separate `spawnSync` calls. |
| `fetch()`                        | `auth_git -C wikiDir fetch origin master`.                                                                                                                                                                         |
| `isClean()`                      | `true` when `git -C wikiDir status --porcelain` produces no output.                                                                                                                                                |
| `pull()`                         | `fetch()`, then `git -C wikiDir rebase origin/master`. On rebase failure: `rebase --abort` and throw a `WikiPullConflict` error carrying the git stderr. Caller maps to non-zero exit (decision W5).               |
| `commitAndPush(message)`         | Order: `git -C wikiDir add -A` → `git diff --cached --quiet` (if exit 0, return `{pushed:false, reason:'clean'}`, criterion #7) → `git commit -m message` → `fetch()` → `git rebase origin/master`; on rebase failure: `git rebase --abort` then `git merge origin/master -X ours --no-edit` (decision W3); finally `auth_git push origin master`. Fetch sits between commit and rebase so the local commit exists when the rebase runs. |

`auth_git` is a private helper that prefixes the git argv with two
`-c` flags — the first clears any inherited helper (`-c credential.helper=`),
the second installs the inline helper
`-c credential.helper=!f() { echo username=x-access-token; echo "password=${GH_TOKEN:-$GITHUB_TOKEN}"; }; f`
— when either `GH_TOKEN` or `GITHUB_TOKEN` is set in the parent process
environment; otherwise it spawns plain git. The argv is passed straight to
`spawnSync` as an array (no `shell:true`); git itself spawns the helper body
in a subshell that resolves `${GH_TOKEN:-$GITHUB_TOKEN}` against the inherited
env. Match the form used in `scripts/wiki-sync.sh` line 19-22 — credentials
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

Single `listSkills({ skillsDir })` function. Caller resolves `skillsDir`
explicitly (typically `path.join(finder.findProjectRoot(process.cwd()), '.claude', 'skills')`,
matching `memo.js` line 40-42). The function reads the directory, filters
to entries that are directories and start with `kata-`, returns an array of
slugs sorted ascending. Mirror the shape of `agent-roster.js`. Drop
dot-prefixed entries.

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

Single `renderBlock({ metric, csvPath, projectRoot, fs })` function (`fs`
optional, defaults to `node:fs`). Resolves `csvPath` against `projectRoot`,
reads the CSV, calls `libxmr.analyze`, filters `report.metrics` to the named
metric, then returns an array of strings (one per line) matching the design
§ Marker contract exactly:

```
['**Latest:** {latest.value} · **Status:** {status}',
 '',
 '```',
 ...renderChart(...).split('\n'),
 '```',
 '',
 '**Signals:** {signal-line}']
```

The array has no leading or trailing blank line — those are owned by the
caller (`refresh`) and live outside the marker pair. `signal-line` is the
comma-separated list of fired rule names (`xRule1`, `xRule2`, `xRule3`,
`mrRule1`) — exact tokens used in the existing storyboard convention
(`storyboard-template.md` line 48). Empty list renders as `—` (em dash).

`status` is whatever `libxmr.analyze` returns verbatim — including
`insufficient_data` (decision: status semantics defer to libxmr per design
§ Refresh flow). The output template above is unconditional; for
`insufficient_data` the chart slot carries libxmr's
`Insufficient data: N points (need at least MIN_POINTS).` line wrapped in
the same fence (matches what `bunx fit-xmr chart` prints today, see
`libraries/libxmr/src/commands/chart.js` line 50-55).

On any error from `libxmr.analyze` or chart rendering, throw a tagged
`BlockRenderError(reason)`. The `refresh` command catches per-block
(Risks row 1).

Tests use canned CSV strings (15 stable points → predictable, 15 with one
outlier → signals_present, 5 points → insufficient_data) and assert the
returned array's first line starts with `**Latest:**`, the second is empty,
the chart sits between the two fence lines, and the last line is the
`**Signals:**` token list. No filesystem in tests beyond reading a temp CSV.

### 8. Implement `refresh` command

Files created:

- `libraries/libwiki/src/commands/refresh.js`
- `libraries/libwiki/test/cli-refresh.test.js`

`runRefreshCommand(values, args, cli)`:

1. `args[0]` is the storyboard path; usage-error when missing.
2. Read the file, call `scanMarkers(text)`, exit 0 with no write when the
   array is empty (criterion #3).
3. For each block in **reverse** order (bottom-up, decision R4): call
   `renderBlock` inside a `try`; on success replace the owned span with the
   rendered lines via
   `lines.splice(openLine + 1, closeLine - openLine - 1, ...rendered)` —
   the marker lines themselves (`openLine` and `closeLine`) are preserved;
   on `BlockRenderError` print
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

`src/index.js`: add `scanMarkers`, `renderBlock`, `WikiRepo`, `listSkills`
to the re-export block. Preserve every existing export verbatim
(`writeMemo`, `listAgents`, `insertMarkers`, `MEMO_INBOX_MARKER`,
`OBSERVATIONS_HEADING`, `BROADCAST_TARGET`).

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

Verify: `grep -c 'fit-wiki refresh' .claude/skills/kata-session/SKILL.md`
returns ≥1; `grep -c 'paste the resulting X+mR chart' .claude/skills/kata-session/SKILL.md`
returns 0 (the manual-paste instruction is gone).

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

- `libraries/libwiki/package.json` (extend `forwardimpact.needs`)
- `libraries/README.md` (regenerated)

Extend `libwiki`'s `forwardimpact.needs` array with one phrase per new
capability — each must be unique across the monorepo
([`libraries/CLAUDE.md`](../../libraries/CLAUDE.md)). Suggested wording:

- `"Refresh XmR chart blocks inside a storyboard markdown file"` (refresh)
- `"Bootstrap a wiki working tree for a Kata installation"` (init)
- `"Push agent-authored wiki changes to the remote"` (push)
- `"Pull remote wiki changes into the local working tree"` (pull)

Then run `bun run context:fix` (the `lib:fix` alias documented in
`libraries/CLAUDE.md` does not exist as a script; the actual catalog
regenerator is `context:fix`, see root `package.json`). `bun run check`
fails on a stale catalog.

Verify: `bun run context:fix` then `bun run check` both exit 0.

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
| The inline credential-helper string is a single shell-quoted argv. Any drift from `wiki-sync.sh`'s exact form silently breaks token-based clone in CI. | `auth_git` constructs the argv as a literal array passed straight to `spawnSync` (no shell), with the helper body identical to `scripts/wiki-sync.sh` lines 19-22. Add a unit test that asserts the argv begins with the two `-c credential.helper=...` flags when `GH_TOKEN` is set. |
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
6. Step 14 — `bun run context:fix`, then `bun run check`.
7. Open `plan(780): …` PR; clean sub-agent review panel of 3 per
   `kata-review` caller protocol.
8. Step 15 — wiki-repo migration after merge (separate commit on the wiki
   repo, not gating the monorepo PR).

# Plan A — Spec 780 Wiki lifecycle commands

## Approach

Add four subcommands to the existing `fit-wiki` CLI in two stacks under
`libraries/libwiki/`: a refresh stack (`MarkerScanner` + `BlockRenderer` +
`refresh`) consuming `libxmr.analyze` / `libxmr.renderChart`, and a sync
stack (`WikiRepo` + `SkillRoster` + `init` / `push` / `pull`) wrapping
system `git` with the credential/identity pattern from
`scripts/wiki-sync.sh`. Wire both into `bin/fit-wiki.js`, then propagate
through the four content edits (storyboard template, team-storyboard,
kata-session SKILL, justfile) plus the libwiki skill+guide pair. In
parallel, retrofit the five `fit-xmr` commands that take a `<csv-path>`
positional (`analyze`, `chart`, `summarize`, `validate`, `list`) with the
same `Finder.findProjectRoot` resolution `fit-xmr record` already uses
(decision X1) — every wiki-management command becomes cwd-independent.
Tests use temp dirs and local bare git repos. The monorepo PR satisfies
criteria #1–#3 via fixtures, #4–#8 via bare-repo harnesses, #9–#12 by
static inspection, and #13 via a cross-command cwd-independence test;
the in-scope `wiki/storyboard-2026-M05.md` content edit ships as a
separate wiki-repo commit (step 17) because the wiki is a separate
repository.

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
| `commitAndPush(message)`         | Order: short-circuit via `isClean()` first — return `{pushed:false, reason:'clean'}` (criterion #7); otherwise `git -C wikiDir add -A` → `git commit -m message` → `fetch()` → `git rebase origin/master`; on rebase failure: `git rebase --abort` then `git merge origin/master -X ours --no-edit` (decision W3); finally `auth_git push origin master`. |

`auth_git` is a private helper that prefixes the git argv with two `-c`
flags when either `GH_TOKEN` or `GITHUB_TOKEN` is set in the process
environment; otherwise it spawns plain git. The two argv elements are:

```js
const HELPER_CLEAR = '-c credential.helper=';
const HELPER_INLINE = `-c credential.helper=!f() { echo username=x-access-token; echo "password=\${GH_TOKEN:-\$GITHUB_TOKEN}"; }; f`;
```

The `\$` escapes prevent JS template-literal substitution; the resulting
strings are byte-for-byte identical to the bash form in `scripts/wiki-sync.sh`
lines 20-21 (single-quoted there, template-literal here — same payload).
The argv is passed straight to `spawnSync` as a flat array (no `shell:true`
on the spawn). Git itself parses the second flag and runs the helper body
in a subshell, which is what resolves `${GH_TOKEN:-$GITHUB_TOKEN}` against
the inherited env — that's why the JS string must keep the literal `${...}`
characters intact for git's downstream shell to evaluate. Credentials
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

Single `listSkills({ skillsDir }, fs = { readdirSync, statSync })` function
(mirror `agent-roster.js`'s injected-fs shape so tests can stub the
filesystem). Caller resolves `skillsDir` explicitly (typically
`path.join(finder.findProjectRoot(process.cwd()), '.claude', 'skills')`,
matching `memo.js` line 40-42). The function reads the directory, filters
to entries that are directories and start with `kata-`, returns an array of
slugs sorted ascending. Drop dot-prefixed entries.

Tests: empty dir → `[]`; mixed `kata-*` and `fit-*` dirs → only kata; ignore
files and `.DS_Store`; sorted output is stable.

Verify: `bun test libraries/libwiki/test/skill-roster.test.js` passes.

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

CLI flags: `--wiki-root` (default `wiki`) and `--skills-dir` (default
`.claude/skills`) — both relative paths resolve via
`path.resolve(projectRoot, value)`, absolute paths pass through unchanged.
Both used by tests; agents rely on defaults. No `.gitkeep` files created
(decision I2).

Variable derivation inside `runInitCommand` (matches step 5):

```js
const projectRoot = finder.findProjectRoot(process.cwd());
const wikiDir     = path.resolve(projectRoot, values["wiki-root"] ?? "wiki");
const skillsDir   = path.resolve(projectRoot, values["skills-dir"] ?? path.join(".claude", "skills"));
const originUrl   = readOriginUrl(projectRoot);   // git -C projectRoot config --get remote.origin.url
const wikiUrl     = originUrl.replace(/\.git$/, "") + ".wiki.git";
```

When `origin` is unset (fresh downstream install with no remote yet),
`readOriginUrl` returns null; init prints
`init: parent repo has no 'origin' remote — set one before running fit-wiki init`
to stderr and exits non-zero. The fit-xmr `record` command works without
a wiki being cloned, so a session can still record metrics on the
clone-failed path.

Tests use a temp project with a fake parent repo (`git init` + `origin` set
to a local bare repo), assert `git -C wiki rev-parse --git-dir` succeeds and
`wiki/metrics/kata-spec/` exists after run (criterion #4); second run produces
no error and no new commits (criterion #5).

Verify: `bun test libraries/libwiki/test/cli-init.test.js` passes.

### 5. Implement `push` and `pull` commands

Files created:

- `libraries/libwiki/src/commands/sync.js`
- `libraries/libwiki/test/cli-sync.test.js`

Single module exports `runPushCommand` and `runPullCommand`. Each:

1. Resolves `projectRoot = finder.findProjectRoot(process.cwd())` (Finder).
2. Builds `wikiDir = path.resolve(projectRoot, values["wiki-root"] ?? "wiki")`
   so the `--wiki-root` CLI flag declared in step 9 is actually honored;
   relative paths resolve against the project root.
3. Constructs `repo = new WikiRepo({ wikiDir, parentDir: projectRoot })`.
4. Calls `repo.inheritIdentity()` before each operation (matching
   `wiki-sync.sh` lines 44-45).
5. For push: `repo.commitAndPush('wiki: update from session')`.
   For pull: `repo.pull()` wrapped in try/catch — on `WikiPullConflict`,
   exit non-zero with the stderr line
   `fit-wiki pull: rebase conflict — local divergence detected; resolve manually or push first`
   (matches `scripts/wiki-sync.sh` line 54).
6. Print a one-line outcome to stdout.

Tests use the same bare-repo harness as `WikiRepo` tests:

- push with no local changes → exit 0, no new commit (criterion #7);
- push with one local change → commit lands on origin (criterion #6);
- pull picks up an external commit (criterion #8);
- pull with diverging local edit → exit non-zero, wiki tree untouched.

Verify: `bun test libraries/libwiki/test/cli-sync.test.js` passes.

### 6. Implement `MarkerScanner`

Files created:

- `libraries/libwiki/src/marker-scanner.js`
- `libraries/libwiki/test/marker-scanner.test.js`

Single `scanMarkers(text, { sourcePath })` function. Splits on `\n` and
walks line by line. Open marker matches the regex
`/^<!--\s*xmr:([^:\s]+):([^\s]+)\s*-->\s*$/`; close marker matches
`/^<!--\s*\/xmr\s*-->\s*$/`. State machine: walk top-down tracking the
current open block; on close, push `{ metric, csvPath, openLine, closeLine }`
(0-indexed) and reset; on a second open before a close (or a close with
no preceding open), emit the literal warning
`dangling-marker {sourcePath}:{lineNumber}` to stderr (matches design
§ Risks row 2 verbatim) and reset state to the new open (or skip the
stray close). Return the array of well-formed pairs.

Tests: zero pairs in unmarked text; one pair around an example block; two
pairs separated by prose; dangling open emits stderr warning and is skipped;
malformed marker (extra colon, missing slash on close) is not recognized.

Verify: `bun test libraries/libwiki/test/marker-scanner.test.js` passes.

### 7. Implement `BlockRenderer`

Files created:

- `libraries/libwiki/src/block-renderer.js`
- `libraries/libwiki/test/block-renderer.test.js`

Single `renderBlock({ metric, csvPath, projectRoot, fs })` function (`fs`
optional, defaults to `node:fs`). Resolves `csvPath` against `projectRoot`,
reads the CSV, calls `libxmr.analyze`, finds `report.metrics` entry by name
(throw `BlockRenderError('metric-not-found')` when absent so the per-block
try/catch surfaces a diagnostic instead of a TypeError), then returns an
array of strings (one per line) matching the design § Marker contract
exactly:

```
['**Latest:** {latestValue} · **Status:** {status}',
 '',
 '```',
 ...chartText.split('\n'),
 '```',
 '',
 '**Signals:** {signal-line}']
```

Where:

- `latestValue` is `m.latest?.value ?? '—'`. `libxmr.analyze` omits the
  `latest` field for `insufficient_data`
  (`libraries/libxmr/src/analyze.js:35-49`); the em-dash matches the
  storyboard convention used in `wiki/storyboard-2026-M05.md` for low-N
  metrics. Do **not** fall back to `m.values[length-1]` — even though
  `analyze` populates `values` for insufficient_data, the convention is to
  signal "no XmR baseline yet" with the em-dash rather than show a single
  measurement that lacks limits or signals.
- `chartText` is `renderChart(m.values, m.stats, m.signals)` for predictable
  and signals_present, and the literal line
  `Insufficient data: ${m.n} points (need at least ${MIN_POINTS}).`
  for insufficient_data — the same string `bunx fit-xmr chart` prints today
  (`libraries/libxmr/src/commands/chart.js:50-55`). Import
  `MIN_POINTS` from `@forwardimpact/libxmr` (already exported from
  `libraries/libxmr/src/index.js:14-21`). The chart slot is always
  populated; the design's three-part output is unconditional.
- `signal-line` is the comma-separated list of fired rule names
  (`xRule1`, `xRule2`, `xRule3`, `mrRule1`) — exact tokens used in the
  existing storyboard convention (`storyboard-template.md` line 48).
  Empty list (or `m.signals` undefined for insufficient_data) renders as
  `—` (em dash).

The array has no leading or trailing blank line — those are owned by the
caller (`refresh`) and live outside the marker pair.

On any error from `libxmr.analyze` or chart rendering (including the
`metric-not-found` case above), throw a tagged `BlockRenderError(reason)`.
The `refresh` command catches per-block (Risks row 1).

Tests use canned CSV strings (15 stable points → predictable, 15 with one
outlier → signals_present, 5 points → insufficient_data) and assert:

- the first line is exactly `**Latest:** {expected-value} · **Status:** {expected-status}`
  (matches what `bunx fit-xmr analyze --format json` reports for the same
  CSV — closes criterion #1);
- the second line is empty;
- the chart sits between the two fence lines and equals
  `renderChart(...)` for the predictable/signals_present cases or the
  literal insufficient-data line for the low-N case;
- the last line is exactly `**Signals:** {expected-tokens-or-em-dash}`
  matching the `signals` field from `analyze` (also closes criterion #1).

No filesystem in tests beyond reading a temp CSV.

Verify: `bun test libraries/libwiki/test/block-renderer.test.js` passes.

### 8. Implement `refresh` command

Files created:

- `libraries/libwiki/src/commands/refresh.js`
- `libraries/libwiki/test/cli-refresh.test.js`

`runRefreshCommand(values, args, cli)`:

1. `args[0]` is the storyboard path; usage-error when missing.
2. Resolve `projectRoot = finder.findProjectRoot(process.cwd())` (Finder),
   matching `memo.js:40-42`. The storyboard path resolves via
   `path.resolve(projectRoot, args[0])` so relative paths work from any
   subdirectory; absolute paths pass through unchanged.
3. Read the file, call `scanMarkers(text)`, exit 0 with no write when the
   array is empty (criterion #3).
4. For each block in **reverse** order (bottom-up, decision R4): call
   `renderBlock({ metric, csvPath, projectRoot })` inside a `try` — passing
   the same `projectRoot` so the marker's CSV path (relative to project
   root per design decision R5) resolves consistently regardless of where
   the user invoked the command from. On success replace the owned span
   with the rendered lines via
   `lines.splice(openLine + 1, closeLine - openLine - 1, ...rendered)` —
   the marker lines themselves (`openLine` and `closeLine`) are preserved;
   on `BlockRenderError` print
   `refresh-error <storyboard.md>:<openLine+1> <reason>` to stderr and leave
   the original span untouched.
5. Write the joined buffer back to the file in a single `writeFileSync`.

Tests:

- Storyboard with no markers → file unchanged, `git diff` empty (criterion #3).
- Storyboard with one marker referencing a known CSV → block content matches
  what `bunx fit-xmr chart` produces for that metric (criterion #1).
- Refresh twice → second `diff` is empty (criterion #2).
- Two markers in one file → both blocks regenerate, surrounding prose
  preserved.
- Marker referencing a missing CSV → stderr carries `refresh-error`, file
  span unchanged, exit 0.
- **Working-directory independence:** the temp project root carries a
  `package.json` (so `Finder.findProjectRoot` anchors there). Invoke the
  command via `execFileSync` with `cwd` set to a nested subdirectory of
  that project, passing the storyboard path relative to the project root
  (e.g. `wiki/storyboard.md`); projectRoot is still discovered, marker
  CSV paths still resolve, and the output matches the same invocation
  from the project root.

Verify: `bun test libraries/libwiki/test/cli-refresh.test.js` passes.

### 9. Wire commands into the CLI

Files modified:

- `libraries/libwiki/bin/fit-wiki.js`
- `libraries/libwiki/src/index.js`

`bin/fit-wiki.js`: extend the `commands` array on the `definition` with four
new entries:

| Command   | `args` (libcli string) | Options                        |
| --------- | ---------------------- | ------------------------------ |
| `refresh` | `"<storyboard-path>"`  | _(none)_                       |
| `init`    | _(none)_               | `--wiki-root`, `--skills-dir`  |
| `push`    | _(none)_               | `--wiki-root`                  |
| `pull`    | _(none)_               | `--wiki-root`                  |

Use the libcli string-shaped `args` field, matching `libxmr/bin/fit-xmr.js`
convention (`args: "<csv-path>"`). `refresh` does not take `--wiki-root`
because the storyboard path is positional and CSV paths resolve against
`projectRoot` (Finder), not the wiki root. Extend the `COMMANDS` dispatch
map with the four new handlers. Update the `examples` block to include one
canonical invocation per command.

`src/index.js`: add `scanMarkers`, `renderBlock`, `WikiRepo`, `listSkills`
to the re-export block. Preserve every existing export verbatim
(`writeMemo`, `listAgents`, `insertMarkers`, `MEMO_INBOX_MARKER`,
`OBSERVATIONS_HEADING`, `BROADCAST_TARGET`).

Verify: `bunx fit-wiki --help` lists `memo`, `refresh`, `init`, `push`,
`pull` (5 total — the existing `memo` plus the 4 new commands);
`bunx fit-wiki refresh --help` shows the `<storyboard-path>` positional.

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

- Read-do checklist bullet currently at lines 50-53 (the
  `For team storyboard runs, render an X+mR chart …` item) — replace with
  `bunx fit-wiki refresh wiki/storyboard-{YYYY}-M{MM}.md`.
- Facilitator process step 4 currently at lines 121-129 — keep the
  `analyze --format json` call (still used for Q2 `Ask` content); replace
  the chart-paste sentence with `bunx fit-wiki refresh`. Drop the in-line
  "do not duplicate μ, UPL, LPL" prose — `team-storyboard.md` already
  carries it.

Verify (positive + negative pair): `grep -c 'fit-wiki refresh' .claude/skills/kata-session/SKILL.md`
returns ≥2 (the read-do bullet and the facilitator step both reference the
new command), and `grep -c 'fit-xmr chart' .claude/skills/kata-session/SKILL.md`
returns 0 (the manual chart instructions are gone — only `fit-xmr analyze
--format json` remains, which `grep -c 'fit-xmr analyze'` should return ≥1
to confirm).

### 13. Update `fit-wiki` skill and wiki-operations guide

Files modified:

- `.claude/skills/fit-wiki/SKILL.md`
- `websites/fit/docs/libraries/wiki-operations/index.md`

`libraries/CLAUDE.md` § "CLIs and progressive documentation" requires that
every CLI ship with three aligned artifacts: the user guide, the skill, and
the CLI `--help`. Step 9 covers the help text; this step covers the other
two for the four new commands.

`SKILL.md`: under `## Commands`, add four sub-sections (`### refresh`,
`### init`, `### push`, `### pull`) following the `### memo` template —
one-sentence purpose, one fenced `npx fit-wiki <cmd>` example, one bullet
on the surrounding workflow context (e.g., refresh is the storyboard
maintenance command; push/pull are hook-ready). Update the front-matter
`description` to mention storyboard refresh and wiki sync alongside memos.

`wiki-operations/index.md`: add a "Refresh storyboards", "Init the wiki",
and "Sync (push/pull)" subsection next to the existing memo content. Use
the same audience voice (external agent / engineer using `npx fit-wiki`).

Verify: `grep -c '### refresh\|### init\|### push\|### pull' .claude/skills/fit-wiki/SKILL.md`
returns 4; `grep -c 'fit-wiki refresh\|fit-wiki init\|fit-wiki push\|fit-wiki pull' websites/fit/docs/libraries/wiki-operations/index.md`
returns ≥4.

### 14. Switch justfile recipes

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

### 15. Make `fit-xmr` commands cwd-independent

Files modified:

- `libraries/libxmr/src/commands/analyze.js`
- `libraries/libxmr/src/commands/chart.js`
- `libraries/libxmr/src/commands/summarize.js`
- `libraries/libxmr/src/commands/validate.js`
- `libraries/libxmr/src/commands/list.js`

Files created:

- `libraries/libxmr/test/cwd-independence.test.js`

Each of the five commands today opens with the same three-line block:

```js
const csvPath = args[0];
if (!csvPath) { cli.usageError("..."); process.exit(2); }
if (!existsSync(csvPath)) { cli.usageError(`cannot read CSV "${csvPath}": file not found`); process.exit(2); }
```

Replace those three lines in every command with the pattern from
`record.js:62-66`:

```js
const inputPath = args[0];
if (!inputPath) { cli.usageError("..."); process.exit(2); }

const finder = new Finder(fsAsync, { debug() {} }, process);
const projectRoot = finder.findProjectRoot(process.cwd());
const csvPath = path.resolve(projectRoot, inputPath);

if (!existsSync(csvPath)) { cli.usageError(`cannot read CSV "${inputPath}": file not found`); process.exit(2); }
```

Add the matching imports at the top of each file
(`import path from "node:path"; import fsAsync from "node:fs/promises";
import { Finder } from "@forwardimpact/libutil";`). Use `inputPath` (not
`csvPath`) wherever the user-supplied string flows into output — every
existing `report.source = csvPath`, header label, and error message
keeps `inputPath` so byte-for-byte output stays the same when the agent
invokes from the project root. Only filesystem reads (`existsSync`,
`readFileSync`) take the resolved `csvPath`. `fit-xmr record` is already
on this pattern and is not modified.

Tests: `libraries/libxmr/test/cwd-independence.test.js` exercises each of
the five commands via `execFileSync('node', [bin, cmd, 'fixtures/x.csv'])`
twice — once with `cwd` set to the temp project root, once with `cwd` set
to a nested subdirectory of that project — and asserts identical exit code
and stdout. Cover one command per CSV pair to keep runtime bounded;
fixtures live under `libraries/libxmr/test/fixtures/`.

Verify: `bun test libraries/libxmr/test/cwd-independence.test.js` passes
(criterion #13).

### 16. Regenerate library catalog

Files modified:

- `libraries/libwiki/package.json` (extend `forwardimpact.needs`)
- `libraries/README.md` (regenerated)

Extend `libwiki`'s `forwardimpact.needs` array with the four phrases below
(each must be unique across the monorepo per
[`libraries/CLAUDE.md`](../../libraries/CLAUDE.md); these were chosen to
not collide with the existing `libwiki` / `libxmr` / `libutil` entries):

- `"Refresh XmR chart blocks inside a storyboard markdown file"`
- `"Bootstrap a wiki working tree for a Kata installation"`
- `"Push agent-authored wiki changes to the remote"`
- `"Pull remote wiki changes into the local working tree"`

Then run `bun run context:fix` (the catalog regenerator; the `lib:fix`
alias documented in `libraries/CLAUDE.md:39` does not exist as a script —
the working name lives in root `package.json:40`). `bun run check` fails
on a stale catalog.

Verify: `bun run context:fix` then `bun run check` both exit 0, and
`grep -c 'Refresh XmR chart blocks' libraries/README.md` returns ≥1
(confirms the regenerated catalog actually surfaces the new
`forwardimpact.needs` rows; `bun run check` validates catalog freshness
but a stale-README scenario where neither side is wrong is still possible
without the explicit grep).

### 17. Migrate existing storyboard (wiki repo, post-merge)

Files modified (separate commit, in the `forwardimpact/monorepo.wiki.git`
repository — **not** in the monorepo PR):

- `wiki/storyboard-2026-M05.md`

After the monorepo PR merges, the implementer:

1. `bunx fit-wiki init` (or `cd wiki && git pull` if already cloned).
2. **Reconcile inline narrative.** The current storyboard's `**Signals:**`
   line carries free-text narrative after the rule list, e.g.
   `**Signals:** xRule1, mrRule1 — slot-6 outlier on 2026-04-22`. Split
   each such line: keep `**Signals:** xRule1, mrRule1` in place, then
   append a `_Note:_ slot-6 outlier on 2026-04-22` line **below** the
   block. `_Note:_` lines sit outside the marker pair and survive
   refresh.
3. For each `#### {metric_name}` block under Current Condition, wrap the
   `**Latest:** …` / fenced chart / reconciled `**Signals:** …` triple
   with
   `<!-- xmr:{metric_name}:wiki/metrics/{skill}/2026.csv -->` and
   `<!-- /xmr -->`. The `#### {metric_name}` heading and any `_Note:_`
   line stay outside.
4. `bunx fit-wiki refresh wiki/storyboard-2026-M05.md` — confirm the
   `git diff` shows only formatting reconciliation (chart whitespace,
   trailing-space normalization), not content drift. Re-add `_Note:_`
   below the block if any narrative was missed in step 2.
5. `bunx fit-wiki push`.

Past storyboards (`storyboard-2026-M04.md` and earlier) are not touched —
they are historical records (spec § Scope (in) row 1).

Verify (post-merge, in the wiki repo — not gating monorepo PR approval):
`git -C wiki log -1 --oneline` shows the migration commit;
`bunx fit-wiki refresh wiki/storyboard-2026-M05.md` is a no-op on the next
run.

## Risks

| Risk                                                                                                                                       | Mitigation                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The inline credential-helper string is a single shell-quoted argv. Any drift from `wiki-sync.sh`'s exact form silently breaks token-based clone in CI. | `auth_git` constructs the argv as a literal array passed straight to `spawnSync` (no shell), with the helper body identical to `scripts/wiki-sync.sh` lines 19-22. Add a unit test that asserts the argv begins with the two `-c credential.helper=...` flags when `GH_TOKEN` is set. |
| The wiki repo (`monorepo.wiki.git`) does not exist for first-time downstream installations. `init` against a non-existent remote fails on the underlying `git clone`. | `WikiRepo.ensureCloned` wraps the spawn in a try/catch and returns `{cloned:false, reason}`; `init` prints the diagnostic to stderr and exits 0. New installations create the wiki by pushing the first time, exactly as `wiki-sync.sh` does today (Risks row 3 in design). |
| Storyboard prose drift between metric blocks. If a marker pair surrounds prose lines that are not pure `Latest/Chart/Signals`, refresh wipes them. | Document the marker contract in `storyboard-template.md` (step 10) — `_Note:_` and any cross-reference text sits **outside** the markers. The migration in step 17 places markers tightly around the regenerated triple. |
| `wiki/storyboard-2026-M05.md` carries inline narrative on the `**Signals:**` line itself (e.g. `**Signals:** xRule1 — slot-6 outlier`); a naive marker wrap leaves the narrative inside the regenerated span and refresh wipes it on next run. | Step 17 adds an explicit reconciliation pass that splits inline narrative into a `_Note:_` line below the block before wrapping markers. Refresh's first run on the migrated file should show only chart-whitespace reconciliation in `git diff`. |

## Execution

Two agents:

| Agent              | Steps                                                         |
| ------------------ | ------------------------------------------------------------- |
| `staff-engineer`   | 1, 2, 3, 4, 5, 6, 7, 8, 9, 14, 15, 16, 17                     |
| `technical-writer` | 10, 11, 12, 13                                                |

The four doc-only edits (storyboard template, team-storyboard reference,
kata-session SKILL, fit-wiki SKILL + wiki-operations guide) route to
`technical-writer` per kata-plan § Execution recommendation. The justfile
and catalog regen stay with `staff-engineer` because they're build-system
edits that need to land in the same commit as the code that switches them.

Sequence:

1. Step 1 — package.json dep (unblocks step 7). [staff-engineer]
2. Steps 2-5 — sync stack. [staff-engineer]
3. Steps 6-8 — refresh stack. [staff-engineer]
4. Step 9 — CLI wiring. [staff-engineer]
5. Steps 10-13 — content edits (markers in template, refresh-as-canonical
   in team-storyboard and kata-session SKILL, four-command alignment in
   fit-wiki SKILL + wiki-operations guide). Can run in parallel with
   steps 2-9 since they only depend on the marker contract and CLI
   surface, both pinned in this plan. [technical-writer]
6. Step 14 — justfile flip. [staff-engineer]
7. Step 15 — `fit-xmr` cwd-independence retrofit. Independent of every
   prior step (different package, different files); can run in parallel
   with the libwiki work. [staff-engineer]
8. Step 16 — `bun run context:fix`, then `bun run check`. Run after all
   prior steps merge into the working tree. [staff-engineer]
9. Open `plan(780): …` PR; clean sub-agent review panel of 3 per
   `kata-review` caller protocol.
10. Step 17 — wiki-repo migration after merge (separate commit on the
    wiki repo, not gating the monorepo PR). [staff-engineer]

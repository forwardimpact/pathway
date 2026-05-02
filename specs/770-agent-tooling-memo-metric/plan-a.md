# Plan A — Spec 770 Agent Tooling: `fit-wiki memo` and `fit-xmr record`

## Approach

Build the `libwiki` package with `fit-wiki memo` from the bottom up — primitives
(`MemoWriter`, `AgentRoster`, `MarkerMigrator`) first, then the CLI on top —
then add `record` as a sibling command on the existing `fit-xmr` CLI in
`libxmr`. With both CLIs functioning, run the two one-shot migrations
(marker insertion via `MarkerMigrator`, metrics consolidation via a repo-root
script), then sweep all protocol/template/skill docs to flip the metrics path
and adopt the marker. Catalog refresh and full check at the end.

Libraries used: `@forwardimpact/libcli` (`createCli`),
`@forwardimpact/libutil` (`Finder`), `@forwardimpact/libxmr`
(`analyze`, `EXPECTED_HEADER`) for the `record` command's analyze pass and
header bootstrap. `libwiki` does not depend on `libxmr` per design P3.

## Steps

### 1. Bootstrap `@forwardimpact/libwiki`

- Created: `libraries/libwiki/package.json` (mirror `libxmr` shape; capability
  `agent-self-improvement`; one need: `Append a cross-team observation to a
  wiki summary`; bin `fit-wiki` → `./bin/fit-wiki.js`; depend on
  `@forwardimpact/libcli` and `@forwardimpact/libutil` (for `Finder`); devDep
  `@forwardimpact/libharness`).
- Created: `libraries/libwiki/README.md` (purpose, key exports, one example).
- Created: `libraries/libwiki/src/index.js` exporting
  `{ writeMemo, listAgents, insertMarkers, MEMO_INBOX_MARKER, OBSERVATIONS_HEADING }`.
- Created: `libraries/libwiki/src/constants.js` defining
  `MEMO_INBOX_MARKER = "<!-- memo:inbox -->"`,
  `OBSERVATIONS_HEADING = "## Observations for Teammates"`,
  `SUMMARY_H1_RE = /^# .+ — Summary$/`,
  `BROADCAST_TARGET = "all"`.
- Created: empty `libraries/libwiki/bin/fit-wiki.js`,
  `libraries/libwiki/src/commands/memo.js` placeholders (filled in step 5).

Verify: `bun install` adds the workspace; `bun -e "import('./libraries/libwiki/src/index.js').then(m => console.log(Object.keys(m)))"` prints the named exports above. Catalog refresh is deferred to Step 15 — Step 1 must not run `bun run lib:fix`.

### 2. Implement `MemoWriter`

- Created: `libraries/libwiki/src/memo-writer.js` exporting
  `writeMemo({ summaryPath, sender, message, today }, fs = nodeFs)` —
  reads the file, splits on the first `MEMO_INBOX_MARKER` line, splices
  `- ${today} **${sender}**: ${message}` immediately after the marker line
  (M3), writes the file in one `writeFileSync` call (M4). Returns
  `{ written: true, path }` on success or
  `{ written: false, reason: "missing-marker", path }` if the marker is
  absent. Multi-line messages are collapsed to single-line (replace `\n` with
  ` `) so the bullet stays render-stable.
- Created: `libraries/libwiki/test/memo-writer.test.js` covering: happy path,
  missing-marker returns the error result, marker preserved (still present
  after write), bullet appears on the line directly after the marker.

Verify: `cd libraries/libwiki && bun test test/memo-writer.test.js` green.

### 3. Implement `AgentRoster`

- Created: `libraries/libwiki/src/agent-roster.js` exporting
  `listAgents({ wikiRoot }, fs = nodeFs)` — globs `<wikiRoot>/*.md` (excludes
  the `metrics/` subtree by depth-1 only), reads first non-empty line of
  each, returns
  `[{ agent, summaryPath }]` for files whose H1 matches `SUMMARY_H1_RE`. The
  `agent` value is the basename without `.md`. Throws
  `Error("agent name 'all' is reserved for broadcast")` if any roster entry
  is `all` (M7).
- Created: `libraries/libwiki/test/agent-roster.test.js` with a `tmpdir`
  fixture covering: discovery of summary files, exclusion of weekly logs
  (`<agent>-2026-W18.md` does not match the H1 regex once the H1 is
  `# Agent — 2026-W18`), exclusion of `MEMORY.md` and `Home.md`, broadcast
  collision check.

Verify: `bun test test/agent-roster.test.js` green; running
`listAgents({ wikiRoot: "wiki" })` against the live tree returns six rows
(improvement-coach, product-manager, release-engineer, security-engineer,
staff-engineer, technical-writer).

### 4. Implement `MarkerMigrator`

- Created: `libraries/libwiki/src/marker-migrator.js` exporting
  `insertMarkers({ wikiRoot }, fs = nodeFs)` — for each summary returned by
  `listAgents`: read; if `MEMO_INBOX_MARKER` already present, count as
  `skipped`; else locate `OBSERVATIONS_HEADING` line, splice
  `\n${MEMO_INBOX_MARKER}\n` immediately after the heading line (M2), write,
  count as `inserted`. If the heading is missing, push to `errors`. Returns
  `{ inserted: [...], skipped: [...], errors: [...] }`. Idempotent.
- Created: `libraries/libwiki/test/marker-migrator.test.js` covering: insert
  on first run, skip on second run, error when section missing, marker placed
  directly under heading.

Verify: `bun test test/marker-migrator.test.js` green.

### 5. Wire `fit-wiki memo` CLI

- Modified: `libraries/libwiki/bin/fit-wiki.js` — `createCli` definition with
  one command:

  ```
  memo  --from <sender>  --to <target|all>  --message <text>  [--wiki-root <path>]
  ```

  `--from`, `--to`, `--message` required; `--wiki-root` optional (default
  resolved at runtime — see handler). Global options: `help`, `version`,
  `json`. Examples cover one-target send and `--to all` broadcast.
- Modified: `libraries/libwiki/src/commands/memo.js` exporting
  `runMemoCommand(values, args, cli)`:
  - Resolve `wikiRoot`: if `values["wiki-root"]` is set, use it verbatim;
    else use `path.join(new Finder().findProjectRoot(process.cwd()), "wiki")`
    (`Finder` from `@forwardimpact/libutil`).
  - If `--to all`: call `listAgents`, iterate, call `writeMemo` for each;
    aggregate results.
  - Else: resolve `<wikiRoot>/<target>.md` and call `writeMemo` once.
  - On missing-marker for any target, exit 2 with the message
    `"summary lacks memo:inbox marker: <path>"` (loud, recoverable per Risks
    #1 in the design).
  - On success, print one line per write: `wrote ${path}`.
- Created: `libraries/libwiki/test/cli-memo.test.js` covering single-target
  write, broadcast, missing-marker exit code 2, missing target file exit
  code 2.
- Modified: `libraries/libwiki/src/index.js` to also export
  `runMemoCommand`.

Verify: `bunx fit-wiki memo --from x --to y --message "hello"` against a
fixture writes the bullet; `bunx fit-wiki memo --help` lists `--from --to
--message` as required.

### 6. Add `fit-xmr record` command

- Created: `libraries/libxmr/src/commands/record.js` exporting
  `runRecordCommand(values, args, cli)`:
  - Required flags: `--agent <name> --metric <name> --value <number>`.
  - Optional: `--unit` (default `count`), `--run` (default `""`),
    `--note` (default `""`), `--wiki-root` (default `wiki`),
    `--date` (default `new Date().toISOString().slice(0, 10)`).
  - Resolve `csvPath = path.join(wikiRoot, "metrics", agent, `${YYYY}.csv`)`
    where `YYYY = date.slice(0, 4)` (X1, X4).
  - Ensure parent dir; if file missing, write `EXPECTED_HEADER + "\n"` first
    (X3 — append before analyze).
  - Append one CSV row. Quote helper inline at the top of `record.js`:
    `const csvField = (v) => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);`
    — applied to every field. (`libxmr/src/csv.js` does not currently export
    a quote helper; this is a local helper, not a new public export.)
  - Read full file, call `analyze(text)`, filter to the recorded metric;
    pull `{ n, status, latest: { value } }`. For the
    `insufficient_data` branch (`n < MIN_POINTS`), `analyze` still sets
    `n`, `status`, and the trailing raw `values[]`; print
    `latest=<values[n-1]>`. Status string is taken verbatim from `analyze`
    (`predictable | signals_present | insufficient_data`).
  - Print one line:
    `metric=<name> n=<n> status=<status> latest=<value>` (X2).
  - If `analyze` throws: `process.stderr.write("warning: analyze failed: <msg>\n")`,
    exit 0 (X3 — row already durable).
  - Append failure (`writeFileSync` throws) → exit 2.
- Modified: `libraries/libxmr/bin/fit-xmr.js` — register `record` in
  `commands` array and `COMMANDS` dispatch; add example
  `fit-xmr record --agent product-manager --metric issues_triaged --value 3`.
  Update existing example paths from
  `wiki/metrics/security-engineer/audit/2026.csv` to
  `wiki/metrics/security-engineer/2026.csv` (criterion #7).
- Created: `libraries/libxmr/test/record.test.js` covering: new file gets
  header + 1 row (criterion #4), append-only on existing file, one-line
  output format (criterion #3), analyze-failure tolerated, missing
  required flags exit 2, custom `--wiki-root` honoured.

Verify: `cd libraries/libxmr && bun test test/record.test.js` green;
`bunx fit-xmr --help` lists `record`.

### 7. Refresh libxmr metadata + catalog

- Modified: `libraries/libxmr/package.json` — add to `forwardimpact.needs`:
  `"Record a metric and print its current XmR status"`.
- Modified: `libraries/libxmr/README.md` — add `record` to the command list;
  flat path examples.
- Modified: `libraries/libxmr/src/index.js` — `EXPECTED_HEADER` is already
  re-exported (line 20); no change needed there. No new symbols are exposed
  beyond the CLI command.

Verify: `bunx fit-xmr --help` shows `record` in the command list. Catalog
refresh is deferred to Step 15.

### 8. Migrate markers into existing summaries

- Modified: `wiki/improvement-coach.md`, `wiki/product-manager.md`,
  `wiki/release-engineer.md`, `wiki/security-engineer.md`,
  `wiki/staff-engineer.md`, `wiki/technical-writer.md` — each gains exactly
  one `<!-- memo:inbox -->` line directly under
  `## Observations for Teammates`.
- Created: `scripts/migrate-memo-markers.mjs` — a 5-line ES module that
  imports `insertMarkers` from `@forwardimpact/libwiki` and runs it against
  `wiki/`. Committed alongside the wiki edits so the migration is
  reproducible from history (per design X5: no permanent CLI subcommand,
  but a checked-in one-shot script is preserved as the audit trail).
  Run from repo root: `bun scripts/migrate-memo-markers.mjs`.

Verify (criterion #5): `grep -c '<!-- memo:inbox -->' wiki/{improvement-coach,product-manager,release-engineer,security-engineer,staff-engineer,technical-writer}.md`
returns `1` for every file.

### 9. Migrate metrics to flat structure

- Created: `scripts/migrate-metrics-flat.mjs` — committed alongside the
  consolidated CSVs as the migration's audit trail (preserved
  post-migration; not deleted). For each
  `wiki/metrics/<agent>/<domain>/**/*.csv` (skip
  `staff-engineer/trace-analysis/` per spec scope-out): parse rows, group
  by agent, sort by `(date, metric)`, write `wiki/metrics/<agent>/<YYYY>.csv`
  with the canonical header. Assert `output_rows == sum(input_rows)` per
  agent — exit non-zero on mismatch. After write, remove the per-domain
  CSV files and the now-empty domain directories. Print
  `<agent>: <n> rows consolidated`.
- Files created: `wiki/metrics/{product-manager,release-engineer,security-engineer,staff-engineer,technical-writer}/2026.csv`
  (5 files).
- Files deleted (12 CSVs + 12 dirs): `product-manager/{backlog,evaluation}`
  (×2), `release-engineer/{merge,release}` (×2),
  `security-engineer/{audit,triage}` (×2),
  `staff-engineer/{design,implementation,spec,trace}` (×4),
  `technical-writer/{documentation,wiki}` (×2). Each contains exactly one
  `2026.csv`; the now-empty dirs are removed too.
- Files preserved: `wiki/metrics/staff-engineer/trace-analysis/exp14/`
  (NDJSON artifacts; out of scope).
- Improvement-coach has no metrics dir; nothing to migrate (per spec § 2).
- Run: `bun scripts/migrate-metrics-flat.mjs`.

Verify (criterion #6): `wc -l wiki/metrics/<agent>/2026.csv` minus 1 (header)
equals the sum across the source files for that agent — assertion already
in the script; rerunning prints zero diff.

### 10. Update memory-protocol

- Modified: `.claude/agents/references/memory-protocol.md`
  - § Summary Contract → § Permitted sections: append a sub-bullet under
    item 5 documenting the marker:
    `Each section begins with the marker `<!-- memo:inbox -->` directly
    under the heading; `fit-wiki memo` writes new bullets immediately after
    it.` (criterion #9)
  - § Excluded line: `wiki/metrics/{agent}/{domain}/` →
    `wiki/metrics/{agent}/`.

Verify: `grep -n 'memo:inbox' .claude/agents/references/memory-protocol.md`
matches; `grep -n '{domain}' .claude/agents/references/memory-protocol.md`
returns nothing.

### 11. Update kata-metrics skill

- Modified: `.claude/skills/kata-metrics/SKILL.md`
  - Recording protocol step 2: replace the `cat >>` heredoc procedure with
    `bunx fit-xmr record --agent <name> --metric <name> --value <n>`.
  - § Storage: path → `wiki/metrics/{agent}/{YYYY}.csv`; remove the
    "Domain matches skill domain slug" sentence.
  - § Analysis examples: drop `{domain}` segment from every command
    example.
- `.claude/skills/kata-metrics/references/csv-schema.md` already carries no
  `{domain}` literals (verified by grep before this plan was written); no
  edit required.
- Modified: `.claude/skills/kata-metrics/references/xmr.md` line 13: drop
  `{domain}/`.

Verify: `grep -rn '{domain}' .claude/skills/kata-metrics/` returns nothing.

### 12. Update kata-session storyboard

- Modified: `.claude/skills/kata-session/references/storyboard-template.md`
  - `### {agent} — {domain}` → `### {agent}` (criterion #8).
  - Path examples → flat.
- Modified: `.claude/skills/kata-session/references/team-storyboard.md`
  - Lines 49, 57, 115 → flat path; `### {agent} — {domain}` → `### {agent}`.
- Modified: `.claude/skills/kata-session/SKILL.md` line 164 → flat path.

Verify: `grep -rn '{domain}' .claude/skills/kata-session/` returns nothing.

### 13. Sweep remaining skill docs

Substitution `wiki/metrics/{agent}/{domain}/` →
`wiki/metrics/{agent}/` across:

- `.claude/skills/kata-documentation/SKILL.md`
- `.claude/skills/kata-product-evaluation/SKILL.md`
- `.claude/skills/kata-product-issue/SKILL.md`
- `.claude/skills/kata-release-cut/SKILL.md`
- `.claude/skills/kata-security-audit/SKILL.md`
- `.claude/skills/kata-security-update/SKILL.md`
- `.claude/skills/kata-spec/SKILL.md`
- `.claude/skills/kata-trace/SKILL.md`
- `.claude/skills/kata-wiki-curate/SKILL.md`

Verify (criterion #7):
`grep -rn '{domain}' .claude/agents/references/memory-protocol.md .claude/skills/kata-metrics/ .claude/skills/kata-session/references/storyboard-template.md libraries/libxmr/`
returns zero matches.

### 14. Update top-level docs

- Modified: `KATA.md` line 271 → flat path.
- Modified: `websites/fit/docs/internals/kata/index.md` — drop `{domain}/`
  from line 175 and from any other line returned by
  `grep -n '{domain}' websites/fit/docs/internals/kata/index.md`. Run the
  grep first; the implementer enumerates the matches before editing so the
  change set is closed.

### 15. Final verification & catalog refresh

Run from repo root:

```sh
bun run lib:fix          # regenerates libraries/README.md (libwiki + libxmr need)
bun run format
bun run check            # includes catalog-staleness gate
bun test libraries/libwiki/test libraries/libxmr/test
```

All four must pass. Then run two grep gates:

```sh
# Criterion #7 (spec-defined)
grep -rn '{domain}' .claude/agents/references/memory-protocol.md \
  .claude/skills/kata-metrics/ \
  .claude/skills/kata-session/references/storyboard-template.md \
  libraries/libxmr/
# Step 13 sweep coverage (plan-defined)
grep -rn '{domain}' .claude/skills/kata-{documentation,product-evaluation,product-issue,release-cut,security-audit,security-update,spec,trace,wiki-curate}/SKILL.md \
  .claude/skills/kata-session/SKILL.md \
  .claude/skills/kata-session/references/team-storyboard.md \
  KATA.md \
  websites/fit/docs/internals/kata/index.md
```

Both must return zero. Storyboard archives under `wiki/storyboard-2026-M0*.md`
keep the legacy `### {agent} — {domain}` headings — out of scope per spec
(historical artifacts); the template flip applies to the next monthly
storyboard onward.

## Risks

| Risk                                                                                                                                                                                                          | Mitigation                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-domain dirs may contain stray non-`2026.csv` files we have not catalogued (e.g. `2025.csv`, `.gitkeep`).                                                                                                  | `migrate-metrics-flat.mjs` globs `**/*.csv` under `wiki/metrics/<agent>/<domain>/` — covers any year file. Non-CSV content under `staff-engineer/trace-analysis/` is excluded by an explicit path filter; any other non-CSV content surfaces as a script error rather than silent skip.                                          |
| Agents currently bulk-write their own observation bullets via `Edit` and may hit a merge conflict the first time both they and `fit-wiki memo` touch the same summary on the same run.                       | The marker placement (top of section) means `fit-wiki memo` always writes line N+1; agents writing `Edit` to append at section bottom write line M >> N+1. No textual collision. Race surfaces at git push as a normal merge conflict per design M4.                                                                            |
| Storyboard files that already render `### {agent} — {domain}` headings are read by future facilitators expecting the new template.                                                                           | Criterion #8 covers the template only. Existing storyboard archives stay as-is per § Final verification; the next monthly storyboard is the first to follow the new shape.                                                                                                                                                      |
| `libwiki@v*` tag must be cut to publish to npm. `publish-npm.yml` extracts the package name from the git tag — there is no static matrix to extend, but a tag is required before external agents can install. | First `libwiki@v0.1.0` tag is cut as part of `kata-release-cut`'s post-implementation sweep (out of this plan's scope but flagged here so the implementer doesn't expect publishing to happen automatically on merge). `libxmr` already publishes via this mechanism; the same path covers `libwiki` once the package is tagged. |

## Execution

`staff-engineer` runs Steps 1–9 sequentially (each step depends on the
previous step's exports, tests, or migration outputs). `technical-writer`
runs Steps 10–14 — the doc/template/skill sweeps — after Step 9 lands.
Steps 10–14 may run in parallel with each other (no shared file), so
`technical-writer` may dispatch them as one batch. `staff-engineer` runs
Step 15 (catalog refresh + final verification gate) sequentially after
both agents finish.

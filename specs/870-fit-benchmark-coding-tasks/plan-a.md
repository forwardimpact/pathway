# Plan 870-a — fit-benchmark Coding Agent Task Families

## Approach

Build the harness inside `@forwardimpact/libeval` as eleven new modules under
`src/benchmark/` plus a `bin/fit-benchmark.js` entry, in dependency order:
pure-data layers first (`task-family`, `result`, `permissions`,
`apm-installer`), then per-task lifecycle (`workdir`, `scorer`, `judge`),
then the orchestrator (`runner`), then the report path (`report`) and CLI
(`commands/benchmark-{run,score,report}.js` + the bin). Compose libeval's
existing `Supervisor`, `AgentRunner`, and `TraceCollector` — do not fork.
`apm.lock.yaml` is treated as the unit-of-measurement fingerprint (hashed,
not interpreted in v1); the family ships its staged `.claude/` tree, which
`ApmInstaller` copies into `<output>/.apm-staging/.claude/` once per family.
Tests follow the existing `node:test` + `libharness` mock-runner pattern.

Libraries used: `@forwardimpact/libeval` (Supervisor, AgentRunner,
TraceCollector, createTeeWriter, SequenceCounter, composeProfilePrompt),
`@forwardimpact/libcli` (createCli), `@forwardimpact/libtelemetry`
(createLogger), `zod` (schema validator), `node:child_process` (spawn with
fd-3 stdio), `node:fs/promises` (cp, rm, readFile, mkdir).

## Step 1 — Bin + CLI definition

Create the executable and wire its definition. **Created:**
`libraries/libeval/bin/fit-benchmark.js`. **Modified:**
`libraries/libeval/package.json` (add `"fit-benchmark": "./bin/fit-benchmark.js"`
to `bin`, add `"./bin/fit-benchmark.js": "./bin/fit-benchmark.js"` to `exports`,
bump `files` if needed). Mirror `bin/fit-eval.js` shape:
`createCli({ name: "fit-benchmark", commands: [run, score, report], … })`.
Subcommands and options:

| Subcommand | Required options | Optional options |
|---|---|---|
| `run` | `--family`, `--output` | `--runs` (default 1), `--model`, `--agent-profile`, `--supervisor-profile`, `--judge-profile`, `--max-turns` |
| `score` | `--task`, `--workdir` | `--output` (writes one record JSONL line) |
| `report` | `--input` (run-output dir) | `--k` (comma-separated, default `1,3,5`), `--format` (`json` \| `text`) |

Set `documentation: [{ title: "Run a Benchmark", url: "https://www.forwardimpact.team/docs/libraries/prove-changes/run-benchmark/index.md", description: "…" }]`
(matches the skill list created in Step 15). Verify: `bunx fit-benchmark --help`
exits 0 and lists three subcommands.

## Step 2 — TaskFamily + Task loader

**Created:** `libraries/libeval/src/benchmark/task-family.js`. Export
`async loadTaskFamily(rootPathOrGitUrl): Promise<TaskFamily>`. For git URLs,
shallow-clone into a temp dir and capture HEAD SHA → `familyRevision = "git:" + sha`.
For local paths, compute via the algorithm in design § Family revision algorithm
(sorted relpath + sha256 of bytes + final sha256, NFC-normalised paths, LF
separators, exclude `.git/` and `node_modules/`). Walk `tasks/*/` for each
`task_family_name/task_name`; produce `Task` objects with absolute paths to
`instructions.md`, `supervisor.task.md`, `judge.task.md`, `specs/`, `workdir/`,
`scoring/`, parsed `permissions` array (read from a `permissions.txt` or
`task.yaml` — pick `permissions.txt`, one METR token per line, v1 closed set
`{full_internet}`). Read `apm.lock.yaml` bytes and store as `apmLockBytes`.
Verify: unit test loads a fixture family and asserts `familyRevision` is
deterministic across two loads.

## Step 3 — ApmInstaller

**Created:** `libraries/libeval/src/benchmark/apm-installer.js`. Export
`async installApm(family, outputDir): Promise<{ stagingDir, skillSetHash }>`.
Resolve `family.rootPath/apm.lock.yaml` (fall back to `apm.lock.yml` only to
emit a clear error pointing at the libpack convention). Compute
`skillSetHash = "sha256:" + sha256(normaliseLF(apmLockBytes))`. Copy
`<family.rootPath>/.claude/` recursively into
`<outputDir>/.apm-staging/.claude/` via `fs.cp({ recursive: true })`. Throw
if the family has no `.claude/` directory — the family is malformed.
Idempotent: safe to call twice on the same `outputDir` (rm-rf staging dir
first). Verify: unit test asserts hash stability under CRLF flip and
asserts a one-byte mutation flips the hash.

## Step 4 — WorkdirManager + Workdir

**Created:** `libraries/libeval/src/benchmark/workdir.js`. Exports `Workdir`
type and `WorkdirManager` class with:

```js
class WorkdirManager {
  constructor({ stagingDir, runOutputDir, portPool /* default: ephemeral */ });
  async start(task, runIndex): Promise<Workdir>;
  async teardown(workdir): Promise<void>;
}
// Workdir = { cwd, port, pgid, scaffold, agentTracePath, judgeTracePath, preflightError? }
```

`start` (1) creates `<runOutputDir>/runs/<taskFamily>__<taskName>/<runIndex>/cwd/`,
(2) `cp -r task.paths.workdir/* → cwd/` and `cp -r task.paths.specs/* → cwd/specs/`,
(3) copies `<stagingDir>/.claude/` → `<cwd>/.claude/`,
(4) allocates a free TCP port via `net.createServer().listen(0)` →
`server.address().port` → close,
(5) sets `agentTracePath` and `judgeTracePath` siblings of `cwd`,
(6) spawns `task.paths.workdir/scripts/preflight.sh` with `WORKDIR=cwd`,
`PORT=port`, captures `pgid`, exit-zero confirms scaffold; non-zero
populates `preflightError` and returns the handle without throwing (runner
short-circuits to a minimal `ResultRecord`).

`teardown` SIGTERMs the captured `pgid` (`process.kill(-pgid, "SIGTERM")`),
waits 5 s, SIGKILLs survivors, then verifies the port is free (best-effort
`net.connect` probe). Never copies `task.paths.scoring`. Verify: unit test
with a fixture task asserts `scoring/` is absent under `cwd` after `start`,
including a sentinel-filename check; teardown test asserts the port is free
afterward.

## Step 5 — PermissionsBroker

**Created:** `libraries/libeval/src/benchmark/permissions.js`. Export
`brokerPermissions(permissions): { allowedTools, disallowedTools }`. v1
closed set:

| Token | Effect |
|---|---|
| `full_internet` (present) | `allowedTools` includes `WebFetch` |
| `full_internet` (absent) | `disallowedTools` includes `WebFetch` |

Reject any unknown token with a structured error — failing closed prevents
silent permission drift. Default `allowedTools` is the AgentRunner default
set (`["Bash", "Read", "Glob", "Grep", "Write", "Edit"]`); the broker
returns deltas. Verify: unit test for both permission states and the
unknown-token rejection.

## Step 6 — Scorer

**Created:** `libraries/libeval/src/benchmark/scorer.js`. Export
`async runScoring(task, workdir): Promise<{ verdict, details, exitCode }>`.
Spawn `<task.paths.scoring>/run.sh` (the **template** path, never copied to
`workdir.cwd`) with `child_process.spawn` and
`stdio: ["inherit", "pipe", "pipe", "pipe"]`. Set env: `WORKDIR =
workdir.cwd`, `PORT = workdir.port`, `RESULTS_FD = "3"`. Drain fd 3 line by
line, JSON-parse each into `{ test, pass, message? }`, accumulate into
`details[]`; lines that fail to parse populate `details` with
`{ raw, parseError: true }` (diagnostic-only, does not fail scoring).
Capture stderr to a sibling `scoring.stderr.log` for debugging. Wait for
exit; `verdict = exitCode === 0 ? "pass" : "fail"`. Exit code is
authoritative — fd-3 NDJSON cannot override it (design decision 12).
Verify: unit test with a stub `run.sh` exercises both verdicts and asserts
`details` rows survive a malformed line.

## Step 7 — Judge

**Created:** `libraries/libeval/src/benchmark/judge.js`. Export
`async runJudge(task, workdir, scoring, deps): Promise<{ verdict, summary }>`.
Build a libeval `Supervisor` via `createSupervisor({ supervisorCwd:
workdir.cwd, agentCwd: workdir.cwd, query: deps.query, output: deps.output,
model: deps.model, supervisorProfile: deps.judgeProfile, … })`. Supervisor
task = `readFile(task.paths.judge)`; agent task = a templated string
including `SCORING_PATH=<path-to-scoring-json>` and
`AGENT_TRACE_PATH=workdir.agentTracePath` (also exported as env on the
agent's CWD). Pipe NDJSON output through a fresh `TraceCollector` → tee to
`workdir.judgeTracePath`. After `supervisor.run(task)` resolves, inspect
the orchestration context (`ctx.verdict` / `ctx.summary` from the
`Conclude` handler at `orchestration-toolkit.js:224`). Map verdict:
`"success"` → `"pass"`, `"failure"` → `"fail"`. If supervisor never
called `Conclude`, return `{ verdict: "fail", summary: "judge did not conclude" }`.
Verify: unit test with a `createMockRunner` supervisor that calls
`Conclude("success", "ok")` asserts verdict mapping; second test for the
no-conclude path.

## Step 8 — ResultRecord schema + validator

**Created:** `libraries/libeval/src/benchmark/result.js`. Define a `zod`
schema matching design § Result-record schema verbatim — every field, every
type, every enum. Export `validateResultRecord(record): void` (throws
`ZodError` rendered as a structured error) and `RESULT_RECORD_SCHEMA` (the
zod object) for testing. The `verdict` field is computed (not stored)
upstream as `scoring.verdict === "pass" && judgeVerdict.verdict === "pass" ? "pass" : "fail"`.
The `preflightError?` branch makes `scoring`, `judgeVerdict`, `submission`,
`agentTracePath`, `judgeTracePath` optional via a discriminated union.
Verify: unit test feeds a minimal happy-path record, a minimal preflight-
failure record, and a malformed record; first two pass, third throws.

## Step 9 — BenchmarkRunner

**Created:** `libraries/libeval/src/benchmark/runner.js`. Export
`BenchmarkRunner` class:

```js
class BenchmarkRunner {
  constructor({ family, runs, output, model, profiles, query, maxTurns });
  async *run(): AsyncIterable<ResultRecord>;
}
```

`run()` flow:

1. `family = await loadTaskFamily(opts.family)`.
2. `{ stagingDir, skillSetHash } = await installApm(family, opts.output)`.
3. Pre-flight gate: for every task, assert
   `task.paths.workdir/scripts/preflight.sh` exists and is executable
   (`fs.access(path, X_OK)`); fail the family before any agent session.
4. For each `(task, runIndex)` in serial:
   a. `workdir = await wm.start(task, runIndex)`.
   b. If `workdir.preflightError`, write a minimal failure record and
      `continue` (no agent cost).
   c. `{ allowedTools, disallowedTools } = brokerPermissions(task.permissions)`.
   d. Build agent-under-test session: `createSupervisor({ supervisorCwd:
      workdir.cwd, agentCwd: workdir.cwd, supervisorProfile:
      profiles.supervisor, agentProfile: profiles.agent, allowedTools,
      supervisorDisallowedTools: disallowedTools, … })`. Tee NDJSON to
      `workdir.agentTracePath`. Read supervisor task from
      `task.paths.supervisor`; read agent task from `task.paths.instructions`.
      Capture `costUsd`, `turns`, `submission` (last assistant text block
      from the trace before any orchestration tool call — extracted via
      `TraceCollector.toJSON()` → walk turns).
   e. `scoring = await runScoring(task, workdir)`.
   f. `judgeVerdict = await runJudge(task, workdir, scoring, deps)`.
   g. Compose `ResultRecord`; `validateResultRecord(record)`; append one
      JSONL line to `<opts.output>/results.jsonl` via fs append (open
      file once per run, mode `a`); `yield record`.
   h. `await wm.teardown(workdir)`.
5. Close the JSONL stream.

`familyRevision`, `skillSetHash`, `permissions`, `model`, `profiles` are
copied onto every record. `durationMs` measured per task. Verify: covered
by E2E test (Step 14).

## Step 10 — ReportAggregator

**Created:** `libraries/libeval/src/benchmark/report.js`. Export
`async aggregate({ inputDir, kValues }): Promise<Report>`. Read
`<inputDir>/results.jsonl` line by line, `validateResultRecord` each (skip
malformed with structured warning to stderr), group by `taskId`. For each
task, compute pass@k = `1 - C(n-c, k) / C(n, k)` using BigInt-based binomial
to avoid float drift on `n > 50`; emit `NaN`-equivalent error if `k > n`.
Output shape: `{ tasks: [{ taskId, n, c, passAtK: { 1: 0.4, 3: 0.9 } }],
totals }`. Render to text as a markdown table when `--format=text`. Verify:
unit test on the spec's fixture (n=5, verdicts `pass/fail/fail/pass/fail`)
produces `pass@1 = 0.4` and `pass@3 = 0.9`.

## Step 11 — Subcommand handlers

**Created:** `libraries/libeval/src/commands/benchmark-run.js`,
`benchmark-score.js`, `benchmark-report.js`. Each follows the
`commands/run.js` shape: parse options, `resolve()` paths, build the
runtime helper (BenchmarkRunner / Scorer / ReportAggregator), invoke,
write output, exit `0` / `1` per the spec criteria. `benchmark-run`
streams `ResultRecord`s as they yield (one JSON line to stdout per
record); the JSONL file is the durable copy. Verify: covered by Step 14.

## Step 12 — Wire bin into package metadata + codegen

**Modified:** `libraries/libeval/package.json` — add `bin` entry + `exports`
(see Step 1). Run `bun run context:fix` from repo root to regenerate
[libraries/README.md](libraries/README.md) catalog. Verify: `git diff`
shows the regenerated catalog row; `bunx fit-benchmark --version` works
from a fresh install.

## Step 13 — Unit tests

**Created** under `libraries/libeval/test/`: `benchmark-task-family.test.js`,
`benchmark-apm-installer.test.js`, `benchmark-workdir.test.js`,
`benchmark-permissions.test.js`, `benchmark-scorer.test.js`,
`benchmark-judge.test.js`, `benchmark-result.test.js`,
`benchmark-report.test.js`. Use `node:test` + `@forwardimpact/libharness`
helpers (`createMockRunner`, `createMockAgentQuery`, `createToolUseMsg`,
`stripAnsi`). One fixture family lives at
`libraries/libeval/test/fixtures/benchmark-family/` with two tasks
(`tf/pass`, `tf/fail`), `apm.lock.yaml`, pre-staged `.claude/`,
`workdir/scripts/preflight.sh`, `scoring/run.sh`. Verify: `bun test
test/benchmark-*.test.js` from the libeval directory passes.

## Step 14 — E2E fixture test

**Created:** `libraries/libeval/test/benchmark-e2e.test.js`. Drives the
runner end-to-end against the fixture family with `runs=2`, asserting
the spec's success criteria observable from a single test run:

| Assertion | Spec criterion |
|---|---|
| 4 records in `results.jsonl`, all schema-valid, distinct `(taskId, runIndex)` | criterion 1 |
| Sentinel filename inside `tf/pass/scoring/` is unreadable from `cwd`; trace lines never contain it | criterion 2 |
| `tf/preflight-broken/` family fails install before agent spawn; record `costUsd === 0` | criterion 9 |
| `WebFetch` allowed under `full_internet`, denied otherwise (assert via tool-list snapshot, not real network) | criterion 7 |
| Report tooling produces `pass@1 = 0.4` on five-run fixture | criterion 11 |
| `fit-trace overview` accepts the produced trace | criterion 13 |

Mock the agent via `createMockRunner` so the E2E test runs without API
calls. Verify: `bun test test/benchmark-e2e.test.js` passes locally.

## Step 15 — Skill + guide + parity

**Created:**
- `.claude/skills/fit-benchmark/SKILL.md` — model on
  `.claude/skills/fit-eval/SKILL.md`. `## Documentation` lists exactly one
  entry: `- [Run a Benchmark](https://www.forwardimpact.team/docs/libraries/prove-changes/run-benchmark/index.md)`.
- `.claude/skills/fit-benchmark/references/cli.md` — full flag surface.
- `websites/fit/docs/libraries/prove-changes/run-benchmark/index.md` —
  Big Hire / Little Hire framing, walkthrough mirroring run-eval/index.md,
  authoring a task family, reading the report.

**Modified:** `libraries/libeval/bin/fit-benchmark.js` — confirm the
`documentation` array entry matches the skill's `## Documentation` list
exactly (title + URL identical, single entry, same order). Verify:
`grep -c run-benchmark` in both files matches; `bun run check` passes.

## Step 16 — Quality gates

Run from repo root: `just quickstart` (or `bun run check`, `bun run
format:fix`, `bun run context:fix`). Verify: green CI on the plan PR's
follow-up implementation PR.

## Risks

1. **`submission` extraction is fragile.** Pulling the agent's last
   assistant text "before any orchestration tool call" depends on
   `TraceCollector.toJSON()` turn ordering; if the agent emits text
   *after* a tool call, the heuristic skips real output. Mitigation:
   the implementer must add a unit test on a trace fixture that contains
   trailing text after a tool call, and decide the policy explicitly
   (last text block, or last text block before `Conclude`) — the design
   does not pin this, and panel review should confirm.
2. **`apm.lock.yaml` interpretation.** The design says "reads
   `apm.yaml`/`apm.lock.yaml` … materialises declared skills/agents,"
   but libpack's lockfile records `deployed_files` only — there is no
   internal "install from lockfile" path today. v1 plan: ApmInstaller
   trusts that the family ships a pre-staged `.claude/` and treats the
   lockfile as a fingerprint. If reviewers reject this v1 simplification,
   the alternative is wiring libpack's pack-fetching primitives, which
   expands scope.
3. **Process-group teardown on macOS vs Linux.** `process.kill(-pgid,
   sig)` requires the spawned shell to have called `setsid`/`setpgid`.
   `child_process.spawn({ detached: true })` triggers this on POSIX, but
   the `inherit`/`pipe` stdio mix interacts subtly with `detached`.
   Mitigation: integration test on both runners' OS matrices in CI.
4. **`scoring/run.sh` fd 3 portability.** Bash, dash, and zsh all support
   `>&3`, but if a family ships a Python or Node `run.sh` shebang, the
   author must open fd 3 explicitly. Document this in the guide.
5. **`net.createServer().listen(0)` race.** The free-port probe closes
   the socket before the agent binds, so another process can claim the
   port between probe and agent start. v1 accepts this — pre-flight
   would catch the conflict — but flakiness will surface on busy CI.

## Execution recommendation

Single executor, sequential. Steps 1–12 must run in dependency order;
Steps 13 and 14 can interleave with Step 11 once Step 8 (validator) lands.
Step 15 can start as soon as Step 1's CLI surface is locked — route to
`technical-writer` agent if available, else continue with the engineering
agent. Step 16 closes out. No part is large enough to justify
decomposition; one engineering sub-agent owns the full plan from a single
execution session.

— Staff Engineer 🛠️

# Plan 530 — Agent Profile Main-Thread Binding

## Approach

Introduce a pure `composeProfilePrompt` module inside libeval, then thread it
through the three command call sites (`run`, `supervise`, `facilitate`) and the
two orchestration factories (`supervisor.js`, `facilitator.js`). `AgentRunner`
loses its `agentProfile` field and the SDK `options.agent` spread. The CLI
flags keep their surface at the boundary but internally feed
`composeProfilePrompt` — nothing else. Mode-specific trailers
(`AGENT_SYSTEM_PROMPT`, `FACILITATED_AGENT_SYSTEM_PROMPT`,
`FACILITATOR_SYSTEM_PROMPT`, `SUPERVISOR_SYSTEM_PROMPT`) move from the
`append` slot into the composer's `trailer` option so today's working
behaviour in facilitated/supervised modes is preserved bit-for-bit.

## Ordered Steps

### Step 1 — New module `src/profile-prompt.js` + unit tests

**Create** `/home/user/monorepo/libraries/libeval/src/profile-prompt.js`
exporting one function:

```
composeProfilePrompt(name, { profilesDir, trailer })
  → { type: "preset", preset: "claude_code", append: string }
```

Behaviour:

- Reads `${profilesDir}/${name}.md` with `readFileSync(path, "utf8")`. Missing
  file propagates `ENOENT` unchanged (first safety net).
- Strips YAML frontmatter. Recognise the fence pattern: file begins with
  `---\n`, a second `\n---\n` terminates it. If the file lacks frontmatter,
  the entire body is used.
- `append` = body (trimmed of leading/trailing whitespace) + `"\n\n"` +
  `trailer` when trailer is a non-empty string; otherwise just the body.
- No fallback, no default profile, no catch-around-read.

**Export** from `/home/user/monorepo/libraries/libeval/src/index.js` alongside
`createAgentRunner` so callers outside libeval could depend on it (consistency
with existing public surface).

**Create** `/home/user/monorepo/libraries/libeval/test/profile-prompt.test.js`.
Fixtures live alongside in `test/fixtures/profile-prompt/` — one with
frontmatter, one without. Tests:

- Returns the `{ type: "preset", preset: "claude_code", append }` shape.
- Strips frontmatter (the `append` does not contain `---` or YAML keys from
  the fence).
- Concatenates trailer with blank-line separator when provided; no trailing
  whitespace mismatch when omitted.
- Throws `ENOENT` for a missing profile file.
- **Spec SC#1 coverage (loop test):** `readdirSync(".claude/agents")`, filter
  `*.md`, for each file assert
  `composeProfilePrompt(basename, { profilesDir: ".claude/agents" }).append`
  contains a non-trivial substring of the real profile body (e.g. first 40
  chars of the file past frontmatter). This walks every live profile and
  fails the build if any profile stops being loadable.

### Step 2 — `AgentRunner` cleanup (`src/agent-runner.js`)

Depends on: nothing (structural).

- Remove `agentProfile: deps.agentProfile ?? null` from `applyDefaults`.
- Remove the `@param {string} [deps.agentProfile]` JSDoc line.
- In `run()`, remove the line
  `...(this.agentProfile && { agent: this.agentProfile }),`.
- `resume()` never set `agent`; no change there.

After this, `AgentRunner` has no filesystem or profile concerns. The only way
profile content enters the SDK is via the caller-provided `systemPrompt`.

### Step 3 — Wire `commands/run.js` through the composer

Depends on: Step 1.

Before (line 79–90):

```
const { query } = await import("@anthropic-ai/claude-agent-sdk");
const runner = createAgentRunner({
  cwd, query, output: devNull, model, maxTurns, allowedTools,
  onLine, settingSources: ["project"],
  agentProfile,
});
```

After:

```
import { composeProfilePrompt } from "../profile-prompt.js";
...
const systemPrompt = agentProfile
  ? composeProfilePrompt(agentProfile, { profilesDir: resolve(cwd, ".claude/agents") })
  : undefined;
const { query } = await import("@anthropic-ai/claude-agent-sdk");
const runner = createAgentRunner({
  cwd, query, output: devNull, model, maxTurns, allowedTools,
  onLine, settingSources: ["project"],
  systemPrompt,
});
```

The `agentProfile` local stays (read from `--agent-profile`); it feeds the
composer and nothing else. `parseRunOptions` is unchanged.

### Step 4 — Wire `supervisor.js` through the composer

Depends on: Step 1, Step 2.

At the supervisor factory (~L390–443):

- Remove `agentProfile` and `supervisorProfile` from the `createAgentRunner`
  argument objects.
- Replace the agent runner's `systemPrompt: { type: "preset", preset:
  "claude_code", append: AGENT_SYSTEM_PROMPT }` with
  ```
  systemPrompt: agentProfile
    ? composeProfilePrompt(agentProfile, { profilesDir, trailer: AGENT_SYSTEM_PROMPT })
    : { type: "preset", preset: "claude_code", append: AGENT_SYSTEM_PROMPT },
  ```
- Same shape for the supervisor runner using `supervisorProfile` and
  `SUPERVISOR_SYSTEM_PROMPT` as trailer.
- Add `profilesDir` to the factory's dep signature with default
  `resolve(agentCwd, ".claude/agents")`; accept an override from callers for
  test injection symmetry.
- Import `composeProfilePrompt` from `./profile-prompt.js`.

The `AGENT_SYSTEM_PROMPT` / `SUPERVISOR_SYSTEM_PROMPT` exports stay — they
are consumed here as trailers, not as standalone `append` values. The JSDoc
on `createSupervisor`'s `agentProfile` / `supervisorProfile` params is
updated to say "resolved into the main-thread system prompt via
`composeProfilePrompt`" rather than "passed to Claude as `--agent`".

### Step 5 — Wire `facilitator.js` through the composer

Depends on: Step 1, Step 2.

At the facilitator factory (~L440–500):

- For each agent runner in the `agents.map(...)` block: remove
  `agentProfile: config.agentProfile`; replace the static `systemPrompt`
  with `composeProfilePrompt(config.agentProfile, { profilesDir, trailer:
  FACILITATED_AGENT_SYSTEM_PROMPT })` when `config.agentProfile` is set,
  otherwise keep today's plain-trailer shape.
- Facilitator runner: same replacement with `facilitatorProfile` and
  `FACILITATOR_SYSTEM_PROMPT` as trailer.
- Accept a `profilesDir` dep with the same default pattern as Step 4.

### Step 6 — CLI flag audit (`bin/fit-eval.js`, `commands/*.js`)

Depends on: Steps 3–5.

Verify — and document in the commit message — that:

- `bin/fit-eval.js` still exposes `--agent-profile`, `--supervisor-profile`,
  `--facilitator-profile`, `--agent-profiles` (unchanged — that is the CLI
  boundary per the design).
- No command file passes `options.agent` or the SDK's top-level `agent`
  option into `createAgentRunner`. The `agentProfile` locals in `run.js`,
  `supervise.js`, and `facilitate.js` feed only `composeProfilePrompt`.
- `commands/supervise.js` `opts.agentProfile` and `opts.supervisorProfile`
  feed the supervisor factory's new signature unchanged at the CLI layer.

No code change expected in this step beyond whatever minor rewiring Steps
3–5 already required in the command files; this step is a grep-and-read
confirmation.

### Step 7 — Grep verification for Spec SC#2

Depends on: Steps 2–6.

Run these greps and confirm zero matches inside `libraries/libeval/src/`
and `libraries/libeval/bin/`:

```
rg -n "\bagent:\s*[A-Za-z]" libraries/libeval/src libraries/libeval/bin
rg -n "agentProfile" libraries/libeval/src libraries/libeval/bin
rg -n "\"--agent\"" libraries/libeval/src libraries/libeval/bin
```

Tests and fixtures may still reference the old shape when stubbing
historical SDK options — those matches are acceptable. Record the greps in
the final commit body so the reviewer can replay them.

## Files touched

- **Created:** `libraries/libeval/src/profile-prompt.js`,
  `libraries/libeval/test/profile-prompt.test.js`,
  `libraries/libeval/test/fixtures/profile-prompt/*`.
- **Modified:** `libraries/libeval/src/agent-runner.js`,
  `libraries/libeval/src/commands/run.js`,
  `libraries/libeval/src/commands/supervise.js` (signature pass-through only),
  `libraries/libeval/src/commands/facilitate.js` (signature pass-through only),
  `libraries/libeval/src/supervisor.js`,
  `libraries/libeval/src/facilitator.js`,
  `libraries/libeval/src/index.js` (export).
- **Deleted:** none.

## Test additions

- `test/profile-prompt.test.js` — unit tests for the composer, including the
  SC#1 loop over `.claude/agents/*.md`.
- Existing tests that stub `AgentRunner` with `agentProfile` (likely in
  `test/agent-runner.test.js`, `test/supervisor-*.test.js`,
  `test/facilitator*.test.js`, `test/mock-runner.js`) must be updated to stop
  passing `agentProfile` and either pass a precomposed `systemPrompt` or
  leave `systemPrompt` unset. Inventory these at implementation time with
  `rg agentProfile libraries/libeval/test/`.

## Libraries used

None. `composeProfilePrompt` uses only `node:fs` (`readFileSync`) and
`node:path` (`join`). No `@forwardimpact/lib*` package is consumed. This is
intentional — the composer stays a ~30-line pure function so tests can
exercise it without DI scaffolding.

## Risks

- **SDK preset-composition semantics.** The design asserts that
  `{ type: "preset", preset: "claude_code", append: body + trailer }`
  composes profile + mode-boilerplate correctly at runtime. This holds in
  today's facilitated and supervised runs (Evidence table, spec.md) but is
  not directly unit-testable without a live SDK call. SC#3 is the
  end-to-end verifier — first night-shift run after merge either emits
  voice markers or does not.
- **Test stubs for `AgentRunner`.** Existing tests pass `agentProfile` into
  the constructor. They will keep passing silently because
  `applyDefaults` previously accepted the field, but after Step 2 any test
  that asserts `options.agent` was forwarded into the SDK query will fail.
  Step 2 includes an inventory pass to update them.
- **Non-main-thread uses of `options.agent`.** Subagent dispatch via the
  `Task`/`Agent` tool is out of scope (spec § Excluded), but a stray
  `options.agent` inside supervisor/facilitator code paths that is _not_
  main-thread-binding-related would also be removed by Step 2. The greps
  in Step 7 flag any such leak for conscious decision at implementation
  time.
- **Profile directory location.** The composer takes `profilesDir` as an
  input and defaults to `<cwd>/.claude/agents` at each call site. A run
  whose `cwd` is not the monorepo root (test harness, custom invocation)
  will receive an `ENOENT` — surfaced exactly as the spec's first safety
  net requires.

## Execution recommendation

Single `staff-engineer` run on branch `feat/530-agent-profile-main-thread-binding`.
Do not decompose. The change is tightly coupled (one module + five wiring
sites + test updates) and the whole diff must land together so greps pass.
Steps 1 and 2 are independent; Steps 3–5 depend on both; Steps 6–7 are the
tail audit. Implementer runs `bun run check` and `bun run test` after each
wiring step and once at the end.

SC#3 (voice-marker appearance in scheduled runs) is end-to-end and observed
after the fix lands in `main`. Note it in the implementation PR body as a
post-merge verification step against the next night-shift traces; do not
block PR merge on it.

## Self-review

Ran the DO-CONFIRM checklist:

- [x] Approach and rationale stated up front.
- [x] Changes concrete — file paths, function names, before/after snippets.
- [x] Blast radius visible — "Files touched" lists created/modified/deleted.
- [x] Ordering explicit with stated dependencies on each step.
- [x] Non-obvious decisions explained (trailer semantics, no libs, why
      single-agent).
- [x] Risks surfaced — SDK composition, test stubs, stray `options.agent`,
      profileDir location.
- [x] Libraries-used section present — states "None" explicitly with
      rationale.
- [x] Execution recommendation present — single agent, no decomposition,
      SC#3 deferred.

**Self-caught findings:**

- None material. One caveat: the test in Step 1 for SC#1 asserts the
  presence of a body substring, not a voice marker. Voice markers (the
  em-dash-plus-emoji trailers in each profile) live in the body and would
  be a tighter assertion, but the profile files do not share a common
  marker shape, so per-profile substrings are the durable choice. The
  alternative — a per-profile hardcoded list of expected markers —
  duplicates knowledge already in the `.md` files and would drift. Flag
  this trade-off to the implementer; they may tighten the assertion if a
  stable per-profile signature emerges.

— Staff Engineer 🛠️

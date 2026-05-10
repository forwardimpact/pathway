# Plan 850-a — libeval Trace Artifact Secret Redaction

Implements [spec.md](spec.md) under the architecture in [design-a.md](design-a.md).

## Approach

Land the producer-side `Redactor` bottom-up so each layer is independently
testable: ship `redaction.js` + its unit tests first, wire it through
`AgentRunner` (required constructor dep, redact at `#recordLine`), then
`Supervisor` and `Facilitator` (constructor dep + redact in each `emit*`),
then the three command entrypoints (build the redactor as the first
post-parse side-effect; also redact the `commands/run.js` outer envelope
for defence-in-depth), then update existing tests to pass
`createNoopRedactor()` and add a producer-side integration test, then docs.
The constructor-required design choice means every existing producer call
site — factories, command entry, and direct `new` in tests — has to be
updated in lock-step in steps 2–5; the test sweep in step 6 is mechanical
once those four steps land.

Libraries used: none. `redaction.js` is plain JS over Node built-ins; allowlist + regex composition only.

## Steps

### 1. `redaction.js` module + unit tests

- **Created:** `libraries/libeval/src/redaction.js`

```js
/**
 * Redactor — replaces secrets in JSON-serialisable values before they reach
 * the trace artifact. Composes two layers: an env-var value allowlist and a
 * set of credential-shape regexes. Both run on every primitive string.
 *
 * Stateless after construction: `env` is captured once so in-process
 * `process.env` writes (e.g. agent-runner.js LIBEVAL_SKILL, commands/run.js
 * LIBEVAL_AGENT_PROFILE) cannot smuggle a value past the redactor.
 */

export const DEFAULT_ENV_ALLOWLIST = Object.freeze([
  "ANTHROPIC_API_KEY",
  "GH_TOKEN",
  "GITHUB_TOKEN",
]);

// Anchored prefixes per
// https://github.blog/security/application-security/behind-githubs-new-authentication-token-formats/
// Anthropic prefix is heuristic — the env-allowlist layer is the primary
// defence for Anthropic keys.
export const DEFAULT_PATTERNS = Object.freeze([
  { kind: "anthropic", regex: /sk-ant-[A-Za-z0-9_-]{80,}/g },
  { kind: "gh-pat", regex: /\bghp_[A-Za-z0-9]{36}\b/g },
  { kind: "gh-installation", regex: /\bghs_[A-Za-z0-9]{36}\b/g },
  { kind: "gh-oauth", regex: /\bgho_[A-Za-z0-9]{36}\b/g },
  { kind: "gh-fine-grained", regex: /\bgithub_pat_[A-Za-z0-9_]{82}\b/g },
]);

const ENV_PLACEHOLDER = (name) => `[REDACTED:env:${name}]`;
const PATTERN_PLACEHOLDER = (kind) => `[REDACTED:pattern:${kind}]`;

/**
 * Build a frozen { name → value } snapshot of the requested env vars.
 * Empty strings are skipped — a leaked empty env var would otherwise
 * cause every empty string in the trace to be replaced.
 */
function snapshotEnv(env, allowlist) {
  const snap = {};
  for (const name of allowlist) {
    const v = env[name];
    if (typeof v === "string" && v.length > 0) snap[name] = v;
  }
  return Object.freeze(snap);
}

/** Recursively walk and redact a JSON-serialisable value in place-free style. */
function walk(value, redactString) {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((v) => walk(v, redactString));
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) out[k] = walk(value[k], redactString);
    return out;
  }
  return value;
}

export class Redactor {
  constructor({ envSnapshot, patterns, enabled }) {
    this.envSnapshot = envSnapshot;
    this.patterns = patterns;
    this.enabled = enabled;
  }

  redactValue(value) {
    if (!this.enabled) return value;
    return walk(value, (s) => this.#redactString(s));
  }

  #redactString(s) {
    let out = s;
    for (const [name, secret] of Object.entries(this.envSnapshot)) {
      if (out.includes(secret)) {
        out = out.split(secret).join(ENV_PLACEHOLDER(name));
      }
    }
    for (const { kind, regex } of this.patterns) {
      out = out.replace(regex, PATTERN_PLACEHOLDER(kind));
    }
    return out;
  }
}

export function createRedactor({
  env = process.env,
  allowlist,
  patterns = DEFAULT_PATTERNS,
  enabled = true,
} = {}) {
  const resolvedAllowlist = allowlist ?? resolveAllowlistFromEnv(env);
  const envSnapshot = enabled
    ? snapshotEnv(env, resolvedAllowlist)
    : Object.freeze({});
  if (!enabled) {
    process.stderr.write(
      "libeval: trace redaction DISABLED via LIBEVAL_REDACTION_DISABLED — secrets may appear in trace artifact\n",
    );
  }
  return new Redactor({ envSnapshot, patterns, enabled });
}

function resolveAllowlistFromEnv(env) {
  const override = env.LIBEVAL_REDACTION_ENV_VARS;
  if (typeof override !== "string" || override.length === 0) {
    return DEFAULT_ENV_ALLOWLIST;
  }
  return override
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function createNoopRedactor() {
  return new Redactor({
    envSnapshot: Object.freeze({}),
    patterns: [],
    enabled: false,
  });
}
```

- **Created:** `libraries/libeval/test/redaction.test.js` — covers spec
  criteria 1–3 in isolation:

| Case | Asserts |
| --- | --- |
| Default allowlist replaces each sentinel with `[REDACTED:env:NAME]` across a deep-walked fixture (string, array, nested object, mixed primitives) covering `tool_use.input.*`, `tool_result.content`, assistant `text`, orchestrator `summary`, system payloads | criterion 1 |
| Each pattern at canonical length yields `[REDACTED:pattern:KIND]` with no env vars set; covers all five `DEFAULT_PATTERNS` plus an Anthropic key embedded inside `tool_result.content` JSON | criterion 2 |
| Benign fixtures pass through identically: prose, Markdown, URLs, full-length git SHAs (40 hex), UUIDs, `ghp_` prefix at <36 chars, quoted shell commands | criterion 3 |
| `LIBEVAL_REDACTION_ENV_VARS=FOO,BAR` replaces (not extends) the allowlist; default names not redacted | design § Default env-var allowlist |
| `enabled: false` returns inputs unchanged with no walk allocation (assert reference equality on the input object); construction emits the stderr warning exactly once | design § Opt-out surface |
| Empty-string env values do not poison redaction (`FOO=""` does not turn every `""` in the input into a placeholder) | snapshotEnv guard |
| Sentinels with JSON-special chars (`"`, `\`, control chars) are excluded from sentinel fixtures via a guard helper that throws if a test seeds one — locks the design's "JSON-stable strings" rule into the test layer | design § Test surfaces |
| `createNoopRedactor()` ≡ `createRedactor({ enabled: false })` semantically (both leave inputs unchanged) | design § Interfaces |

Verify: `bun test libraries/libeval/test/redaction.test.js` green.

### 2. `AgentRunner` constructor + `#recordLine`

- **Modified:** `libraries/libeval/src/agent-runner.js`

Constructor (required dep — fail loud if a caller forgets it):

```js
// before (line 53–62)
constructor(deps) {
  if (!deps.cwd) throw new Error("cwd is required");
  if (!deps.query) throw new Error("query is required");
  if (!deps.output) throw new Error("output is required");
  Object.assign(this, applyDefaults(deps));
  // ...
}

// after
constructor(deps) {
  if (!deps.cwd) throw new Error("cwd is required");
  if (!deps.query) throw new Error("query is required");
  if (!deps.output) throw new Error("output is required");
  if (!deps.redactor) throw new Error("redactor is required");
  Object.assign(this, applyDefaults(deps));
  this.redactor = deps.redactor;
  // ...
}
```

`#recordLine` redacts the SDK message **before** `JSON.stringify`, per design
decision 6 (walk-then-serialise):

```js
// before (line 205–210)
#recordLine(message, state) {
  const line = JSON.stringify(message);
  this.output.write(line + "\n");
  this.buffer.push(line);
  if (this.onLine) this.onLine(line);
  if (this.onBatch) state.pendingBatch.push(line);
  // ... session-id / text-block tracking
}

// after
#recordLine(message, state) {
  const redacted = this.redactor.redactValue(message);
  const line = JSON.stringify(redacted);
  this.output.write(line + "\n");
  this.buffer.push(line);
  if (this.onLine) this.onLine(line);
  if (this.onBatch) state.pendingBatch.push(line);
  // session-id / text-block tracking still reads the ORIGINAL `message` —
  // session_id, message.subtype, and tool_use block.name/.input.skill are
  // not secret carriers, and reading from the redacted shape would be a
  // gratuitous semantic shift if a future allowlist entry happens to match
  // a session id.
  if (message.type === "system" && message.subtype === "init") {
    this.sessionId = message.session_id;
  }
  if (message.type === "assistant") {
    if (hasTextBlock(message)) state.assistantTextCount++;
    trackSkillInvocation(message);
  }
}
```

Verify: existing `agent-runner.test.js` and `agent-runner-batching.test.js`
fail until step 6 updates them; that is the mechanical lock-step. Add one
new constructor test in this step:

```js
test("constructor throws on missing redactor", () => {
  assert.throws(
    () => new AgentRunner({ cwd: "/tmp", query: async function*(){}, output: new PassThrough() }),
    /redactor is required/,
  );
});
```

Run `bun test libraries/libeval/test/agent-runner.test.js -t "throws on missing redactor"`.

### 3. `Supervisor` constructor + `emit*` seams + factory

- **Modified:** `libraries/libeval/src/supervisor.js`

Constructor:

```js
// before (constructor signature, line 69–95)
constructor({ agentRunner, supervisorRunner, output, maxTurns, ctx, messageBus, taskAmend }) {
  if (!agentRunner) throw new Error("agentRunner is required");
  if (!supervisorRunner) throw new Error("supervisorRunner is required");
  if (!output) throw new Error("output is required");
  // ...
}

// after
constructor({ agentRunner, supervisorRunner, output, maxTurns, ctx, messageBus, taskAmend, redactor }) {
  if (!agentRunner) throw new Error("agentRunner is required");
  if (!supervisorRunner) throw new Error("supervisorRunner is required");
  if (!output) throw new Error("output is required");
  if (!redactor) throw new Error("redactor is required");
  this.redactor = redactor;
  // ...
}
```

Each `emit*` method redacts its constructed event object **before**
`JSON.stringify` and `output.write`. The pattern is the same in all three;
shown for `emitLine`:

```js
// before (line 402–410)
emitLine(line) {
  const event = JSON.parse(line);
  const tagged = { source: this.currentSource, seq: this.counter.next(), event };
  this.output.write(JSON.stringify(tagged) + "\n");
}

// after
emitLine(line) {
  const event = JSON.parse(line);
  const tagged = { source: this.currentSource, seq: this.counter.next(), event };
  this.output.write(JSON.stringify(this.redactor.redactValue(tagged)) + "\n");
}
```

Apply the same `this.redactor.redactValue(...)` wrap inside `emitOrchestratorEvent`
(line 430) and `emitSummary` (line 444). The `event` field inside `emitLine`
has *already* been redacted by `AgentRunner.#recordLine` (the bytes the
runner wrote to `devNull` — and pushed to `runner.buffer` — are pre-redacted),
so the inner walk is a no-op on those carriers; the outer redact catches the
`{source, seq}` envelope and any future field added to it. `emitSummary` is
the highest-risk seam — `result.summary` originates as untrusted text from
the `Conclude` MCP handler and never traverses `#recordLine`.

Factory `createSupervisor` (line 486–579): build `agentRunner` and
`supervisorRunner` with the same `redactor` instance the caller passed in,
and forward it to the `new Supervisor({...})` call:

```js
// before (line 530–541)
const agentRunner = createAgentRunner({ cwd: agentCwd, query, output: devNull, /* ... */ });

// after
const agentRunner = createAgentRunner({ cwd: agentCwd, query, output: devNull, redactor, /* ... */ });
```

Add `redactor` to the `createSupervisor({...})` JSDoc-typed parameter list and
to the `new Supervisor({...})` call near the bottom (line 569). The factory
signature gains `redactor` as a **required** parameter (throw at the top of
the function if missing) — matching the constructor contract one level down
so the failure surfaces at the entry point rather than inside the runner.

Verify: `bun test libraries/libeval/test/supervisor-factory.test.js` —
expect failures in tests that build the factory without `redactor`; step 6
updates them. Add one factory-throws test in this step:

```js
test("createSupervisor throws on missing redactor", () => {
  assert.throws(
    () => createSupervisor({ ...baseOpts() /* no redactor */ }),
    /redactor is required/,
  );
});
```

`baseOpts()` (the existing test helper) gains a `redactor: createNoopRedactor()`
field for every other test in the same file.

### 4. `Facilitator` constructor + `emit*` seams + factory

- **Modified:** `libraries/libeval/src/facilitator.js`

Mirrors step 3. Constructor (line 53–80) gains `redactor` as required and
stores `this.redactor`. Each of `emitLine` (line 327), `emitOrchestratorEvent`
(line 341), and `emitSummary` (line 354) redacts the constructed event
object before `JSON.stringify`. Factory `createFacilitator` (line 391–480)
gains `redactor` as a required parameter, propagates it into every
`createAgentRunner` call (lines 438 and 454), and forwards it to the
`new Facilitator({...})` call (line 469).

`emitLine` in the facilitator takes `(source, line)` — the same redact-
the-tagged-object pattern applies; the source string is never a secret
carrier but stays inside the walked object for symmetry.

Verify: `bun test libraries/libeval/test/facilitator.test.js` and
`facilitator-redirect.test.js` — same lock-step failure pattern as step 3.
Add `createFacilitator throws on missing redactor` test mirroring step 3.

### 5. Command entrypoints + `index.js` exports

- **Modified:** `libraries/libeval/src/commands/run.js`

Build the redactor as the **first observable side-effect after option
parsing**, before any `process.env =` write the command does. The existing
`process.env.LIBEVAL_AGENT_PROFILE = ...` line (98) writes after the
factory builds — moving the redactor construction above that write is what
the design's snapshot-determinism contract requires.

```js
// before (line 51–62, after parseRunOptions)
export async function runRunCommand(values, _args) {
  const { taskContent, taskAmend, cwd, model, /* ... */ } = parseRunOptions(values);

  const fileStream = outputPath ? createWriteStream(outputPath) : null;
  const output = fileStream ? createTeeWriter({ /* ... */ }) : process.stdout;

// after — insert redactor construction immediately after parse
export async function runRunCommand(values, _args) {
  const opts = parseRunOptions(values);
  const redactor = createRedactor({
    enabled: process.env.LIBEVAL_REDACTION_DISABLED !== "1",
  });

  const fileStream = opts.outputPath ? createWriteStream(opts.outputPath) : null;
  const output = fileStream ? createTeeWriter({ /* ... */ }) : process.stdout;
```

The `onLine` callback (line 77–82) wraps the SDK line in a
`{source, seq, event}` envelope and writes directly to `output`. That
envelope path bypasses `#recordLine` (it constructs the wrapper from the
already-stringified `line`), so it must run through the redactor too —
this is the design's named "outer envelope redact" defence-in-depth:

```js
// before (line 77–82)
const onLine = (line) => {
  const event = JSON.parse(line);
  output.write(JSON.stringify({ source: "agent", seq: counter.next(), event }) + "\n");
};

// after
const onLine = (line) => {
  const event = JSON.parse(line);
  const tagged = { source: "agent", seq: counter.next(), event };
  output.write(JSON.stringify(redactor.redactValue(tagged)) + "\n");
};
```

Pass `redactor` to `createAgentRunner` (line 108–120):

```js
const runner = createAgentRunner({ cwd, query, output: devNull, /* ... */, redactor });
```

- **Modified:** `libraries/libeval/src/commands/supervise.js` (line 60+) —
  same redactor construction, passed to `createSupervisor`. Supervise mode
  has no command-level `onLine` envelope; the supervisor's own `emit*`
  seams already cover both layers.

```js
const opts = parseSuperviseOptions(values);
const redactor = createRedactor({
  enabled: process.env.LIBEVAL_REDACTION_DISABLED !== "1",
});
// ... existing fileStream / output / mcp setup ...
const supervisor = createSupervisor({ /* existing fields */, redactor });
```

- **Modified:** `libraries/libeval/src/commands/facilitate.js` — same as
  supervise; `createFacilitator({ /* existing */, redactor })`.

- **Modified:** `libraries/libeval/src/index.js` — append:

```js
export {
  Redactor,
  createRedactor,
  createNoopRedactor,
  DEFAULT_ENV_ALLOWLIST,
  DEFAULT_PATTERNS,
} from "./redaction.js";
```

Verify: the three commands import their respective factories from the
already-exported package surface; no new test in this step (the producer-
side integration test in step 7 covers the wiring end-to-end).

### 6. Update existing tests to pass `createNoopRedactor()`

Every test that constructs `AgentRunner`, `Supervisor`, or `Facilitator`
directly (or via factory) gains a `redactor: createNoopRedactor()` field.
The mock runner factory `test/mock-runner.js` is the keystone — fixing it
covers most supervisor/facilitator tests transitively.

| File | Construction sites | Change |
| --- | --- | --- |
| `libraries/libeval/test/mock-runner.js` | `new AgentRunner` (line 44) | Pass `redactor: createNoopRedactor()`. Import from `../src/redaction.js`. |
| `libraries/libeval/test/agent-runner.test.js` | 12 `new AgentRunner` sites + 1 `createAgentRunner` factory site | Add a shared `noop` const at the top of the describe block; pass it on every construction. The existing "throws on missing X" tests stay untouched — they assert pre-redactor failures fire first. The new "throws on missing redactor" test from step 2 lives next to them. |
| `libraries/libeval/test/agent-runner-batching.test.js` | 9 `new AgentRunner` sites | Same noop const + pass-through pattern. |
| `libraries/libeval/test/agent-runner-skill-env.test.js` | 3 `new AgentRunner` sites | Same. |
| `libraries/libeval/test/supervisor-output.test.js` | 5 `new Supervisor` sites | Same. The mock runners are built via `createMockRunner` (already fixed via mock-runner.js). |
| `libraries/libeval/test/supervisor-run.test.js` | 8 `new Supervisor` sites + 3 throws-on-missing tests | Same. |
| `libraries/libeval/test/supervisor-intervention.test.js` | 3 `new Supervisor` sites | Same. |
| `libraries/libeval/test/supervisor-batching.test.js` | 2 `new Supervisor` sites | Same. |
| `libraries/libeval/test/supervisor-factory.test.js` | factory-shape baseOpts() | Add `redactor: createNoopRedactor()` to `baseOpts()`; the new throws-on-missing test from step 3 sits beside it. |
| `libraries/libeval/test/facilitator.test.js` | 6 `new Facilitator` sites | Same. |
| `libraries/libeval/test/facilitator-redirect.test.js` | 1 `new Facilitator` site | Same. |
| `libraries/libeval/test/pending-ask.test.js` | 4 `new Facilitator` + 1 `new Supervisor` | Same. |
| `libraries/libeval/test/amend.test.js` | 1 `createAgentRunner` + 1 `new Facilitator` + 1 `new Supervisor` | Same. |

Verify: `cd libraries/libeval && bun test` — green across the existing
suite (no behavioral change; redactor is identity for all of these).

### 7. Producer-side integration test

- **Created:** `libraries/libeval/test/redaction-pipeline.test.js`

Covers spec criteria 1, 2, 4, 5 against the assembled producer pipeline
(`AgentRunner` → `TeeWriter` → file bytes; `TraceCollector.toText()` over
the captured trace).

| Case | Setup | Assertion |
| --- | --- | --- |
| Sentinel in every carrier shape never reaches `fileStream` | `process.env` set to unique sentinels for each default-allowlist name; mock query yields messages with the sentinels in `tool_use.input.command`, `tool_result.content` (string and JSON-stringified object forms), assistant `text`, and a `system` `init` payload field. AgentRunner output is a TeeWriter wrapping a `Buffer.from()` collecting `fileStream`. | After the run, the captured bytes contain no sentinel substring; every sentinel position is `[REDACTED:env:NAME]`. JSON-stable sentinel guard helper enforced (criterion 1, design § Test surfaces). |
| Pattern hits with no env set | Same harness with `process.env` cleared of allowlist names; messages carry an `sk-ant-`+80-char body, `ghp_`+36, `ghs_`+36, `gho_`+36, `github_pat_`+82. | Each yields `[REDACTED:pattern:KIND]` (criterion 2). |
| Default-on, opt-out warning | `LIBEVAL_REDACTION_DISABLED=1` set; capture stderr via a `Writable` collector. | Stderr contains the documented warning string exactly once; sentinels reach `fileStream` unredacted (criterion 4). |
| `toText()` byte-for-byte placeholder fidelity | Run sentinel + pattern fixture, capture NDJSON, replay through `TraceCollector` + `toText()`. | Both placeholder forms appear in the rendered output identically to their NDJSON form (criterion 5). |
| `Supervisor.emitSummary` covers Conclude-handler text | `createSupervisor` with a mock `Conclude` MCP tool whose `summary` argument carries a sentinel; run end-to-end. | The `summary` event in `fileStream` carries `[REDACTED:env:NAME]`, not the sentinel. This case is the one design risk the unit test of `redaction.js` cannot reach — the path goes through `Supervisor.emitSummary`, not `AgentRunner.#recordLine`. |

Verify: `bun test libraries/libeval/test/redaction-pipeline.test.js` green.

### 8. Documentation

- **Modified:** `libraries/libeval/README.md` — append a `## Trace
  redaction` section after the existing `## Getting Started` block (the
  README currently stops at line 14):

```markdown
## Trace redaction

`fit-eval run`, `fit-eval supervise`, and `fit-eval facilitate` redact
secrets in trace artifacts before they reach disk. Two layers compose:

- **Env-var allowlist**, defaulting to `ANTHROPIC_API_KEY`, `GH_TOKEN`,
  `GITHUB_TOKEN`. The runtime values of these vars are replaced with
  `[REDACTED:env:NAME]` wherever they appear in tool inputs, tool
  outputs, assistant text, or orchestrator summaries. Override the list
  with `LIBEVAL_REDACTION_ENV_VARS=NAME1,NAME2,…` (replaces, not extends).
- **Credential-shape patterns**, covering Anthropic API keys (`sk-ant-`),
  GitHub PATs (`ghp_`), installation tokens (`ghs_`), OAuth tokens
  (`gho_`), and fine-grained PATs (`github_pat_`). Pattern hits become
  `[REDACTED:pattern:KIND]`.

Redaction is on by default. To disable, set `LIBEVAL_REDACTION_DISABLED=1`
— a stderr warning fires once per run. Never set this in CI on a public
repository: workflow artifacts there are downloadable through the
retention window.
```

- **Modified:** `.github/actions/kata-action-eval/action.yml` — append a
  `## Trace redaction` block to the `description:` field's accompanying
  README (the action.yml `description` field is one line; the doc block
  goes into a colocated `README.md` if one exists, otherwise extend the
  top-of-file YAML comment with the same text). Concretely:

  - If `.github/actions/kata-action-eval/README.md` exists: append the
    same `## Trace redaction` block as above, plus a one-line note that
    setting `LIBEVAL_REDACTION_DISABLED` in workflow YAML is reviewable
    in PR diff and prohibited on public-repo CI.
  - If no README: prepend a comment block at the top of `action.yml`
    (above `name:`) carrying the same text, mirroring the project's
    existing inline-doc style.

Verify: `bun run check` green; `bun run format` clean; manual `cat`
inspection of both files matches the design's documentation criteria.

### 9. Final integration sweep

Run the full sequence end-to-end against a local stack to surface any plan
gaps before the panel:

```sh
cd libraries/libeval
bun run test
bun run check

# Producer-side smoke: sentinels in env, run a tiny task, grep the trace.
mkdir -p /tmp/850-smoke
ANTHROPIC_API_KEY="SENTINEL_ANTHROPIC_$(uuidgen)" \
GH_TOKEN="SENTINEL_GH_$(uuidgen)" \
  bunx fit-eval run \
    --task-text='echo $ANTHROPIC_API_KEY $GH_TOKEN' \
    --output=/tmp/850-smoke/trace.ndjson \
    --max-turns=2

! grep -F "$ANTHROPIC_API_KEY" /tmp/850-smoke/trace.ndjson
! grep -F "$GH_TOKEN" /tmp/850-smoke/trace.ndjson
grep -F "[REDACTED:env:ANTHROPIC_API_KEY]" /tmp/850-smoke/trace.ndjson
grep -F "[REDACTED:env:GH_TOKEN]" /tmp/850-smoke/trace.ndjson

# Opt-out warning fires
LIBEVAL_REDACTION_DISABLED=1 bunx fit-eval run \
  --task-text='hi' --max-turns=1 2>&1 | grep -F 'redaction DISABLED'
```

Verify: all four `grep` invocations match (the two `!` lines must NOT
match — a hit is failure); the opt-out warning is observed; `bun run test`
and `bun run check` are green.

## Risks

| Risk | Why it's not visible from the plan | Mitigation |
| --- | --- | --- |
| `walk()` allocates a new object/array for every nested level on every redaction call. For a large `tool_result.content` blob (e.g. multi-MB JSON dumped by a future tool) the allocation cost is non-trivial. | Allocation pattern only manifests on heavy-tool-output runs; existing benchmarks cover assistant text only. | The `enabled === false` branch is the identity function (one boolean check) — confirmed by step 1 test. For enabled runs, the cost is bounded by message size; if it becomes hot, swap `walk` for a transformer that mutates only on hit. Not worth optimising preemptively (criterion: when the secret crosses producer boundary, correctness > throughput). |
| `Buffer.from(parts[1], 'base64url')` and similar encoded credentials embedded in tool output that *don't* match the pattern prefixes will not be redacted. Spec calls this out as the env-allowlist layer's job, but a token that arrives via disk read with no env-var counterpart could leak. | Outside the pattern set; spec § Out of scope explicitly accepts this — the env allowlist is the primary defence for those carriers. | Documented in `libraries/libeval/README.md` and design § Default credential patterns. Add to the same follow-up spec that covers `agent-react.yml` Bash hardening. |
| `process.env.LIBEVAL_REDACTION_DISABLED` is read at command entry; a subsequent in-process write to that env var has no effect (snapshot-determinism). A test that flips the var mid-run sees stale state. | Subtle in test harnesses that reuse `process.env` across describe blocks. | The redactor is built per-command-invocation, not per-process; tests construct their own `createRedactor({ enabled: ... })` directly rather than mutating env. Step 1 unit test asserts the snapshot behaviour explicitly. |
| Pattern regexes use `\b` word boundaries, but base64-url alphabets (`-`, `_`) are *not* word characters under JS `\w`. A `ghp_` token immediately preceded by `-` or `_` could fail to match. | Non-obvious from the regex source; needs an empirical check at canonical-length boundaries. | Step 1 test fixture includes adversarial neighbours (`-ghp_…`, `_ghp_…`, `.ghp_…`). If any case fails, replace `\b` with explicit lookarounds in `DEFAULT_PATTERNS`. The stable placeholder form is unaffected — only the boundary anchor would change. |
| `Supervisor`/`Facilitator` factory now requires `redactor` as a top-level parameter — every external caller (today: `commands/supervise.js`, `commands/facilitate.js`) must pass it. The compiler does not catch the omission; the explicit throw at the factory does. | A future caller written against the v0.1.31 API would silently miss the parameter and fail at runtime. | Throw at the top of the factory function (mirrored in `createAgentRunner` since AgentRunner already has the constructor check) — no silent default-to-noop. The published `createNoopRedactor()` export gives downstream consumers a documented zero-friction path when they explicitly want redaction off (e.g. unit tests of their own consumers). |
| Existing v0.1.x consumers of `@forwardimpact/libeval` (external users importing `AgentRunner` directly) hit the new required-parameter throw on first run after upgrade. Spec did not call out an upgrade-compat surface; the package is pre-1.0, so this is a permitted breaking change. | Pre-1.0 SemVer convention — patch versions can break callers. | Bump the libeval `package.json` minor version (0.1.31 → 0.2.0) at release time and call out the breaking change in release notes. The `kata-release-cut` workflow handles version selection; flagging the breaking change in the PR body is sufficient at plan time. |

## Execution

Sequential, single agent: `staff-engineer` via `kata-implement`. Every step
depends on the prior — `redaction.js` must exist before any wiring, the
producer wiring must compile before tests can be updated, and the
documentation lands last so the prose can describe the shipped behaviour.

Step 8 (documentation) is the only step that could route to
`technical-writer`, but the README block is tightly coupled to the
allowlist names and placeholder forms introduced in steps 1 and 5;
splitting risks drift between the README and the redactor's actual
behaviour. TW remains the right reviewer post-merge for prose polish.

— Staff Engineer 🛠️

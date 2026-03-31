# Spec 220 — Supervised Agent Evaluation

## Problem

We need a way to give an agent an open-ended task — "read the Forward Impact
website and try to set up the Guide product" — and have a second agent supervise
the process: watching what the agent does, answering questions it gets stuck on,
nudging it when it goes off track, and deciding when the task is complete.

Sequential CLI invocations cannot do this. Each invocation is independent — the
agent loses context between steps and cannot learn from its own prior actions.
If the agent gets stuck or has a question, there is no way to respond. Real
evaluation requires an adaptive supervisor that can observe and intervene.

## Solution

Add a `supervise` subcommand to the `fit-eval` CLI. It runs two Claude Agent SDK
sessions in a relay loop:

- An **agent** that receives a task and works on it autonomously — fetching
  docs, installing packages, running commands, writing files. When it finishes a
  turn of work or gets stuck, it reports back.
- A **supervisor** that observes the agent's output after each turn and makes a
  judgement call: let the agent continue, provide guidance, answer a question, or
  declare the evaluation complete.

The agent drives its own exploration. The supervisor does not dictate steps — it
watches, nudges, and evaluates. This models how a senior engineer might observe a
junior developer working through an unfamiliar setup: they don't hand-hold every
step, but they're available when things go sideways.

All scenario-specific intelligence lives in CLAUDE.md files at each agent's
working directory. The orchestration loop is generic — it knows nothing about
Guide, website docs, or npm packages. To evaluate a different scenario, point
the agents at different directories with different CLAUDE.md files.

## Scope

### In scope

1. **`fit-eval supervise` subcommand** — Accepts a task file, supervisor cwd,
   and agent cwd as flags. Runs the supervisor ↔ agent relay using the SDK's
   `query()` function with session resumption. Each cwd can be any directory —
   an existing project, a fresh temp dir, etc.

2. **Supervisor class** (`src/supervisor.js`) — The generic relay loop. Accepts
   a `query` function and a writable output stream via constructor DI. Manages
   session resumption for both agents, emits NDJSON events to the output stream,
   enforces turn limits. Returns a structured result.

3. **`supervise` command handler** (`src/commands/supervise.js`) — Parses CLI
   args, validates that paths exist, wires real dependencies, runs the
   Supervisor, and writes output.

4. **Guide setup scenario** — The first scenario, demonstrating the pattern.
   A task file and two directories (or one existing project for the supervisor)
   that encode the Guide product setup evaluation. Location TBD in plan.

5. **Single combined NDJSON stream** — Both agents' SDK event streams are
   merged into one output, each line tagged with `source` (agent, supervisor,
   orchestrator) and `turn` number. Filter by `source=="agent"` to get a
   standard trace compatible with TraceCollector, `fit-eval output`, and
   `fit-eval tee`.

### Out of scope

- Parallel agents (single agent per run).
- Nested supervision (two layers only).
- MCP server integration (built-in Claude Code tools only).
- CI integration (manual invocation for now).
- Changes to TraceCollector's event schema.

## Architecture

### CLI Interface

```
fit-eval supervise [options]

Options:
  --task=PATH          Path to task file (task description for the agent)
  --supervisor-cwd=DIR Supervisor working directory (default: .)
  --agent-cwd=DIR      Agent working directory (default: temp directory)
  --max-turns=N        Maximum supervisor ↔ agent exchanges (default: 20)
  --output=PATH        Write NDJSON trace to file (default: stdout)
```

All flags are independent — any combination works. This means the supervisor can
run from an existing project (inheriting its CLAUDE.md, `.claude/skills/`, and
settings) while the agent starts in a completely separate directory.

### Directory Roles

Each agent's `cwd` determines what context it loads. The SDK reads `CLAUDE.md`,
`.claude/settings.json`, and `.claude/skills/` from the working directory.

**Supervisor cwd** — Where the supervisor runs. Can be an existing project like
the monorepo root, giving it access to all skills, settings, and project
context. Or it can be a purpose-built directory with a custom `CLAUDE.md` that
encodes scenario-specific judgement rules.

**Agent cwd** — Where the agent works. Typically a fresh directory for
evaluation scenarios (simulating a new developer), but can also be an existing
project. The agent's `CLAUDE.md` and `.claude/settings.json` at this path
control its persona and tool permissions.

**Task file** — The task given to the agent on the first turn. A plain text or
markdown file. Lives anywhere — it is read once at startup and passed to the
agent as its initial prompt.

### Typical Configurations

**Supervisor inherits monorepo context:**
```
fit-eval supervise \
  --task=scenarios/guide-setup/task.md \
  --supervisor-cwd=. \
  --agent-cwd=/tmp/fresh-project
```
The supervisor picks up the monorepo's CLAUDE.md, all `.claude/skills/`, and
settings. The agent starts clean.

**Both purpose-built (fully isolated scenario):**
```
fit-eval supervise \
  --task=scenarios/guide-setup/task.md \
  --supervisor-cwd=scenarios/guide-setup/supervisor \
  --agent-cwd=scenarios/guide-setup/agent
```
Each agent has its own CLAUDE.md and settings. Equivalent to the old workspace
layout but expressed as flags.

**Minimal (defaults):**
```
fit-eval supervise --task=task.md
```
Supervisor runs from the current directory. Agent gets a temp directory.

### Interaction Model

The agent works. The supervisor watches and decides what to do next.

```
Agent receives task, works autonomously
  ↓
Agent completes a turn of work (or gets stuck, or asks a question)
  ↓
Supervisor observes agent's output, decides:
  CONTINUE  → "Keep going." (agent continues where it left off)
  NUDGE     → "Try checking the CLI reference page." (guidance)
  ANSWER    → "The data dir is ./data/pathway/." (direct answer)
  DONE      → Evaluation complete, emit final assessment
  ↓
Agent receives supervisor response, resumes work
  ↓
... repeats until DONE or maxTurns reached
```

Both agents retain full conversation history via session resumption. The agent
remembers every action it took across all turns. The supervisor remembers every
observation and intervention it made.

**Key property:** The supervisor's response becomes the agent's next prompt. If
the supervisor says "Keep going, you're on the right track" — the agent receives
that as encouragement and continues. If the supervisor says "You missed the
`fit-pathway init` command, check the CLI docs" — the agent receives that as
guidance and adjusts. The relay is just text passing between two persistent
sessions.

### Class Design

```
Supervisor
  constructor({ supervisorCwd, agentCwd, query, output })
  async run(task, { maxTurns }): { success, turns }
```

**Constructor dependencies:**

| Dependency       | Type       | Purpose                                  |
| ---------------- | ---------- | ---------------------------------------- |
| `supervisorCwd`  | `string`   | Path to supervisor workspace directory   |
| `agentCwd`       | `string`   | Path to agent workspace directory        |
| `query`          | `function` | SDK query function (injected for testing) |
| `output`         | `Writable` | Stream to emit NDJSON lines to           |

The `query` function is the Claude Agent SDK's `query()`. Injecting it means
tests can substitute a mock that returns canned responses without hitting the
API. The `output` stream defaults to `process.stdout` in the CLI; tests can
capture it.

### Relay Loop (Pseudocode)

```javascript
async run(task, { maxTurns = 20 } = {}) {
  // Turn 0: Agent receives the task and starts working
  let agentResult = await this.send(this.agent, task);

  for (let turn = 1; turn <= maxTurns; turn++) {
    // Supervisor observes the agent's output
    const decision = await this.send(this.supervisor,
      `The agent reported:\n\n${agentResult.text}\n\n` +
      `Decide: provide guidance, answer a question, or output DONE.`
    );

    if (isDone(decision.text)) {
      return { success: true, turns: turn };
    }

    // Supervisor's response becomes the agent's next input
    agentResult = await this.send(this.agent, decision.text);
  }

  return { success: false, turns: maxTurns };
}
```

The loop is generic. It does not parse the supervisor's response (beyond checking
for DONE). It does not know what the task is. All intelligence — what "done"
means, what kind of nudges to give, when to intervene — lives in the
supervisor's CLAUDE.md.

### Output Format

The command emits a single combined NDJSON stream. Each line from either agent's
SDK stream is wrapped with a `source` and `turn` field before being emitted:

```jsonl
{"source":"agent","turn":0,"type":"system","subtype":"init","session_id":"..."}
{"source":"agent","turn":0,"type":"assistant","message":{...}}
{"source":"agent","turn":0,"type":"result","subtype":"success","total_cost_usd":0.42}
{"source":"supervisor","turn":1,"type":"assistant","message":{...}}
{"source":"supervisor","turn":1,"type":"result","subtype":"success","total_cost_usd":0.03}
{"source":"agent","turn":1,"type":"assistant","message":{...}}
...
{"source":"orchestrator","type":"summary","success":true,"turns":5}
```

Three sources appear in the stream:

| Source          | What it contains                                          |
| --------------- | --------------------------------------------------------- |
| `agent`         | Full SDK event stream — tool calls, text, token usage     |
| `supervisor`    | Lighter stream — mostly text decisions, few/no tool calls |
| `orchestrator`  | Final summary line with aggregate turns and success       |

**Filtering for compatibility.** Pipe through
`jq 'select(.source=="agent")'` to get a plain agent trace that TraceCollector
can process unchanged. The full interleaved stream gives the complete picture.

### Integration with Existing libeval

The `supervise` command adds to fit-eval alongside `output` and `tee`:

```javascript
const COMMANDS = {
  output: runOutputCommand,
  tee: runTeeCommand,
  supervise: runSuperviseCommand,
};
```

## Example: Guide Setup Scenario

The first scenario demonstrates the pattern. The supervisor runs from the
monorepo root (inheriting all skills and project context). The agent starts in
a fresh temp directory.

```
fit-eval supervise \
  --task=scenarios/guide-setup/task.md \
  --supervisor-cwd=. \
  --agent-cwd=/tmp/guide-eval
```

**`scenarios/guide-setup/task.md`:**
> You are a developer evaluating the Forward Impact engineering platform. Go to
> www.forwardimpact.team, find the Guide product, read the documentation, and
> try to install and configure it in a fresh project. Do not clone the monorepo —
> install from npm. Write notes about your experience in ./notes/.

**Supervisor context (monorepo root CLAUDE.md + a scenario-specific system
prompt or appended instructions):**

The supervisor inherits the monorepo's full CLAUDE.md and skills. Scenario-
specific judgement rules can be added via a CLAUDE.md in a subdirectory or
passed through the supervisor's prompt framing. The relay loop wraps each
agent observation with:

> The agent reported: {output}. Decide: provide guidance, answer a question,
> or output DONE.

The supervisor's own CLAUDE.md (from the monorepo) gives it deep product
knowledge — it knows what `fit-pathway init` does, what packages exist, what
the correct setup steps are. This is the advantage of running the supervisor
from an existing project rather than an isolated directory.

**Supervisor judgement rules** (encoded in the scenario or the monorepo
CLAUDE.md):

> ## When to intervene
> - The agent is stuck in a loop (retrying the same failing command)
> - The agent is going down a dead end (e.g. trying to clone the monorepo)
> - The agent asks a question you can answer
> - The agent has missed something important
>
> ## When to let them continue
> - The agent is making progress, even if slowly
> - The agent is troubleshooting a real issue (let them learn)
> - The agent found an alternative path that still works
>
> ## Completion criteria
> - The agent has installed @forwardimpact packages from npm
> - The agent has initialized framework data with fit-pathway init
> - The agent has run fit-map validate
> - The agent has written an assessment to ./notes/
> - Output DONE when all criteria are met (or clearly unachievable)

**`/tmp/guide-eval/CLAUDE.md`** (agent context, created before the run):
> You are a developer evaluating a new product. Work independently — read docs,
> try commands, troubleshoot errors. If you get genuinely stuck and can't find
> the answer in documentation, say so clearly and describe what you've tried.
> Write notes about your experience in ./notes/ as you go.

## Success Criteria

**Generic (the `supervise` command):**

- `Supervisor` follows the OO+DI pattern — constructor injection, factory
  function, tests bypass factory and inject mocks directly
- `fit-eval supervise` works end-to-end with any combination of flags
- NDJSON output is filterable to a standard TraceCollector-compatible trace
- Turn limits are enforced
- The supervisor terminates cleanly via DONE rather than hitting maxTurns

**Guide scenario (the first workspace):**

- The agent discovers Guide from the website without being told specific URLs
- The agent installs `@forwardimpact` packages from npm
- The agent initializes framework data and attempts job/agent generation
- The agent produces notes with specific documentation feedback
- The supervisor intervenes only when the agent is genuinely stuck

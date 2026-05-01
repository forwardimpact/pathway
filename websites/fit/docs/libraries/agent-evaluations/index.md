---
title: Agent Evaluations
description: Run agent-as-judge evaluations in CI with fit-eval supervise and inspect the resulting traces with fit-trace.
---

# Agent Evaluations

`fit-eval` is the plumbing for agent-as-judge evaluations. You write a **judge
agent** and a **target agent**, then `fit-eval supervise` runs them together in
a relay loop: the judge sees the target's work turn-by-turn and signals the
verdict by calling its `Conclude` tool. The exit code (`0` pass, `1` fail) lets
GitHub Actions surface eval results like any other check, and the NDJSON trace
captures the full session for inspection with `fit-trace`.

This guide walks from a single eval definition to a CI workflow that runs an
eval suite on every push.

## Prerequisites

- Node.js 18+
- `ANTHROPIC_API_KEY` available to the workflow
- A repository where you want the eval to run
- The `fit-eval` and `fit-trace` CLIs (both ship in `@forwardimpact/libeval`) —
  install once with `npm install -g @forwardimpact/libeval` and call
  `fit-eval`/`fit-trace` directly, or invoke ephemerally in CI with
  `npx --yes @forwardimpact/libeval fit-eval ...` (no install step needed)

## 1. Write the task

The task file is a plain markdown prompt — what you want the target agent to do.
Keep it specific and measurable; an eval is only as good as the task it asks the
agent to perform.

```md
<!-- evals/refactor-utils/task.md -->
Refactor `src/utils/format.js` so that `formatDate` and `formatCurrency`
share a single locale-resolution helper. Do not change the public API of
either function. Add unit tests covering the en-US, en-GB, and de-DE
locales. Run the test suite and confirm it passes before finishing.
```

## 2. Write the judge profile

The judge is an agent profile under `.claude/agents/<name>.md`. The supervisor
runtime appends an orchestration trailer that explains how to use `Ask`,
`Announce`, `Redirect`, and `Conclude` — your profile only needs to specify
**what good looks like for this task**.

```md
<!-- .claude/agents/refactor-judge.md -->
---
name: refactor-judge
description: Judge a refactor of shared formatting utilities.
---

You are evaluating a refactor of `src/utils/format.js`. Watch the agent's
work and call `Conclude` when the session is finished.

Pass criteria — all must hold:

- `formatDate` and `formatCurrency` share a single locale-resolution helper.
- The public signatures of both functions are unchanged.
- New tests exist for en-US, en-GB, and de-DE.
- The full test suite passes on the agent's final run.

If the agent strays, use `Redirect` to bring it back on task. If it claims
to be done, verify the criteria yourself with `Read` and `Bash` before
calling `Conclude`. Conclude with `success: false` if any criterion fails;
include a one-paragraph summary of the gap.
```

The judge has its own working directory (`--supervisor-cwd`) and tool allowlist
(`--supervisor-allowed-tools`). Give it whatever it needs to verify the work —
typically `Read`, `Grep`, `Bash` — but not `Write` or `Edit`, since the judge
should not be doing the work.

## 3. Run the eval locally

```sh
npx fit-eval supervise \
  --task-file=evals/refactor-utils/task.md \
  --supervisor-profile=refactor-judge \
  --supervisor-cwd=. \
  --supervisor-allowed-tools=Read,Grep,Bash \
  --agent-cwd=/tmp/refactor-sandbox \
  --allowed-tools=Read,Edit,Write,Bash,Grep,Glob \
  --max-turns=50 \
  --output=trace.ndjson
```

`--agent-cwd` should usually be a sandbox copy of your repo, since the target
agent will edit files there. The judge stays in `--supervisor-cwd` to inspect
the agent's work without writing to it.

Exit code `0` means the judge concluded with `success: true`; exit code `1`
means it concluded with `success: false`, ran out of turns, or errored.

## 4. Run it in GitHub Actions

A two-step workflow is enough: run the eval, then split and upload the trace so
you can inspect it later. The eval's exit code is the job's exit code.

```yaml
# .github/workflows/eval.yml
name: Agent eval

on:
  push:
    branches: [main]
  pull_request:

jobs:
  refactor-utils:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Run eval
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          mkdir -p /tmp/sandbox /tmp/trace
          cp -r . /tmp/sandbox
          npx --yes @forwardimpact/libeval fit-eval supervise \
            --task-file=evals/refactor-utils/task.md \
            --supervisor-profile=refactor-judge \
            --supervisor-cwd=. \
            --supervisor-allowed-tools=Read,Grep,Bash \
            --agent-cwd=/tmp/sandbox \
            --allowed-tools=Read,Edit,Write,Bash,Grep,Glob \
            --max-turns=50 \
            --output=/tmp/trace/trace.ndjson

      - name: Split trace
        if: always()
        run: |
          npx --yes @forwardimpact/libeval fit-trace split \
            /tmp/trace/trace.ndjson \
            --mode=supervise \
            --output-dir=/tmp/trace

      - name: Upload trace
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: eval-trace
          path: /tmp/trace/*.ndjson
```

`if: always()` on the split and upload steps ensures the trace is preserved even
when the eval fails — which is when you most need it. `split --mode=supervise`
produces `trace-agent.ndjson` and `trace-supervisor.ndjson` alongside the
original combined trace.

## 5. Read the results

When an eval fails, download the artifact and start with `overview` and
`timeline` to orient. Then drill in.

```sh
npx fit-trace runs                              # find the failed run
npx fit-trace download <run-id>                 # downloads to /tmp/trace-<run-id>/
npx fit-trace overview /tmp/trace-<run-id>/structured.json
npx fit-trace timeline /tmp/trace-<run-id>/structured.json
npx fit-trace tool /tmp/trace-<run-id>/structured.json Conclude
```

The `Conclude` tool call carries the judge's verdict and summary — that's
usually where you start when an eval fails. From there, follow the timeline
backwards to find the turn where the agent went wrong.

Run `npx fit-trace --help` for the full command surface.

## Scaling to a suite

Each eval is a `task.md` plus one or more judge profiles. Add a matrix to fan
them out:

```yaml
strategy:
  fail-fast: false
  matrix:
    eval:
      - { task: refactor-utils, judge: refactor-judge }
      - { task: fix-flaky-test, judge: test-judge }
      - { task: add-rate-limiter, judge: ratelimit-judge }
```

`fail-fast: false` is important — you want every eval's trace, not just the
first failure's.

## Notes

- **`--max-turns=0`** removes the turn cap. Use it for exploratory runs; always
  set a real budget in CI.
- **`--task-amend`** appends extra steering text to the task without editing the
  task file — useful for parameterising the same task across a matrix.
- **Judge tool allowlist matters.** A judge with `Edit` access can rewrite the
  agent's work and mask failures. Restrict it to read-only tools.
- **The judge's profile is a system prompt, not a contract.** It steers the
  judge but doesn't bind it. Treat eval verdicts as you would a code review from
  a strong but fallible reviewer — useful signal, not ground truth.

## Related

- [Trace Analysis](../trace-analysis/index.md) — read the NDJSON traces this
  guide produces, with worked examples including a failed eval.
- [Agent Teams Guide](../agent-teams/index.md) — how agent profiles are authored
  and what they contain.

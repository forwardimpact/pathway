# Design 610 — Agent Self-Maintenance Under `.claude/**` Write Protection

## Overview

Three components turn the undocumented `dangerouslyDisableSandbox` + heredoc
pattern (proven by product-manager run `24757518688`) into a supported,
auditable write path: a path-gated wrapper script, a canonical agent reference,
and a kata-trace invariant. `.claude/settings.json` is cleaned of the four dead
allow rules so the settings file describes actual capability.

## Architecture

```mermaid
graph LR
  A[Skill needs<br/>.claude/** edit] --> R[Read<br/>self-maintenance.md]
  R --> B[Bash tool,<br/>sandbox disabled]
  B --> W[claude-write.sh<br/>path gate]
  W -->|inside .claude/| OK[Write file]
  W -->|outside| X[Refuse]
  OK --> G[Git diff] --> C[Commit + PR] --> H[Human review]
  B -.trace.-> T[kata-trace invariant:<br/>sandbox-disabled Bash ⇒ wrapper]
```

## Components

### 1. `scripts/claude-write.sh` — path-gated writer

The only approved destination for a `dangerouslyDisableSandbox: true` Bash call.
Takes a target path and file content as inputs and writes the content to the
target **iff the target's resolved location is strictly inside the repo's
`.claude/` subtree**. Any other target is refused without a write. Failure is
non-silent (the caller sees a distinct exit status); success leaves the working
tree modified and nothing else. The gate is the only behaviour — no git calls,
no hook invocations. Review stays at the commit boundary where it already lives.

The script lives outside `.claude/**` so agents can normally edit it without
needing the escape hatch to change its own rules.

### 2. `.claude/agents/references/self-maintenance.md` — canonical reference

A new sibling of `memory-protocol.md`. Agent profiles' existing startup surface
includes that directory, so placing the reference there makes it reachable
without a new startup-tier rule.

The reference is the single canonical source for four facts: the rule (every
`.claude/**` edit goes through the wrapper), the invocation contract (one
Bash-tool shape, stdin-delivered content, sandbox-disabled), the refusal surface
(what is out of scope and what a refused write looks like), and a pointer to the
kata-trace invariant enforcing uniform use. Wording is plan-level.

### 3. `.claude/settings.json` — honest capability

The four allow rules added by PR #470 are removed. Nothing is added. The file
then accurately reflects runtime behaviour: the hardcoded ask-level guard on
`.claude/**` is unchanged, and no allow rule claims otherwise.

### 4. kata-trace invariant — uniform use

`.claude/skills/kata-trace/references/invariants.md` gains one cross-cutting
invariant applicable to every agent trace:

| Invariant                                                         | Evidence                                                                                                                                  | Severity |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `dangerouslyDisableSandbox: true` only used to invoke the wrapper | Every turn with `tool=="Bash"` and `input.dangerouslyDisableSandbox==true` has a `command` beginning with `bash scripts/claude-write.sh ` | **High** |

Violation evidence surfaces in the existing per-run invariant audit. This is the
mechanical enforcement that SC6 (no skill invents its own workaround) depends
on.

### 5. Skill citations

Skills whose plans write under `.claude/**` (`kata-documentation`,
`kata-wiki-curate`, any skill editing its own `references/` subdir) cite the
canonical reference in their Process section with a one-line pointer. Which
skills cite it is a plan-level enumeration, not a design question.

## Key Decisions

### Wrapper script, not raw heredoc pattern

Alternatives considered:

- **Documented raw pattern (per spec candidate 1).** Rejected. Each skill
  assembles its own `sed -i` or here-doc invocation. Path validation lives in
  prose, not in code — nothing prevents a skill from writing to `.git/**` or
  `.github/**` once the sandbox is disabled. The trace invariant would need a
  more complex match (argv pattern + path substring) and the spec's "ad-hoc
  per-skill reinvention" prohibition has no teeth.
- **Staging directory + Stop-hook copy (per spec candidate 2).** Rejected.
  Agents write to `/tmp/claude-writes/...` and a Stop hook mirrors into
  `.claude/**`. Breaks read-after-write within a run: the agent reads the old
  `.claude/**` content until the hook fires at Stop. If the run dies before
  Stop, writes are lost. Adds hook surface that duplicates the git commit
  boundary already enforced by wrapper writes.
- **Runtime/permission-mode change (per spec candidate 3).** Rejected. Commit
  `67e0825b` already tried a settings-layer fix and the trace proved it inert.
  No known runtime configuration toggles the hardcoded `.claude/**` ask-level
  guard. Pursuing one is a research task with an unknown landing date; this spec
  needs a mechanism now.
- **Human-only edits (per spec candidate 4).** Rejected. Fails SC2 — the spec
  requires a newly-scheduled agent run to complete a `.claude/**` edit without
  human intervention. Also accepts permanent latency for 47 files.

The wrapper is small (shell script, one gate), observable (stable trace
signature `bash scripts/claude-write.sh ...`), and composable with the existing
commit + PR review boundary.

### Reference lives under `.claude/agents/references/`, not a new top-level doc

Alternatives:

- **`CONTRIBUTING.md` section.** Rejected. Every CLAUDE.md policy entry is
  already canonical in one location; adding a section here spreads the rule
  across two files. Agents read `CONTRIBUTING.md` only when the skill directs
  them — it is not on the startup surface the spec requires.
- **`.claude/memory/MEMORY.md` addition.** Rejected. MEMORY.md is the
  cross-cutting priority index per spec 590; policies do not belong there.
- **`.claude/references/` (new top-level dir).** Rejected. Creates a parallel
  directory to `.claude/agents/references/`; agents would need a new
  startup-tier rule to find it. Sibling placement reuses the protocol already in
  every agent profile.

### Path gate resolves before it compares

The gate must resolve `..` segments and follow symlinks before the
inside-`.claude/`-subtree check, not compare the raw input string. Correctness
is non-negotiable when the sandbox is disabled: a raw-string prefix match admits
`.claude/../anywhere` and symlinks pointing out of the subtree.

Alternative — string-prefix match on the caller-supplied path. Rejected. Any
accidental `..` segment or symlink slips the gate. Plan selects the resolver
tool and syntax.

### Remove dead rules, do not replace them

Alternatives:

- **Add `Bash(bash scripts/claude-write.sh *)` to allow.** Rejected at design
  level pending plan-time evidence. The runtime may or may not ask before a
  whitelisted Bash invocation with `dangerouslyDisableSandbox: true`; the
  current trace evidence (product-manager run `24757518688`) is on a bare
  `sed -i` call without an allow rule, and it succeeded. Plan decides whether an
  allow rule is needed; design requires only that whatever is listed corresponds
  to observed behaviour.

## Data flow — a `.claude/**` edit

```mermaid
sequenceDiagram
  participant Skill
  participant Agent
  participant Bash
  participant Script as claude-write.sh
  participant Git

  Skill->>Agent: Edit .claude/** per self-maintenance.md
  Agent->>Bash: Bash tool, sandbox disabled,<br/>invoke wrapper with target + content
  Bash->>Script: exec with content on stdin
  Script->>Script: resolve target, check inside .claude/
  Script->>Git: write file (working tree)
  Script-->>Agent: exit 0 on success / 1 on refusal
  Agent->>Git: git add + commit + push
  Git->>Git: PR → human review → merge
```

## Success-criteria alignment

| SC  | How the design satisfies it                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `.claude/agents/references/self-maintenance.md` is the canonical reference, located on existing agent startup surface.                                             |
| 2   | Wrapper + heredoc Bash call is the documented invocation; trace shows the tool call and no permission-denial error.                                                |
| 3   | Settings file has the four dead rules removed; no contradicting rule remains.                                                                                      |
| 4   | Plan reopens #441 and closes it via the wrapper path, trace-verified.                                                                                              |
| 5   | kata-trace emits a two-week comparative report of `.claude/**` permission-denial counts into `wiki/metrics/improvement-coach/`; wrapper path yields zero post-fix. |
| 6   | kata-trace invariant enforces wrapper use; no skill invents its own escape hatch.                                                                                  |
| 7   | Wrapper is a dormant script; `fit-map validate`, `just quickstart`, wiki pipelines are unchanged.                                                                  |

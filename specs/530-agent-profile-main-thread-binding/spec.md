# Spec 530 — Agent Profile Main-Thread Binding

## Problem

Scheduled Kata agents are not adopting their `.claude/agents/<name>.md` profile
as the main-thread system prompt. The main thread runs as a generic
Claude Code session that happens to know `<name>` is a registered subagent. PR
[#409] (2026-04-17) switched libeval from `extraArgs: { agent }` to the SDK's
top-level `agent` option expecting this to bind the profile; traces from five
runs spanning four agents on the next night shift show it did not.

[#409]: https://github.com/forwardimpact/monorepo/pull/409

### Evidence

Five consecutive workflow runs ran after [#409] merged at `2026-04-17T17:46Z`.
Each started on a commit containing the fix. None adopted its profile.

| Workflow | Run ID | Start UTC | Own profile read? | Other profiles read? | Behaviour exhibited |
| --- | --- | --- | --- | --- | --- |
| Technical Writer | [24587425816] | 21:26 | no | none | Implemented summit/coverage code fix (#414) |
| Release Engineer | [24586709478] | 21:06 | no | none | Ran product-manager PR gate, merged #413 |
| Product Manager | [24596510543] | 04:05 | no | improvement-coach.md | Ran product-manager PR gate (in-domain by coincidence) |
| Staff Engineer | [24597071264] | 04:39 | no | improvement-coach.md, **product-manager.md** | Ran product-manager PR gate on #414 |
| Security Engineer | [24597390612] | 04:58 | no | **product-manager.md** | Ran product-manager PR gate on #414 |

[24587425816]: https://github.com/forwardimpact/monorepo/actions/runs/24587425816
[24586709478]: https://github.com/forwardimpact/monorepo/actions/runs/24586709478
[24596510543]: https://github.com/forwardimpact/monorepo/actions/runs/24596510543
[24597071264]: https://github.com/forwardimpact/monorepo/actions/runs/24597071264
[24597390612]: https://github.com/forwardimpact/monorepo/actions/runs/24597390612

**Shared opening phrase.** Every one of the five main-thread agents opens with
near-identical framing — "The user is asking me to assess the current state of
my domain and act on the highest-priority finding. This looks like an
autonomous loop prompt/request/task." The security engineer adds "Let me
figure out what domain I'm in." That framing is generic Claude Code responding
to a task, not a profile introducing itself.

**Voice markers absent.** `technical-writer.md` instructs the agent to sign
output with `— Technical Writer 📝`. The technical-writer run emitted no
signature. None of the other profiles' voice markers appear either.

**Drift converges on product-manager behaviour.** Three of four non-PM runs
produced Product PR Gate reports on PR #414 — the most actionable visible
work. When the profile is absent, the agent reads `KATA.md` for orientation,
sees the seven-agent landscape, picks the most visible queue (open PRs), and
acts as whichever profile that queue belongs to. The Security Engineer run
even read `.claude/agents/product-manager.md` to execute the gate correctly.

**Init event does not mark a main-thread agent.** The SDK's `system.init`
event from run 24587425816 contains:

```
agents: ['Explore', 'general-purpose', 'improvement-coach', 'Plan',
         'product-manager', 'release-engineer', 'security-engineer',
         'staff-engineer', 'statusline-setup', 'technical-writer']
```

All profiles registered as subagents; none bound as the main-thread agent.
The per-turn `agent_type` field described in `sdk.d.ts` as "Present … on the
main thread of a session started with --agent" never appears.

**SDK expectation mismatch.** `@anthropic-ai/claude-agent-sdk@0.2.112`
documents the top-level `agent` option as: "The agent must be defined either
in the `agents` option or in settings." libeval passes `agent: "<name>"` but
does not pass `agents: { "<name>": { prompt, description, … } }`. The
`settings` fallback path reads subagent definitions from
`.claude/agents/*.md`, but the observed behaviour shows those definitions are
applied to the _subagent registry_ (for the `Task`/`Agent` tool), not to the
_main-thread system prompt_.

**All five runs completed successfully at the API level** — the bug is
silent. No validation error, no warning. The only visible signal is
behavioural drift across many turns.

### Contrast — facilitated mode works

The daily storyboard meeting uses libeval's `facilitate` execution mode,
which wires its agents with a different SDK option shape. Run
[24554487708] (2026-04-17 07:58, 10 hours _before_ PR #409 merged) shows
perfect persona adoption across all five facilitated agents:

[24554487708]: https://github.com/forwardimpact/monorepo/actions/runs/24554487708

| Signal | Solo runs (5 sampled) | Facilitated run (5 agents) |
| --- | --- | --- |
| Read own `wiki/<agent>.md` before first domain action | 0 / 5 | **5 / 5** |
| First tool call in-domain | 0 / 5 | **5 / 5** |
| Emitted profile voice marker (🌱 🔒 🚀 📝 📊) | 0 / 5 | **5 / 5** |
| Drift to other profile | 4 / 5 (all to product-manager) | 0 / 5 |

Voice markers like `— Technical Writer 📝` are authored only in
`.claude/agents/<name>.md`. No facilitated agent _Read_ its own profile file
during the run, yet every one of them emitted the correct marker. The
profile content therefore reaches facilitated agents through the system
prompt at session start, not through a tool call.

**The difference is at session start, not at task time.** Facilitated and
supervised modes compose the profile into the main-thread system prompt
before the first turn; solo mode does not. The `agent` option alone — the
approach PR [#409] reached for — is not what distinguishes a working run
from a broken one in this SDK version; some additional session-start
composition, already present in the facilitated and supervised call sites,
is. Solo mode is the single outlier among the three execution modes.

### Impact

- **Persona-enforced scope constraints are not in force.** Each profile
  defines scope boundaries ("never weaken documentation accuracy", "trust
  boundary: product-manager is sole external merge point", etc.). When the
  profile is not loaded, those boundaries are absent.
- **Skill routing fails.** Profiles list 5–8 skills each; the main thread
  instead sees the union of all skills and picks whichever matches the
  self-chosen task.
- **Voice and signatures are absent.** Downstream PR comments and wiki
  writes cannot be attributed to the right agent by voice — breaks
  cross-agent audit trails.
- **Invariant audits produce false FAILs.** `kata-trace`'s per-agent
  invariants (`references/invariants.md`) assume the profile drove the run;
  when the profile was absent, every invariant that refers to persona-scoped
  behaviour fails against a main thread that never tried to satisfy them.
- **Cost inflation.** Generic triage runs dispatch multiple Explore
  sub-agents to re-derive what the profile would have narrowed to "read own
  summary + current week log". Run 24587425816 spent 816K cache-read tokens
  and six Agent sub-agents on broad repo triage.

## Proposal

Bind the designated agent profile as the main-thread system prompt on every
scheduled agent run — including solo-mode runs, which today silently skip
this step. The profile must drive the first token of the main thread, the
binding must be verifiable from the trace without reading behaviour across
many turns, and a missing profile must surface as a loud startup failure
rather than a silent fallback to a generic main thread.

### Binding must be explicit

Passing a profile name alone is not enough — the invariant behind this spec
is that whatever the runtime needs to attach profile content to the main
thread, libeval must supply it. The current solo-mode path has been
observed to produce an unbound main thread while reporting success.
Facilitated and supervised modes already bind correctly and stand as the
baseline; solo mode must meet the same guarantee.

### Missing profile must fail loudly

When a profile name does not resolve to profile content, the run must fail
before any API call with an error that names the missing profile. Silent
fallback to a generic main thread is the failure mode this spec closes.

### Binding must be observable in the trace

The trace emitted for each run must contain a signal that identifies the
main-thread agent. `kata-trace` must be able to verify the binding from the
trace artifact alone, without inferring it from behaviour. Whether that
signal is one the runtime emits natively or one libeval emits itself is a
design choice.

### Binding must hold across execution modes

All three libeval execution modes — single-agent runs, supervised runs, and
facilitated multi-agent sessions — must bind their respective main-thread
profiles with the same guarantees. In supervised and facilitated modes, each
independent main thread must bind its own profile independently. The
existing behaviour of supervised and facilitated modes is the baseline
against which solo mode's fix is verified.

## Scope

### Affected

- **libeval main-thread profile loading** — the path that currently passes
  `agent: <name>` to the SDK, across all execution modes (run, supervise,
  facilitate).
- **`fit-eval` CLI startup** — must reject an unresolvable profile before
  starting the query.
- **Trace schema** — whichever signal identifies the bound main-thread agent
  must be documented alongside the existing event types so `kata-trace` can
  audit it.
- **`kata-trace` invariant audit** — gains a universal "main-thread agent
  bound" invariant applied to every scheduled agent trace.

### Excluded

- **Agent profile content.** The `.md` files under `.claude/agents/` stay
  as written. This spec changes how they are loaded, not what they say.
- **Subagent registration.** The existing mechanism for making `Explore`,
  `Plan`, `improvement-coach`, etc. available via the `Task`/`Agent` tool
  continues to work as today.
- **SDK upstream fixes.** If investigation shows the SDK itself has a bug,
  the upstream fix is out of scope — this spec delivers a workaround in
  libeval that holds regardless of SDK behaviour.
- **Task prompt rewording.** The task text "Assess the current state of
  your domain and act on the highest-priority finding" stays generic. The
  profile is what binds "your domain" to a specific meaning, and fixing the
  binding is this spec's job. A follow-up spec may later add defence-in-depth
  prefixes to task text, but only after the binding fix is verified.
- **Storyboard / coaching task prompts.** Those are specific enough to be
  self-identifying today.

## Dependencies

None blocking. [#409] merged a related libeval change; the evidence in this
spec shows it was necessary but not sufficient.

## Success Criteria

1. For every scheduled agent workflow
   (`agent-technical-writer`, `agent-security-engineer`, `agent-staff-engineer`,
   `agent-release-engineer`, `agent-product-manager`), the captured trace
   contains an event that identifies the main-thread agent by its profile
   name. The signal must be discoverable by a documented `kata-trace` query.
2. For each of those runs, the main thread's first `Read` targets
   `wiki/<agent>.md` before any other wiki or agent-profile read. This
   property is checkable by scanning the trace for the first `Read`
   tool call.
3. Running `fit-eval` with a non-existent agent profile exits non-zero with
   an error message naming the missing profile, before any API call.
4. `kata-trace`'s invariant audit includes a "main-thread agent bound"
   invariant. Audits of the five evidence runs listed above mark it FAIL;
   audits of the next scheduled run of each workflow after the fix lands
   mark it PASS.
5. The main-thread profile system prompt is detectable in the trace —
   either via a dedicated event or via an echoed system-prompt payload —
   such that a reader can confirm, from the artifact, that the profile's
   content is what drove the first turn. This is an artifact property, not
   dependent on whether any particular run chose to emit a voice marker.

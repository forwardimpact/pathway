# 400 — Library Skill Discovery

The shared libraries under `libraries/` are routinely missed during planning and
implementation. Agents (and human contributors) reach for ad-hoc helpers, inline
`console.log`, hand-rolled retry loops, and bespoke argument parsers even though
`libutil`, `libtelemetry`, and `libcli` already solve the same problems. The
`libs-*` skill groups exist precisely to surface these capabilities — and they
are not doing the job.

This spec scopes the changes that would make library discovery reliable. It
addresses the trigger surface (frontmatter descriptions), the workflow (when
discovery is supposed to happen), the staleness risk (no CI guard against
drift), and the taxonomy (whether the current six groups are the right groups).

## Why this matters

### 1. Skill descriptions are written as identity, not as capability

Every `libs-*` SKILL.md frontmatter description starts with the library name and
what each library "provides," then closes with an abstract trigger phrase. For
example, `libs-system-utilities`:

> "System utilities for infrastructure tasks. libutil provides hashing, token
> counting, and process execution. libsecret generates secrets and JWTs.
> libsupervise provides process supervision with restart policies. librc manages
> service lifecycles via Unix sockets. libcodegen generates code from Protocol
> Buffer definitions. Use for infrastructure automation, service management, or
> code generation."

The description text is the only surface the skill router sees at load time.
When an agent's task is "find the project root" or "retry this fetch" or "count
tokens in this string," none of those verbs appear in any `libs-*` description.
The router has no signal to load the right skill, so the agent falls back to
writing helpers from scratch.

This is the same diagnosis spec 130 made about the inner `Libraries` tables
("API-oriented rather than capability-oriented"). Spec 130 fixed those tables
but did not touch the frontmatter descriptions, which are what actually drive
auto-trigger. The router-level miss is still open.

### 2. Four libraries are not represented in any `libs-*` SKILL.md

`CLAUDE.md` § Skill Groups lists 33 libraries across six groups. Reality
diverges:

| Library       | Listed in CLAUDE.md group       | Present in SKILL.md? |
| ------------- | ------------------------------- | -------------------- |
| `libtool`     | `libs-llm-orchestration`        | **No**               |
| `libcli`      | `libs-web-presentation`         | **No**               |
| `librepl`     | `libs-web-presentation`         | **No**               |
| `libeval`     | `libs-system-utilities`         | **No**               |
| `libuniverse` | `libs-synthetic-data` (implied) | Body only, not table |

Five libraries are silently missing from the discovery surface. `libcli` is
particularly painful — spec 360 just landed it as the canonical CLI
infrastructure for the entire monorepo, and it has no entry in the skill that
should advertise it. The internal libraries Decision Guide for
libs-web-presentation also still says CLI/REPL belong outside its scope, even
though CLAUDE.md assigns `libcli` and `librepl` to that group.

### 3. The workflow has no discovery protocol

Library discovery is left to agent reflex. Nothing in the contributor or agent
workflow makes it a step:

- **CONTRIBUTING.md § READ-DO** has six items: task scope, smallest plan, read
  the code, simple over easy, no defensive code, clean breaks. None say "before
  writing a helper, search `libs-*` and `libraries/`." "Simple over easy"
  implies reuse but does not direct the agent to a specific surface.
- **`gemba-plan` SKILL.md** does not mention libraries. A plan author can write
  `plan-a.md` full of "create helper X," "add a retry wrapper," "write a JSONL
  parser" without ever enumerating which `libraries/` already do this.
- **`gemba-implement` SKILL.md** explicitly forbids deviation from the plan
  ("implement only what the plan describes — no unrequested refactors"). If the
  plan doesn't cite a library, the implementer cannot substitute one in without
  violating its own checklist.
- **Agent profiles** (`.claude/agents/*.md`) declare `skills:` lists that do not
  include any `libs-*` skill. The staff engineer — the agent that writes most of
  the implementation code — never has the library catalog loaded by default.

Discovery has to happen at plan time (because implement time is locked), but
plan time has no checklist that says "look for an existing library."

### 4. Trust erodes on every stale name

Spec 130 found 13+ wrong names and missing exports across the six libs-\* files
(e.g. `WindowBuilder` claimed but actual export is `MemoryWindow`; `VectorIndex`
claimed but not exported at all). Spec 130 fixed those once, manually. There is
no CI guard. Every library refactor can re-introduce the same class of error
silently. After one stale-name runtime error, an agent learns "the skill files
lie — reimplement instead." That trust loss reinforces every other failure mode.

The `bun run check:exports` script already exists for `package.json` exports
(spec 390). The same idea applied to `Key Exports` columns in `libs-*` SKILL.md
would close the staleness class structurally.

### 5. The current six groups have coherence and naming problems

Even with capability-rewritten descriptions, the current grouping has issues
worth addressing in the same pass:

| Current group                 | Members                                                                            | Coherence problem                                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs-service-infrastructure` | librpc, libconfig, libtelemetry, libtype, libharness                               | Cohesive, but `libtelemetry`'s logger is used by every CLI and library — burying it under "service infrastructure" hides it from CLI authors. |
| `libs-data-persistence`       | libstorage, libindex, libresource, libpolicy, libgraph, libvector                  | Cohesive. Six is the practical maximum.                                                                                                       |
| `libs-llm-orchestration`      | libllm, libmemory, libprompt, libagent, libtool                                    | Cohesive. `libtool` orphan needs to be added to the table.                                                                                    |
| `libs-web-presentation`       | libui, libformat, libweb, libdoc, libtemplate, **libcli, librepl**                 | Mis-grouped. CLI and REPL plumbing are not "web presentation." `libformat` (markdown to terminal) is half-CLI, half-content.                  |
| `libs-system-utilities`       | libutil, libsecret, libsupervise, librc, libcodegen, **libeval**                   | Junk drawer. Crypto, supervision, codegen, trace processing, file utilities have nothing to do with each other except "miscellaneous."        |
| `libs-synthetic-data`         | libsyntheticgen, libsyntheticprose, libsyntheticrender, **(libuniverse implicit)** | Cohesive. `libuniverse` (the pipeline) needs to be added to the table.                                                                        |

The two worst groups by capability-fit are `libs-web-presentation` (because
CLI/REPL belong elsewhere) and `libs-system-utilities` (junk drawer with no
shared task vocabulary). Group names like "system utilities" carry no signal to
the router or to a reader skimming the directory.

`libskill` lives outside `libs-*` entirely as a standalone skill, citing its
"pure functions exempt from OO+DI" status. This is a content-based exception
leaking into the taxonomy and fragments the "where do I look for shared code"
question.

## What changes

A single follow-up change with four moves: (1) close the orphan and drift gap,
(2) rewrite frontmatter descriptions in capability vocabulary, (3) add a
discovery protocol to the workflow, (4) add a CI guard against staleness. The
taxonomy reorganisation is part of move (1).

### Move 1 — Reorganise into six task-named groups, no orphans

Replace the current six groups with six **task-named** groups that cover all 33
shared libraries plus libskill. Renames are cheap (skill files are directories
that move; CLAUDE.md § Skill Groups updates) and worth doing in the same pass as
adding the orphans, because both moves change the same files.

| New group               | Members                                                                                   | Count | Rationale                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs-grpc-services`    | librpc, libconfig, libtelemetry, libtype, libharness                                      | 5     | Renamed from `libs-service-infrastructure`. Same membership. Name names the artifact you build (a gRPC service).                                                              |
| `libs-storage`          | libstorage, libindex, libresource, libpolicy, libgraph, libvector                         | 6     | Renamed from `libs-data-persistence`. Same membership. Shorter, sharper.                                                                                                      |
| `libs-llm-and-agents`   | libllm, libmemory, libprompt, libagent, **libtool**                                       | 5     | Renamed from `libs-llm-orchestration`. Adds `libtool`. Agents and tools belong with the LLM stack they wire into.                                                             |
| `libs-content`          | libui, libformat, libweb, libdoc, libtemplate                                             | 5     | Renamed from `libs-web-presentation`. Removes `libcli`/`librepl` (moved). Covers markdown, HTML, templates, web apps.                                                         |
| `libs-cli-and-tooling`  | **libcli**, **librepl**, libutil, libsecret, libsupervise, librc, libcodegen, **libeval** | 8     | Replaces `libs-system-utilities`. The unifying task is "build dev tooling around the stack" — CLIs, REPLs, utilities, process supervision, code generation, trace processing. |
| `libs-synthetic-data`   | libsyntheticgen, libsyntheticprose, libsyntheticrender, **libuniverse**                   | 4     | Same group, adds `libuniverse` to the table.                                                                                                                                  |
| `libskill` (standalone) | libskill                                                                                  | 1     | Stays standalone with renamed surface — see below. Domain logic for jobs/skills/agents has no peer in `libraries/`.                                                           |

Total: 33 libs in 6 groups + libskill standalone = 34. Every library in
`libraries/` appears in exactly one group.

`libs-cli-and-tooling` is the only large group (8 libs). Splitting it further
would produce single-purpose groups that lose to the broader skills in the
router; keeping it as one group with a verb-rich description is the better
trade-off.

`libskill` keeps its own skill file but the description is rewritten so it reads
as "domain logic for jobs, skills, agents, career progression" rather than "the
libskill package." Naming consistency is not worth a forced merge into a
`libs-*` group.

Rejected alternative — eight smaller groups: produces single-library skills
(e.g. `libs-codegen`) that lose router-selection competitions to broader sibling
skills. Five groups instead of six would force `libs-content` and
`libs-cli-and-tooling` to merge, recreating the junk drawer.

### Move 2 — Rewrite frontmatter descriptions in capability verbs

Every `libs-*` SKILL.md frontmatter `description` is rewritten as a verb-rich
list of the actual tasks the libraries perform. The skill router matches text in
this field, so this is the highest-leverage change.

Illustrative target shape (final wording belongs in the plan):

```yaml
name: libs-cli-and-tooling
description: >
  Use when building or modifying a CLI tool, running an interactive REPL
  session, parsing arguments, rendering help text or summary output, finding
  the project root, downloading and extracting tarballs, retrying flaky
  network calls with backoff, running child processes, counting LLM tokens,
  generating hashes or UUIDs, reading or writing .env files, generating JWTs
  or random secrets, supervising long-running daemons, managing service
  lifecycles, generating Protocol Buffer code, or processing Claude Code
  trace output.
```

The description must:

- Open with **"Use when …"** so the agent's task verb is the first lexical
  match.
- List capability verbs that match how an agent phrases a task ("retry a fetch,"
  "find project root," "supervise a daemon"), not library names.
- Cover every public capability of every library in the group. If a capability
  doesn't appear in the description, the router will not match it even if the
  body documents it perfectly.
- Stay under ~100 words so the router can skim it cheaply.

Each SKILL.md body keeps its existing `Libraries` table, Decision Guide,
Composition Recipes, and DI Wiring sections (already corrected by spec 130 for
the libraries that are not orphans). New entries are added for the four orphans.
The `Libraries` table column header changes from `Main API` / `Purpose` to
`Capabilities` / `Key Exports` (spec 130's plan-a §1 already proposed this for
the inner table; this spec extends it to the orphans and to the renamed groups).

### Move 3 — Add a library-survey step to planning and a discovery item to READ-DO

Two complementary additions:

**CONTRIBUTING.md § READ-DO** gains a new item:

> - [ ] **Look in `libs-*` first.** Before writing a helper, utility, or
>       wrapper, search the `libs-*` skill groups and `libraries/` for the
>       capability. Import, don't reinvent. If a library is missing the
>       capability, extend the library — don't fork it locally.

This applies to every contribution, human or agent. It is a one-line gate at the
natural pause point before writing new code.

**`gemba-plan` SKILL.md** gains a "Library survey" step before the plan is
written. The plan author lists every `@forwardimpact/lib*` package the plan will
use and names specific exports. The list lives in the plan, so when
`gemba-implement` reads the plan in step 2, the libraries are already in scope.
This makes discovery a plan-time decision that flows naturally into
implementation, instead of a reflex the implementer is structurally forbidden
from acting on.

The library survey is structured so that absence is visible: a plan that says
"this feature uses no shared libraries" is a flag for the reviewer, not a
default.

### Move 4 — CI guard against `Key Exports` drift

A new check in `bun run check` (and the `check-quality` CI workflow) asserts
that every entry in the `Key Exports` column of every `libs-*` SKILL.md resolves
against `grep "^export" libraries/<lib>/src/index.js`. The check fails if:

- A name in `Key Exports` is not exported from the library's `index.js`.
- A library listed in the group's table has no entry in `Key Exports`.

This is structurally identical to the existing `bun run check:exports` script
(spec 390), which validates that `package.json` `main`/`bin`/`exports` fields
resolve to real files. The new script lives alongside it as
`scripts/check-skill-exports.js`.

The reverse direction (every library export must appear somewhere in the skill
file) is intentionally **not** checked. Internal helpers and
implementation-detail exports do not need to be advertised. Only the positive
direction — "everything we advertise must exist" — is enforced.

## Success criteria

1. **No orphans.** Every library under `libraries/` (currently 34) appears in
   exactly one `libs-*` SKILL.md `Libraries` table or in the standalone
   `libskill` SKILL.md. Verifiable: a script that diffs `ls libraries/` against
   the union of `Libraries` table entries returns empty.

2. **Capability-language descriptions.** Every `libs-*` SKILL.md frontmatter
   `description` opens with "Use when" and contains a verb-rich list of tasks.
   No frontmatter description names a library by name in the first sentence.
   Verifiable by reading the six files.

3. **Six task-named groups.** The `libs-*` directory contains exactly six skill
   folders with the names from the table in Move 1. CLAUDE.md § Skill Groups
   matches. Verifiable: `ls .claude/skills/libs-*` and `grep "libs-" CLAUDE.md`.

4. **Discovery protocol live.** CONTRIBUTING.md § READ-DO contains the new "Look
   in `libs-*` first" item. `gemba-plan` SKILL.md contains a "Library survey"
   step that requires plans to enumerate the libraries they use. Verifiable by
   reading the two files.

5. **`bun run check` fails on `Key Exports` drift.** A new
   `scripts/check-skill-exports.js` runs as part of `bun run check` and the
   `check-quality` CI workflow. Manually breaking a `Key Exports` entry (e.g.
   renaming an export) makes `bun run check` fail with a clear error pointing at
   the SKILL.md line. Restoring the name makes the check pass.

6. **`libcli`, `librepl`, `libtool`, `libeval`, `libuniverse` are
   discoverable.** Each appears in its assigned group's `Libraries` table with
   `Capabilities` and `Key Exports` columns populated from the actual
   `index.js`. Verifiable by reading the six files.

7. **Agent profiles pre-load relevant libs-\* skills.** The
   `.claude/agents/staff-engineer.md` `skills:` list includes the `libs-*`
   skills the staff engineer needs at plan and implement time. Verifiable by
   reading the file.

## Out of scope

- **Re-architecting any library.** No code changes inside `libraries/*/src/`.
  This spec moves and renames documentation; library APIs are unchanged.
- **Forced migration of existing helpers to libs-\*.** Discovering existing
  duplication (pathway helpers that should move to libcli, etc.) is the
  follow-up. This spec creates the conditions; another spec acts on what it
  finds.
- **Changing `libskill`'s exemption from OO+DI.** libskill stays a pure-function
  library and stays in its own skill file.
- **Adding new libraries.** No new packages. The four orphans already exist.
- **Re-numbering or renaming the underlying `libraries/<libname>/`
  directories.** Group names change; package names do not.
- **Touching product (`fit-*`) skills.** Cross-linking from `fit-*` to `libs-*`
  is a worthwhile follow-up but is its own scope; this spec focuses on the
  library skills themselves and on the workflow surfaces that drive them.

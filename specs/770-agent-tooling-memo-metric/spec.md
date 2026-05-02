# Spec 770 — Agent tooling: `fit-wiki memo` and `fit-xmr record`

## Problem

Agents spend 5-15 turns on procedural wiki operations that produce no
value-bearing output. Grounded theory analysis across 33 traces (~10,500 turns,
Apr 17 -- May 2 2026) identified two hot paths:

**Cross-team observations.** An agent records a finding for a teammate by
reading `wiki/<target>.md`, locating the "Observations for Teammates" section,
composing an Edit with the right indentation, and writing the file. The trace
corpus shows this channel is asynchronous and unreliable: one observation went
10 days unacknowledged because the target agent never read the sender's summary.
Each observation costs the sender 3-5 tool calls (ls, Read summary, find
section, Edit) and the target agent an equivalent read-and-scan cost on every
boot.

**Metrics recording.** Every agent appends CSV rows to
`wiki/metrics/{agent}/{domain}/{YYYY}.csv` after completing primary work. The
procedure — discover the directory, read the CSV header, compose a `cat >>`
heredoc — costs 2-4 turns per append. The `{domain}` directory level adds a
discovery step that provides no analytical value: the CSV format already carries
a `metric` column that distinguishes metric names, and `fit-xmr analyze`
already filters by `--metric`. No agent has ever placed two semantically
different domains in a single CSV; the directory just mirrors what the rows
already encode.

Both paths are pure ceremony. The information is valuable; the file-finding and
format-matching are not.

## Goal

Two CLI commands that collapse the procedural overhead to a single invocation
each, so agents can record observations and metrics without spending thinking
tokens on file discovery, section parsing, or CSV formatting.

## Scope (in)

### 1. `fit-wiki memo` — cross-team observation command

A new `memo` subcommand on a new `fit-wiki` CLI, provided by a new `libwiki`
package (`@forwardimpact/libwiki`). The `fit-wiki` CLI is the operational
layer for wiki lifecycle management in the Kata agent system; `memo` is its
first subcommand. Future subcommands (refresh, push, pull, init) are scoped
in follow-up specs.

- **Machine-locatable insertion point.** Each agent summary file gains an
  insertion marker (such as `<!-- memo:inbox -->`) that `fit-wiki memo` uses
  to locate the "Observations for Teammates" section and append new bullets
  without reading or parsing the surrounding file. The marker is invisible
  in rendered markdown.
- **CLI surface.** Accepts sender, target (or broadcast to all agents), and
  message text. Produces one write per target agent.
- **Migration.** One-time insertion of the chosen marker into all existing
  agent summary files under `wiki/`.
- **Template update.** The summary section template in `memory-protocol.md`
  gains the insertion marker so that newly created summaries are
  memo-ready from creation.
- **Package.** `libwiki` is a new library under `libraries/libwiki` with
  `fit-wiki` as its CLI binary. It has no dependency on `libxmr` in this
  spec's scope (the `memo` subcommand does not need XmR analysis). The
  dependency is anticipated for follow-up work (`fit-wiki refresh`).

### 2. `fit-xmr record` — metrics recording command

A new `record` command on the existing `fit-xmr` CLI (provided by
`@forwardimpact/libxmr`) that appends a CSV row and prints a one-line XmR
summary.

- **Flat directory structure.** Metrics move from
  `wiki/metrics/{agent}/{domain}/{YYYY}.csv` to
  `wiki/metrics/{agent}/{YYYY}.csv` — one file per agent per year. The `domain`
  directory is removed. The `metric` column in each row already distinguishes
  metric names; `fit-xmr analyze --metric <name>` already filters by metric.
- **Migration.** All existing CSV data rows across an agent's per-domain files
  are consolidated into the flat file. Non-CSV content under `wiki/metrics/`
  (such as `staff-engineer/trace-analysis/exp14/`) is out of scope.
  Improvement-coach has no metrics directory and is not part of the metrics
  migration (memo migration only).
- **CLI surface.** Accepts agent name, metric name, value, and optional unit,
  run tag, and note. Resolves the CSV path, creates the file with header if
  missing, appends the row, then prints a one-line XmR summary for that
  metric using libxmr's existing analysis and formatting capabilities.
- **One-line summary.** After appending, the command prints a compact status
  line to stdout: metric name, n, status, latest value. This gives the agent
  immediate feedback without a separate `fit-xmr analyze` call.

### 3. Protocol and template updates

All protocol and template documents that reference the metrics storage path
or the summary section structure are updated to reflect the new flat path
and the memo insertion marker. Affected files:

- **`memory-protocol.md`** — Summary Contract documents the insertion marker;
  metrics path references use the flat structure.
- **`kata-metrics/SKILL.md`** and **`kata-metrics/references/csv-schema.md`**
  — Storage path, recording protocol, and analysis examples use the flat
  path and reference `fit-xmr record`.
- **`storyboard-template.md`** — Per-agent metric headings drop the domain
  qualifier (domain is implicit in the metric name). Example paths use the
  flat structure.
- **`fit-xmr` CLI help** — Example paths use the flat structure.

## Scope (out)

- Changes to the XmR statistical engine, chart rendering, signal detection, or
  classification logic in libxmr.
- Changes to `wiki/MEMORY.md` schema or the cross-cutting priority index.
- Changes to the weekly log format or the Tier 1/Tier 2 memory tier structure.
- Automated delivery confirmation for `fit-wiki memo` (the spec addresses the
  recording side; read-side acknowledgement is a separate concern).
- Changes to the storyboard session protocol (`kata-session`) beyond template
  path updates.
- Archival or deletion of historical metrics data — migration preserves all
  existing rows.

## Success criteria

| # | Claim | Verification |
|---|-------|--------------|
| 1 | `fit-wiki memo` appends a timestamped observation to the target agent's summary file in the correct section. | Run the command targeting one agent; `git diff` shows exactly one new bullet appended in the observations section with date and sender attribution. |
| 2 | `fit-wiki memo` with a broadcast target writes to every agent summary. | Run the command with broadcast; `git diff wiki/` shows one new bullet in each agent summary file. |
| 3 | `fit-xmr record` appends a row to the agent's flat metrics CSV and prints a one-line XmR summary to stdout. | Run the command; last line of the CSV matches the recorded metric. Stdout contains metric name, data point count, and XmR status. |
| 4 | `fit-xmr record` creates the CSV with header row when the file does not exist. | Run against a non-existent agent directory; file exists afterward with header + 1 data row. |
| 5 | All existing agent summary files contain the insertion marker after migration. | Each file matching `wiki/<agent>.md` (identified by the `# ... — Summary` H1) contains exactly one marker instance. |
| 6 | All existing metrics rows are preserved in the flat structure after migration. | Row count of each migrated flat CSV equals the total data rows across all source CSVs for that agent. |
| 7 | All protocol docs, templates, and CLI help reference the flat metrics path with no `{domain}` directory. | `grep -r '{domain}' .claude/agents/references/memory-protocol.md .claude/skills/kata-metrics/ .claude/skills/kata-session/references/storyboard-template.md libraries/libxmr/` returns zero matches. |
| 8 | `storyboard-template.md` uses `### {agent}` headings (not `### {agent} — {domain}`). | Static inspection of the template file. |
| 9 | `memory-protocol.md` "Summary Contract" documents the insertion marker as part of the permitted sections structure. | Static inspection; the marker format appears in the section 5 documentation. |

## Notes

### Evidence source

Findings are from the grounded theory trace analysis in
[`grounded-analysis.md`](grounded-analysis.md) (May 2 2026, committed
alongside this spec). Trace corpus: 33 structured traces from 18 workflow
runs. Key quantitative observations:

- 23/23 traced agent runs read `wiki/MEMORY.md` during boot.
- 56/63 `fit-xmr analyze` calls (89%) originate from the facilitator.
- Agents use `cat >> ... <<'EOF'` for CSV appends in 61 of 70 observed metric
  writes (87%); the remaining 9 use Edit.
- The boot sequence (protocol, wiki ls, own summary, MEMORY.md, storyboard,
  weekly log) is stable across all traced agent types.

### Domain removal rationale

Current domain directories and their contents:

| Agent | CSV domains | Metrics per domain | Non-CSV content |
|-------|------------|-------------------|-----------------|
| improvement-coach | _(none)_ | — | — |
| product-manager | backlog, evaluation | 1 each (`issues_triaged`, `issues_created`) | — |
| release-engineer | merge, release | 1 each (`prs_merged`, `releases_cut`) | — |
| security-engineer | audit, triage | 1 each (`findings_count`, `prs_actioned`) | — |
| staff-engineer | spec, implementation, trace | 1 each (`specs_drafted`, `implementations_shipped`, `findings_count`) | `trace-analysis/exp14/` (experiment NDJSON artifacts, not CSV — out of scope for migration) |
| technical-writer | documentation, wiki | 1 each (`errors_found`, `summary_corrections`) | — |

Every CSV domain directory contains exactly one metric. The
single-metric-per-skill protocol (ratified May 1 2026) makes multi-metric
domains structurally impossible going forward. The domain directory is redundant
storage for information already carried in the `metric` column.
Improvement-coach records no metrics of its own (the facilitator role records
coaching metrics under its own CSV).

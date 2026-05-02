# Spec 770 — Agent tooling: `fit-memo` and `fit-xmr record`

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

### 1. `fit-memo` — cross-team observation utility

A new CLI (new package or hosted in an existing library) that appends a
timestamped observation to a target agent's wiki summary file.

- **Marker-based insertion.** Each `wiki/<agent>.md` carries an HTML comment
  `<!-- memo:inbox -->` immediately before the "Observations for Teammates"
  heading. `fit-memo` inserts the new observation as a bullet after the marker,
  before any existing bullets. The marker is invisible in rendered markdown.
- **CLI surface.** Accepts sender, target (or `all` for broadcast), and
  message. Produces one write per target.
- **Migration.** One-time insertion of `<!-- memo:inbox -->` markers into all
  existing `wiki/<agent>.md` summary files (6 files: improvement-coach,
  product-manager, release-engineer, security-engineer, staff-engineer,
  technical-writer).
- **Template update.** The summary section template in `memory-protocol.md`
  (section 5 of the "Permitted sections" list: `## Observations for
  Teammates`) gains the `<!-- memo:inbox -->` marker so that newly created
  summaries include it automatically.

### 2. `fit-xmr record` — metrics recording command

A new `record` command on the existing `fit-xmr` CLI (provided by
`@forwardimpact/libxmr`) that appends a CSV row and prints a one-line XmR
summary.

- **Flat directory structure.** Metrics move from
  `wiki/metrics/{agent}/{domain}/{YYYY}.csv` to
  `wiki/metrics/{agent}/{YYYY}.csv` — one file per agent per year. The `domain`
  directory is removed. The `metric` column in each row already distinguishes
  metric names; `fit-xmr analyze --metric <name>` already filters by metric.
- **Migration.** Concatenate each agent's per-domain CSVs into a single file,
  preserving row order by date. Remove the empty domain directories.
  Non-CSV content under `wiki/metrics/` (such as experiment artifact
  directories) is out of scope for the CSV migration.
- **CLI surface.** Accepts agent name, metric name, value, and optional unit
  (default `count`), run tag (defaults to the CI run identifier when available),
  and note. Resolves the CSV path, creates the file with header if missing,
  appends the row, then prints a one-line XmR summary for that metric using
  libxmr's existing analysis and formatting capabilities.
- **One-line summary.** After appending, the command prints a compact status
  line to stdout: metric name, n, status, latest value. This gives the agent
  immediate feedback without a separate `fit-xmr analyze` call.

### 3. Protocol and template updates

- **`memory-protocol.md`** — Update the "Summary Contract" section to document
  the `<!-- memo:inbox -->` marker. Update the "Metrics tables" exclusion to
  reflect the flat `wiki/metrics/{agent}/{YYYY}.csv` path.
- **`kata-metrics/SKILL.md`** — Update the Storage section path from
  `wiki/metrics/{agent}/{domain}/{YYYY}.csv` to `wiki/metrics/{agent}/{YYYY}.csv`.
  Update recording protocol to reference `fit-xmr record` instead of manual
  `cat >>`. Update analysis examples to use the flat path.
- **`kata-metrics/references/csv-schema.md`** — Update the storage path
  reference.
- **`storyboard-template.md`** — Update the `### {agent} — {domain}` heading
  pattern to `### {agent}` (domain is now implicit in the metric name). Update
  example `fit-xmr` paths.
- **`fit-xmr` CLI help** — Update example paths in the CLI help output from
  the domain-based path to the flat path.

## Scope (out)

- Changes to the XmR statistical engine, chart rendering, signal detection, or
  classification logic in libxmr.
- Changes to `wiki/MEMORY.md` schema or the cross-cutting priority index.
- Changes to the weekly log format or the Tier 1/Tier 2 memory tier structure.
- Automated delivery confirmation for `fit-memo` (the spec addresses the
  recording side; read-side acknowledgement is a separate concern).
- Changes to the storyboard session protocol (`kata-session`) beyond template
  path updates.
- Archival or deletion of historical metrics data — migration preserves all
  existing rows.

## Success criteria

| # | Claim | Verification |
|---|-------|--------------|
| 1 | `fit-memo --from <sender> --to <target> "<message>"` appends a timestamped bullet to `wiki/<target>.md` immediately after the `<!-- memo:inbox -->` marker. | Run the command; `git diff wiki/<target>.md` shows exactly one new bullet with ISO date, sender attribution, and message text. No other lines changed. |
| 2 | `fit-memo --from <sender> --to all "<message>"` writes to all 6 agent summaries. | Run the command; `git diff wiki/` shows one new bullet in each of the 6 summary files. |
| 3 | `fit-xmr record --agent <name> <metric> <value>` appends a row to `wiki/metrics/<name>/{YYYY}.csv` and prints a one-line XmR summary to stdout. | Run the command; `tail -1 wiki/metrics/<name>/2026.csv` shows `<today>,<metric>,<value>,count,...`. Stdout contains metric name, n, status, and latest value. |
| 4 | `fit-xmr record` creates the CSV with header row when the file does not exist. | Run against a non-existent agent directory; file exists afterward with header + 1 data row. |
| 5 | All 6 existing agent summary files contain `<!-- memo:inbox -->` after migration. | `grep -c 'memo:inbox' wiki/*.md` returns 1 for each of the 6 agent summaries. |
| 6 | All existing metrics rows are preserved in the flat structure after migration. | `wc -l` on new flat CSVs equals sum of `wc -l` on old per-domain CSVs (minus duplicate header rows). |
| 7 | `memory-protocol.md`, `kata-metrics/SKILL.md`, `kata-metrics/references/csv-schema.md`, `storyboard-template.md`, and the `fit-xmr` CLI help output reference the flat path `wiki/metrics/{agent}/{YYYY}.csv` and mention no `{domain}` directory. | `grep -r '{domain}' .claude/agents/references/memory-protocol.md .claude/skills/kata-metrics/ libraries/libxmr/` returns zero matches. |
| 8 | `storyboard-template.md` uses `### {agent}` headings (not `### {agent} — {domain}`). | Static inspection of the template file. |
| 9 | `memory-protocol.md` "Summary Contract" section documents the `<!-- memo:inbox -->` marker as part of the permitted sections structure. | Static inspection; the marker appears in the section 5 documentation. |

## Notes

### Evidence source

Findings are from SCRATCHPAD-6.md (grounded theory trace analysis, May 2 2026).
Key quantitative observations:

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

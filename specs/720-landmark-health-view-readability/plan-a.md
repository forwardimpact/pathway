---
spec: 720
title: Landmark health view readability — plan A
status: plan draft
---

# Plan 720-A — Landmark Health View Readability

See [`spec.md`](./spec.md) for WHAT/WHY and [`design-a.md`](./design-a.md) for
WHICH/WHERE. This document captures HOW and WHEN.

## Approach

Land the rendering change in three layers: the CLI binary gains a per-command
`verbose` boolean and copies it onto `result.meta` before formatting; the
shared `formatters/health.js` gains two private helpers
(`dedupeRecommendations` and `renderScoreCells`) plus default-mode renderers;
the existing paragraph layout is reframed as the verbose path and consumes the
same `DedupedRec[]` (built once per call) so a `(candidate, skill)` pair shows
on the first driver only in both modes (success criterion 4). View shape and
JSON output are unchanged. Tests live in a new `health-formatter.test.js`
against an inline 6-driver synthetic view so the ≤50-line budget is asserted
directly. Doc updates land last so sample blocks copy verbatim from the
running CLI.

`Libraries used: none.`

## Step 1 — Add `verbose` per-command option to the CLI definition

**Intent.** Surface the boolean flag on the `health` command so libcli parses
it into `parsed.values.verbose`.

**Files:**

- modified: `products/landmark/bin/fit-landmark.js`

**Changes.** In the `commands` array, extend the `health` entry's `options`
map:

```js
{
  name: "health",
  description: "Show health view with driver scores and evidence",
  options: {
    manager: { type: "string", description: "Filter by manager email" },
    verbose: {
      type: "boolean",
      description: "Show every per-driver field including all percentile anchors",
    },
  },
},
```

No global option is added; `--verbose` is health-only by design.

**Verification.** `bunx fit-landmark health --help` lists `--verbose` under
"Command options". `bun run check` passes.

## Step 2 — Wire `meta.verbose` between handler and formatter

**Intent.** Copy `values.verbose` onto `result.meta` after the handler returns
so the dispatcher's `formatResult(command, result)` call gives every formatter
a populated `meta.verbose`. The handler itself is untouched — `meta.verbose` is
a CLI-binary concern, not a command concern.

**Files:**

- modified: `products/landmark/bin/fit-landmark.js`

**Changes.** Between the existing `entry.handler({...})` await and the
`formatResult(command, result)` call in `main()`, mutate the meta block:

```js
const result = await entry.handler({ ... });

if (result.meta) {
  result.meta.verbose = values.verbose === true;
}

const output = formatResult(command, result);
```

**Verification.** Asserted indirectly via the formatter tests in Step 6 — they
construct `meta` directly and assert that `meta.verbose === true` routes to
the verbose layout.

## Step 3 — Add `dedupeRecommendations` and `renderScoreCells` helpers

**Intent.** Land the two private helpers from the design's Interfaces table.
Both are module-private — no `export`.

**Files:**

- modified: `products/landmark/src/formatters/health.js`

**Changes.** Append below the existing `formatInitPct` helper (around line
36), keeping the existing `// Shared driver-section helpers` block heading:

```js
/**
 * Walk drivers → recommendations → candidates and emit one DedupedRec per
 * (candidate.email, rec.skill). Later occurrences extend driverNames.
 *
 * @param {Array} drivers
 * @returns {Array<{candidate: object, skill: string, impact: string,
 *   driverNames: string[]}>}
 */
function dedupeRecommendations(drivers) {
  const byKey = new Map();
  for (const driver of drivers) {
    for (const rec of driver.recommendations ?? []) {
      for (const candidate of rec.candidates ?? []) {
        const key = `${candidate.email}::${rec.skill}`;
        const existing = byKey.get(key);
        if (existing) {
          if (!existing.driverNames.includes(driver.name)) {
            existing.driverNames.push(driver.name);
          }
          continue;
        }
        byKey.set(key, {
          candidate,
          skill: rec.skill,
          impact: rec.impact,
          driverNames: [driver.name],
        });
      }
    }
  }
  return [...byKey.values()];
}

/**
 * Count non-null hidden anchors (vs_prev, vs_50th, vs_75th, vs_90th).
 * vs_org is the displayed anchor and is not counted.
 *
 * @param {object} driver
 * @returns {number}
 */
function countHiddenAnchors(driver) {
  let n = 0;
  for (const key of ["vs_prev", "vs_50th", "vs_75th", "vs_90th"]) {
    if (driver[key] != null) n += 1;
  }
  return n;
}

/**
 * Default-mode "Percentile" cell — ordinal only ("42nd"), without the
 * "percentile" word. The column header already labels the dimension.
 *
 * @param {object} driver
 * @returns {string}
 */
function formatPercentileCell(driver) {
  return driver.score != null
    ? `${driver.score}${ordinalSuffix(driver.score)}`
    : "n/a";
}

/**
 * Score cells for a driver row. Default mode returns the table tuple; verbose
 * mode returns a list of formatted anchor lines for the per-driver paragraph.
 *
 * @param {object} driver
 * @param {boolean} verbose
 * @returns {{percentile: string, vsOrg: string, more: string} | string[]}
 */
function renderScoreCells(driver, verbose) {
  if (verbose) {
    const lines = [];
    if (driver.vs_prev != null) lines.push(`vs_prev: ${formatDelta(driver.vs_prev)}`);
    if (driver.vs_org != null)  lines.push(`vs_org: ${formatDelta(driver.vs_org)}`);
    if (driver.vs_50th != null) lines.push(`vs_50th: ${formatDelta(driver.vs_50th)}`);
    if (driver.vs_75th != null) lines.push(`vs_75th: ${formatDelta(driver.vs_75th)}`);
    if (driver.vs_90th != null) lines.push(`vs_90th: ${formatDelta(driver.vs_90th)}`);
    return lines;
  }
  const hidden = countHiddenAnchors(driver);
  return {
    percentile: formatPercentileCell(driver),
    vsOrg: driver.vs_org != null ? formatDelta(driver.vs_org) : "n/a",
    more: hidden > 0 ? `+${hidden} anchors via --verbose` : "-",
  };
}
```

**Verification.** Direct unit tests added in Step 6 import the module and call
the helpers via the public renderers; lint passes (`bun run check`).

## Step 4 — Add default-mode text and markdown renderers

**Intent.** Implement the table + Recommendations trailer layout from the
design's Default Layout block.

**Files:**

- modified: `products/landmark/src/formatters/health.js`

**Changes.** Extend the existing `./shared.js` import to include `padRight`
(today's import omits it):

```js
import { formatDelta, ordinalSuffix, padRight, renderHeader } from "./shared.js";
```

Append a new section between the existing per-driver helpers and the public
API:

```js
// ---------------------------------------------------------------------------
// Default mode: compact table + Recommendations trailer
// ---------------------------------------------------------------------------

const TEXT_COLS = { num: 3, driver: 16, percentile: 12, vsOrg: 9, more: 28 };

function renderTextDefault(view, deduped, lines) {
  lines.push(`  Drivers (${view.drivers.length})`);
  lines.push("  " + "─".repeat(60));
  lines.push(
    "  " +
      padRight("#", TEXT_COLS.num) +
      padRight("Driver", TEXT_COLS.driver) +
      padRight("Percentile", TEXT_COLS.percentile) +
      padRight("vs_org", TEXT_COLS.vsOrg) +
      "More",
  );
  view.drivers.forEach((driver, i) => {
    const cells = renderScoreCells(driver, false);
    lines.push(
      "  " +
        padRight(String(i + 1), TEXT_COLS.num) +
        padRight(driver.name, TEXT_COLS.driver) +
        padRight(cells.percentile, TEXT_COLS.percentile) +
        padRight(cells.vsOrg, TEXT_COLS.vsOrg) +
        cells.more,
    );
  });
  if (deduped.length === 0) return;
  lines.push("");
  lines.push(`  Recommendations (${deduped.length} unique)`);
  lines.push("  " + "─".repeat(60));
  for (const rec of deduped) {
    const name = rec.candidate.name ?? rec.candidate.email;
    const drivers = rec.driverNames.join(", ");
    lines.push(
      `  - ${name} (${rec.candidate.currentLevel}) could develop ${rec.skill}` +
        ` — for ${drivers} (${rec.impact})`,
    );
  }
}

function renderMdDefault(view, deduped, lines) {
  lines.push(`## Drivers (${view.drivers.length})`);
  lines.push("");
  lines.push("| # | Driver | Percentile | vs_org | More |");
  lines.push("| --- | --- | --- | --- | --- |");
  view.drivers.forEach((driver, i) => {
    const cells = renderScoreCells(driver, false);
    const more = cells.more === "-" ? "-" : cells.more.replace(
      "--verbose",
      "`--verbose`",
    );
    lines.push(
      `| ${i + 1} | ${driver.name} | ${cells.percentile} | ${cells.vsOrg} | ${more} |`,
    );
  });
  if (deduped.length === 0) return;
  lines.push("");
  lines.push(`## Recommendations (${deduped.length} unique)`);
  lines.push("");
  for (const rec of deduped) {
    const name = rec.candidate.name ?? rec.candidate.email;
    const drivers = rec.driverNames.join(", ");
    lines.push(
      `- **${name}** (${rec.candidate.currentLevel}) could develop \`${rec.skill}\`` +
        ` — for ${drivers} (${rec.impact})`,
    );
  }
}
```

**Verification.** Default-mode tests in Step 6 assert column order, header
labels, presence of `--verbose` only when hidden anchors exist, and absence of
duplicated recommendations.

## Step 5 — Refactor `toText` and `toMarkdown` to dispatch on `meta.verbose`

**Intent.** Make both public formatters route on `meta.verbose`. Verbose path
keeps today's per-driver paragraph layout, but the score line is replaced by
the `renderScoreCells(driver, true)` lines and recommendations are filtered to
first-occurrence per `(email, skill)`.

**Files:**

- modified: `products/landmark/src/formatters/health.js`

**Changes.**

1. Update `renderTextDriver` and `renderMdDriver` so the score line consumes
   `renderScoreCells(driver, true)` and the comments/initiatives blocks remain.
   Replace today's score-line construction:

   ```js
   // before (renderTextDriver)
   const orgPart = driver.vs_org != null ? `vs_org: ${formatDelta(driver.vs_org)}` : "";
   const scorePart = formatScorePart(driver);
   lines.push(
     `    Driver: ${driver.name} (${scorePart}${orgPart ? ", " + orgPart : ""})`,
   );

   // after
   const anchorLines = renderScoreCells(driver, true);
   lines.push(`    Driver: ${driver.name} (${formatScorePart(driver)})`);
   if (anchorLines.length > 0) {
     lines.push(`      Anchors: ${anchorLines.join(", ")}`);
   }
   ```

   Mirror in `renderMdDriver` (using a `**Anchors:** …` line under the H2).

2. Replace `renderTextRecommendations` and `renderMdRecommendations` so they
   accept the `DedupedRec[]` array and the current driver's name, and emit
   only entries whose `driverNames[0]` equals the current driver (i.e. the
   first-occurrence driver). Existing `(email, skill)` pairs that first
   appeared on an earlier driver are skipped:

   ```js
   function renderTextRecommendations(driver, lines, deduped) {
     const mine = deduped.filter((d) => d.driverNames[0] === driver.name);
     if (mine.length === 0) return;
     for (const rec of mine) {
       lines.push("");
       const candidate = rec.candidate;
       const phrase = `${candidate.name ?? candidate.email} (${candidate.currentLevel})`;
       lines.push(`      ⮕ Recommendation: ${phrase} could develop ${rec.skill}.`);
       lines.push(`        (Summit growth alignment: ${rec.impact})`);
     }
   }
   ```

   Mirror in `renderMdRecommendations`. Each `DedupedRec` corresponds to a
   single `(candidate, skill)`, so the verbose layout no longer collapses
   multi-candidate recs onto one line — each candidate gets its own
   recommendation line on the driver where the pair first occurs. This is
   intentional and matches the dedup contract.

3. Update `toText` and `toMarkdown` to accept `meta` and dispatch on
   `meta.verbose`. Both paths consume the same `DedupedRec[]`:

   ```js
   export function toText(view, meta) {
     const lines = [renderHeader(`${view.teamLabel} — health view`), ""];
     const deduped = dedupeRecommendations(view.drivers);
     if (meta?.verbose) {
       for (const driver of view.drivers) {
         renderTextDriver(driver, lines, deduped);
       }
     } else {
       renderTextDefault(view, deduped, lines);
     }
     return lines.join("\n");
   }
   ```

   Mirror in `toMarkdown`. `toJson` is untouched.

4. `renderTextDriver` and `renderMdDriver` gain a `deduped` parameter and
   forward it to the recommendations renderer.

**Verification.** Verbose-mode tests in Step 6 assert (a) score line carries
`Anchors:` with all four hidden deltas, (b) a candidate-skill pair appearing
on two drivers renders only on the first.

## Step 6 — Tests for the formatter

**Intent.** Add a new test file that calls `toText` and `toMarkdown` directly
with synthetic `HealthView` + `Meta` shapes. The existing `health.test.js`
covers the command and is left alone.

**Files:**

- created: `products/landmark/test/health-formatter.test.js`

**Changes.** New file, ~150 lines, organized as one `describe` with cases:

| Case | Input | Assertion |
| --- | --- | --- |
| default fits ≤ 50 lines on 6 drivers | 6-driver `HealthView`, all four hidden anchors set, 3 recommendations | `output.split("\n").length <= 50` |
| default header is plural-anchored | 6-driver view | line containing `Drivers (6)` exists; the next non-rule line equals exactly `"  # Driver          Percentile  vs_org   More"` (literal, including padding) |
| default driver row layout matches design | one driver `Quality`, score 42, `vs_org=-10`, `vs_prev=-5`, `vs_50th=-8`, `vs_75th=-25`, `vs_90th=-40` | row equals `"  1  Quality          42nd        -10      +4 anchors via --verbose"` |
| default `More` cell counts hidden anchors only | driver with `vs_prev=-2`, `vs_org=-4`, `vs_50th=null`, `vs_75th=null`, `vs_90th=null` | row contains `+1 anchors via --verbose` (vs_org is not counted) |
| default `More` cell shows `-` when all hidden anchors null | driver with all four hidden = null, `vs_org=-4` | row's `More` cell is `-` |
| default Recommendations trailer dedups across drivers | two drivers each carrying `{candidate: bob, skill: planning}` | `output.match(/could develop/g).length === 1` |
| default Recommendations names every driver the rec applies to | rec spanning Quality + Reliability | trailer line contains `for Quality, Reliability` |
| default no trailing blank line when no recs | view with empty recommendations on every driver | `output.endsWith("\n\n") === false` and no `Recommendations` heading |
| verbose anchors line lists all five | driver with all four hidden + vs_org set | output contains `Anchors: vs_prev: -5, vs_org: -10, vs_50th: -8, vs_75th: -25, vs_90th: -40` |
| verbose recommendation appears once across drivers | same as default-dedup case | `output.match(/⮕ Recommendation/g).length === 1` |
| verbose preserves comments and initiatives | driver with one comment + one initiative | output contains `GetDX comments:` and `Active initiatives:` |
| markdown default header is exactly 5 cells in design order | any view | header row equals `"\| # \| Driver \| Percentile \| vs_org \| More \|"` and separator `"\| --- \| --- \| --- \| --- \| --- \|"` |

The 6-driver fixture is built inline in the test file (not added to
`fixtures.js`) because no other test consumes it. The shape mirrors
`MAP_DATA.drivers` plus four extra synthetic driver names.

**Verification.** `bun test products/landmark/test/health-formatter.test.js`
passes; `bun run check` reports zero new lint errors.

## Step 7 — Update product page and leadership getting-started page

**Intent.** Replace the existing one-paragraph health-view description with
the new shape: a literal `--verbose` mention, a sample of the new default
output, and no stale claims.

**Files:**

- modified: `websites/fit/landmark/index.md`
- modified: `websites/fit/docs/getting-started/leadership/landmark/index.md`

**Changes.**

1. `websites/fit/landmark/index.md` `#### Health` block (lines 89–96):
   - Replace the single `npx fit-landmark health [--manager <email>]` block
     with two side-by-side blocks: default and `--verbose`, each followed by a
     sample output snippet (≤8 lines) drawn from the test fixture.
   - Replace the descriptive paragraph with: "Default output is a compact
     table of drivers with one anchor per row; pass `--verbose` for the full
     per-driver paragraph layout including all percentile anchors, GetDX
     comments, contributing-skill evidence, and active initiatives."

2. `websites/fit/docs/getting-started/leadership/landmark/index.md` `## View
   team health` block (lines 160–172):
   - Add the `--verbose` invocation under the existing default invocation.
   - Replace the "For each driver Landmark shows…" paragraph with one that
     describes the default table layout and points to `--verbose` for the
     paragraph layout.
   - Insert a short sample of the default output (≤8 lines).

3. Verify no other doc page contains a stale description of the health view's
   layout. `rg "fit-landmark health" websites/` already inventoried in design
   research — the engineering-outcomes doc references the command but does
   not describe its layout, so it stays.

**Verification.** `bunx fit-doc build --src=websites/fit` succeeds; both pages
contain a literal `--verbose` mention and a sample block.

## Risks

| Risk | Mitigation |
| --- | --- |
| Production driver names (`"Codebase Experience"`, `"Clear Direction"`) exceed `TEXT_COLS.driver = 16`, producing silently misaligned rows that no current fixture catches. | Add a single test case using a 17-char driver name and assert the row aligns; bump the constant if needed. The plan's test fixture uses synthetic short names so this only surfaces post-merge against real data. |
| `result.meta` is mutated in the binary, but the handler-formatter contract is not documented as allowing it; a future refactor that freezes `meta` post-handler would silently drop `--verbose`. | The freezing risk is invisible from the plan because `formatResult` already reads `meta.format` via the same channel. Flagged so a future invariant tightening surfaces this site. |

## Execution

Single agent (`staff-engineer`), sequential. Steps 1–2 (CLI binary) and Steps
3–5 (formatter) can be drafted in either order but must both land before Step
6 (tests reference the new helpers and the new dispatcher state). Step 7
(docs) lands last so the sample output blocks copy verbatim from the running
CLI.

— Staff Engineer 🛠️

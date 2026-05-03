# Plan A — Spec 660: Map Product Page Activity-Layer Walkthrough

## Approach

Edit `websites/fit/map/index.md` to split the existing `## Getting Started`
block into two `###` subsections — **Standard layer** (the existing three
commands) and **Activity layer** (one sentence naming Supabase + a labelled
link to `websites/fit/docs/getting-started/leadership/map/index.md#activity-install-the-supabase-cli`).
Add `scripts/check-map-page.mjs` to encode the two coupling invariants from
the design's Drift-Mitigation table; wire it into `package.json` via a new
`docs` chain that `check` invokes.

## Files

| Change   | Path                         |
| -------- | ---------------------------- |
| modified | `websites/fit/map/index.md`  |
| created  | `scripts/check-map-page.mjs` |
| modified | `package.json`               |

## Steps

### 1. Restructure `websites/fit/map/index.md` Getting Started

Replace lines 46–65 (the current `## Getting Started` block plus its single
`<div class="grid">` Leadership card). Keep the H2 title `## Getting Started`
unchanged. Keep the Leadership card unchanged below the new subsections.

Before:

```md
## Getting Started

\`\`\`sh
npm install @forwardimpact/map
npx fit-map init
npx fit-map validate
\`\`\`

<div class="grid">

<a href="/docs/getting-started/leadership/map/">

### Leadership

Initialize your agent-aligned engineering standard, validate schemas, set up the
activity layer, and ingest operational signals from GitHub and GetDX.

</a>

</div>
```

After:

```md
## Getting Started

### Standard layer

Define your agent-aligned engineering standard and validate it.

\`\`\`sh
npm install @forwardimpact/map
npx fit-map init
npx fit-map validate
\`\`\`

### Activity layer

The activity layer adds operational signals — organization people, GitHub
activity, and GetDX snapshots — on top of Supabase. Set up Supabase and run the
ingestion commands by following the leadership guide:

[Set up the activity layer →](/docs/getting-started/leadership/map/#activity-install-the-supabase-cli)

<div class="grid">

<a href="/docs/getting-started/leadership/map/">

### Leadership

Initialize your agent-aligned engineering standard, validate schemas, set up the
activity layer, and ingest operational signals from GitHub and GetDX.

</a>

</div>
```

Three contractual properties the implementer must preserve verbatim:

1. The string `Supabase` appears in the Activity-layer subsection prose,
   syntactically before any `<a>` in the same subsection.
2. The link target ends with `#activity-install-the-supabase-cli`.
3. The visible link text contains the word `activity` (case-insensitive). The
   exact wording above (`Set up the activity layer →`) satisfies this; if the
   implementer changes the wording, it must still contain `activity`.

**Verification:** `bun scripts/check-map-page.mjs` exits 0 (after step 2 and 3).

### 2. Create `scripts/check-map-page.mjs`

New file modelled on `scripts/check-libharness.mjs` (no test runner, plain
node script with `process.exit(status)`).

```js
#!/usr/bin/env node
// Spec 660: enforce the activity-layer entry-point invariants between the
// Map product page Getting Started block and the leadership guide.
// Called from `bun run check` via `bun run docs`.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
let status = 0;
const fail = (msg) => {
  console.error(`error: ${msg}`);
  status = 1;
};

const productPage = await readFile(
  resolve(root, "websites/fit/map/index.md"),
  "utf8",
);
const leadershipGuide = await readFile(
  resolve(root, "websites/fit/docs/getting-started/leadership/map/index.md"),
  "utf8",
);

// Locate the Getting Started block on the product page (H2 to next H2).
const gsMatch = productPage.match(
  /\n## Getting Started\n([\s\S]*?)(?=\n## |\Z)/,
);
if (!gsMatch)
  fail("websites/fit/map/index.md: '## Getting Started' section not found");
const gettingStarted = gsMatch ? gsMatch[1] : "";

// Invariant 1 (criterion 2): "Supabase" appears in Getting Started before
// the activity-layer link.
const supabaseIdx = gettingStarted.search(/supabase/i);
const linkIdx = gettingStarted.search(/#activity-install-the-supabase-cli/);
if (supabaseIdx === -1)
  fail("websites/fit/map/index.md: '## Getting Started' must name 'Supabase'");
if (linkIdx === -1)
  fail(
    "websites/fit/map/index.md: '## Getting Started' must link to '#activity-install-the-supabase-cli'",
  );
if (supabaseIdx !== -1 && linkIdx !== -1 && supabaseIdx > linkIdx)
  fail(
    "websites/fit/map/index.md: 'Supabase' must appear before the activity-layer link in Getting Started",
  );

// Invariant 2 (criterion 4): the visible link text contains 'activity'.
const linkRe = /\[([^\]]*)\]\([^)]*#activity-install-the-supabase-cli\)/;
const linkMatch = gettingStarted.match(linkRe);
if (!linkMatch)
  fail(
    "websites/fit/map/index.md: activity-layer link not found in markdown link form",
  );
else if (!/activity/i.test(linkMatch[1]))
  fail(
    `websites/fit/map/index.md: activity-layer link text '${linkMatch[1]}' must contain 'activity'`,
  );

// Invariant 3 (criteria 1, 3, 4 — link target): leadership guide carries the
// '## Activity: install the Supabase CLI' heading that produces the anchor.
if (!/\n## Activity: install the Supabase CLI\n/.test(leadershipGuide))
  fail(
    "websites/fit/docs/getting-started/leadership/map/index.md: heading '## Activity: install the Supabase CLI' is the contractual anchor target — do not rename without updating the product page link",
  );

// Invariant 4 (criterion 5): no stages.yaml reference on the product page.
if (/stages\.yaml/.test(productPage))
  fail(
    "websites/fit/map/index.md: 'stages.yaml' must not appear (regression guard)",
  );

process.exit(status);
```

**Verification:** `bun scripts/check-map-page.mjs` exits 0 against the
post-step-1 file; mutate any of the four invariants and the script exits 1
with a precise error.

### 3. Wire into `package.json`

Add a `docs` script entry and append it to the `check` chain.

Before (`scripts.check`):

```json
"check": "bun run format && bun run lint && bun run harness && bun run context",
```

After:

```json
"check": "bun run format && bun run lint && bun run harness && bun run context && bun run docs",
"docs": "bun scripts/check-map-page.mjs",
```

Place `"docs"` adjacent to `"context"` in the scripts block.

**Verification:** `bun run check` exits 0; `bun run docs` exits 0; reverting
step 1 makes `bun run docs` exit 1.

### 4. Verify the user-facing reading path manually

Run `bunx fit-doc serve --src=websites/fit --watch`, open
`http://localhost:<port>/map/`, click the activity-layer link, and confirm
the browser scrolls to the **Activity: install the Supabase CLI** heading on
the leadership guide page.

**Verification:** the anchor lands correctly; from there, top-down reading
reaches `MAP_SUPABASE_URL` (in `## Activity: start the database`) and then
`fit-map activity verify` (in `## Activity: verify the data`), satisfying
spec criteria 1 + 3.

## Libraries used

`Libraries used: none.` (`node:fs/promises` and `node:path` only.)

## Risks

| Risk                                                                                                                  | Mitigation                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `fit-doc` slug generation diverges from `#activity-install-the-supabase-cli` in a future build pipeline change.       | Step 2's invariant 2 fails fast (the leadership-guide heading must remain literal); a slug-generation change requires updating the product page link in the same PR. |
| The `<div class="grid">` audience card below Getting Started might be parsed as part of the Getting Started H2 block. | The check uses `(?=\n##                                                                                                                                              | \Z)` to bound at the next H2; verify in step 3 that the regex captures only intended subsection content. (Validated against current file.) |
| A future copyedit replaces `[Set up the activity layer →]` with non-link prose.                                       | Step 2 invariant 2 (`linkRe`) requires the markdown link form; any plain-prose rewrite breaks the check.                                                             |

## Execution

| Part   | Agent            | Sequencing                                       |
| ------ | ---------------- | ------------------------------------------------ |
| Step 1 | `staff-engineer` | sequential — step 1 before step 2                |
| Step 2 | `staff-engineer` | sequential — step 2 before step 3                |
| Step 3 | `staff-engineer` | sequential — step 3 before step 4                |
| Step 4 | `staff-engineer` | sequential — manual verification with dev server |

Single PR; one implementer; no parallelism opportunity.

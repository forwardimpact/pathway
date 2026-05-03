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

// Locate the Getting Started block on the product page (H2 to next H2 or EOF).
// `$` without the `m` flag matches end-of-input, which covers the case where
// `## Getting Started` is the last H2 in the file.
const gsMatch = productPage.match(
  /\n## Getting Started\n([\s\S]*?)(?=\n## |$)/,
);
if (!gsMatch)
  fail("websites/fit/map/index.md: '## Getting Started' section not found");
const gettingStarted = gsMatch ? gsMatch[1] : "";

// Invariant 1 (design Drift-Mitigation row 1, spec criterion 2):
// "Supabase" appears as standalone prose (not embedded in a slug like
// `supabase-cli` or a URL path) before the activity-layer link in the
// Getting Started block. The lookbehind/lookahead excludes URL-embedded
// occurrences so a future copyedit that drops the prose mention but leaves
// the link URL `#activity-install-the-supabase-cli` does NOT silently pass.
const proseRe = /(?<![/-])[Ss]upabase(?![/-])/;
const proseMatch = gettingStarted.match(proseRe);
const linkIdx = gettingStarted.search(/#activity-install-the-supabase-cli/);
if (!proseMatch)
  fail(
    "websites/fit/map/index.md: '## Getting Started' must name 'Supabase' in prose (not only in a link URL)",
  );
if (linkIdx === -1)
  fail(
    "websites/fit/map/index.md: '## Getting Started' must link to '#activity-install-the-supabase-cli'",
  );
if (proseMatch && linkIdx !== -1 && proseMatch.index > linkIdx)
  fail(
    "websites/fit/map/index.md: prose 'Supabase' must appear before the activity-layer link in Getting Started",
  );

// Invariant 2 (design Drift-Mitigation row 2 — link form, spec criterion 4):
// the markdown link is well-formed and its visible text contains 'activity'.
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

// Invariant 3 (design Drift-Mitigation row 2 — anchor target, spec criteria
// 1 + 3): the leadership guide carries the '## Activity: install the
// Supabase CLI' heading that produces the contractual anchor.
if (!/\n## Activity: install the Supabase CLI\n/.test(leadershipGuide))
  fail(
    "websites/fit/docs/getting-started/leadership/map/index.md: heading '## Activity: install the Supabase CLI' is the contractual anchor target — do not rename without updating the product page link",
  );

// Invariant 4 (spec criterion 5, regression guard): no `stages.yaml`
// reference anywhere on the product page. Spec criterion 5 scopes this
// check to the entire file, not the Getting Started subsection.
if (/stages\.yaml/.test(productPage))
  fail(
    "websites/fit/map/index.md: 'stages.yaml' must not appear (regression guard)",
  );

process.exit(status);

# Plan — Spec 750 (terrain refactor CI follow-ups)

## Approach

Sweep every `bunx fit-terrain` invocation in the spec's named surface onto the
verb assignment from `design-a.md`, drop `LOG_LEVEL=error` on `data:prose`,
remove the `kata-release-merge` Step 5 carve-out, add a static gate that fails
CI on any bare `bunx fit-terrain` in the named surface, and update the two
contributor docs that name `synthetic-no-prose`.

## Steps

### S1 — Update `justfile` synthetic recipes

- **Modified:** `justfile`.
- **Change:**

  ```diff
   synthetic:
  -    bunx fit-terrain
  +    bunx fit-terrain build
       bunx fit-map generate-index

   synthetic-update:
  -    bunx fit-terrain --generate
  +    bunx fit-terrain generate
       bunx fit-map generate-index

  -# Generate synthetic data (structural only, no prose)
  -synthetic-no-prose:
  -    bunx fit-terrain --no-prose
  -    bunx fit-map generate-index
  ```

- **Verify:** `just --summary | grep -w synthetic-no-prose` is empty;
  `just --evaluate synthetic` (or inspecting the recipe body) shows
  `bunx fit-terrain build` on the first action line.

### S2 — Update root `package.json` scripts

- **Modified:** `package.json` (`scripts.generate`, `scripts.data:prose`).
- **Change:**
  ```diff
  -    "generate": "fit-terrain",
  +    "generate": "fit-terrain build",
  -    "data:prose": "LOG_LEVEL=error bunx fit-terrain check",
  +    "data:prose": "bunx fit-terrain check",
  ```
- **Verify:** `bun run data:prose` exits 0 on a populated cache and prints the
  cache report at default log level; `jq -r '.scripts.generate' package.json`
  prints `fit-terrain build`.

### S3 — Update CI workflows

Verified line numbers via
`grep -n 'bunx fit-terrain' .github/workflows/*.{yml,yaml}` (4 hits).
`check-data.yml` is not modified — it has no `bunx fit-terrain` invocation (it
calls `bun run data:prose` / `data:schema`, both fixed in S2).

- **Modified:**
  - `.github/workflows/check-test.yml` (line 18, `test` job, `- run:` form).
  - `.github/workflows/interview-landmark-setup.yml` (line 57, in shell
    heredoc).
  - `.github/workflows/interview-map-setup.yml` (line 55, in shell heredoc).
  - `.github/workflows/interview-summit-setup.yml` (line 57, in shell heredoc).
- **Change (each file, single occurrence):** `bunx fit-terrain` →
  `bunx fit-terrain build`. Example for `check-test.yml:18`:
  ```diff
  -      - run: bunx fit-terrain
  +      - run: bunx fit-terrain build
  ```
  Example for the three `interview-*-setup.yml` files (line numbers above):
  ```diff
  -          bunx fit-terrain
  +          bunx fit-terrain build
  ```
- **Verify:** `grep -nE 'bunx fit-terrain($|[^[:alnum:]_-])' .github/workflows/`
  returns four lines, each with `build` immediately following
  `bunx fit-terrain`.

### S4 — Remove `kata-release-merge` Step 5 carve-out

- **Modified:** `.claude/skills/kata-release-merge/SKILL.md` (line 122–123).
- **Change:**
  ```diff
  -After rebase, run `bun run check:fix` then `bun run check`. If checks still fail
  -(excluding expected validation failures from missing `data/pathway/`), mark
  -**blocked** with the failures and skip to Step 9.
  +After rebase, run `bun run check:fix` then `bun run check`. If checks still
  +fail, mark **blocked** with the failures and skip to Step 9.
  ```
- **Verify:**
  `grep -n 'data/pathway' .claude/skills/kata-release-merge/SKILL.md` returns no
  matches.

### S5 — Add static "no bare `bunx fit-terrain`" gate

- **Created:** `scripts/check-terrain-callers.mjs`.
- **Body (full):**

  ```js
  #!/usr/bin/env node
  // Fail if any file in the spec 750 named surface (justfile, package.json,
  // .github/workflows/**) calls `bunx fit-terrain` without one of the
  // accepted verbs. Called by `bun run context:terrain`.
  import { readFile, readdir } from "node:fs/promises";
  import { resolve, join } from "node:path";

  const root = resolve(new URL("..", import.meta.url).pathname);
  const VERBS = ["check", "validate", "build", "generate", "inspect"];
  // `inspect` is allowed bare in this gate; the CLI itself enforces
  // `inspect <stage>` and reports its own usage error.
  const PATTERN = new RegExp(
    String.raw`\bbunx\s+fit-terrain\b(?!\s+(?:${VERBS.join("|")})\b)`,
  );

  async function listWorkflows() {
    const dir = resolve(root, ".github/workflows");
    const entries = await readdir(dir);
    return entries
      .filter((n) => n.endsWith(".yml") || n.endsWith(".yaml"))
      .map((n) => join(dir, n));
  }

  const targets = [
    resolve(root, "justfile"),
    resolve(root, "package.json"),
    ...(await listWorkflows()),
  ];

  let status = 0;
  for (const path of targets) {
    const text = await readFile(path, "utf8");
    text.split("\n").forEach((line, i) => {
      if (PATTERN.test(line)) {
        console.error(
          `${path}:${i + 1}: bare 'bunx fit-terrain' — add a verb (${VERBS.join("|")})`,
        );
        status = 1;
      }
    });
  }
  process.exit(status);
  ```

- **Modified:** `package.json` (`scripts.context` chain), `justfile` (new
  recipe).
- **`package.json` wiring:**
  ```diff
  -    "context": "bun run context:instructions && bun run context:metadata && bun run context:catalog",
  +    "context": "bun run context:instructions && bun run context:metadata && bun run context:catalog && bun run context:terrain",
  +    "context:terrain": "node scripts/check-terrain-callers.mjs",
  ```
- **`justfile` wiring (append after `check-instructions`):**
  ```just
  # Enforce no bare `bunx fit-terrain` in the named surface (spec 750)
  check-terrain-callers:
      node scripts/check-terrain-callers.mjs
  ```
- **Verify:** introduce a temporary bare `bunx fit-terrain` in `justfile`;
  `node scripts/check-terrain-callers.mjs` exits 1 with the line cite; revert;
  `bun run context:terrain` exits 0; `bun run check` passes end-to-end.

### S6 — Update contributor docs

- **Modified:**
  - `websites/fit/docs/getting-started/contributors/index.md` — in the "Other
    generation modes" sh code block (line 48), delete the line
    `just synthetic-no-prose   # Structural data only, no prose content`. The
    surrounding `just synthetic` and `just synthetic-update` bullets remain.
  - `websites/fit/docs/internals/operations/index.md` — in the "Generation" sh
    code block (line 104), delete the `just synthetic-no-prose …` line. In the
    prose paragraph immediately after (lines 107–109), drop the trailing
    sentence that begins "The `no-prose` mode produces…", leaving the
    `synthetic-update` sentence as the paragraph's final line.
- **Verify:** `grep -rn 'synthetic-no-prose' websites/ .claude/ CONTRIBUTING.md`
  returns no hits.

### S7 — Verify CI green on the impl PR and on `main` post-merge

- **Action:** push S1–S6 on the implementation branch; await `Test` and `Data`
  workflows; merge; confirm post-merge `main` runs are green.
- **Verify:**
  - Pre-merge: `gh pr checks <impl-pr>` — `e2e` and `prose` both `pass`.
  - Post-merge: `gh run list --workflow=Test --branch main --limit 1` and
    `gh run list --workflow=Data --branch main --limit 1` — `e2e` and `prose`
    each report `success`.

### S8 — Clean-checkout replay (success criterion 6)

- **Action:** in a fresh clone, run `bun install`, then `just quickstart`, then
  `bun start`.
- **Verify:** `quickstart` completes without error; `bun start` clears
  `prestart` (no `ENOENT` on `data/pathway/`); `serve` binds and the home page
  responds 200.

## Libraries used

`Libraries used: none.`

## Risks

| Id  | Risk                                                                                                                                         | Why not visible from the plan                                                                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | The `Test (e2e)` `synthetic-cache` is hit on the impl branch (key includes `data/synthetic/**` only), masking the miss-path fix.             | The cache is keyed on `hashFiles('data/synthetic/**', 'products/map/schema/json/**', 'bun.lock')`, not on branch — to force a miss, the implementer must touch any file under `data/synthetic/**` (a no-op edit suffices) before pushing.      |
| P2  | The `bun start` `prestart` hook in S8 fails because `bunx fit-pathway build` reads `data/pathway/` from a path the sweep didn't materialize. | The implementer cannot tell from the plan whether `quickstart`'s `synthetic` recipe has emitted `data/pathway/` to the same root that `fit-pathway build` reads from; verify before declaring S8 green.                                        |
| P3  | The static gate (S5) green-lights legitimate verb invocations broken across multiple lines (e.g., shell line-continuation inside a heredoc). | The line-by-line regex cannot see across `\` line continuations; the gate over-permits in that shape. The four heredoc workflow files do not currently use line-continuation around the call, but the implementer should re-check after merge. |

## Execution

Sequential agent: **`staff-engineer`**. Single PR landing S1–S6 in one commit
chain, with S7 (CI green) as the merge gate and S8 (clean-checkout replay)
performed once before applying `plan:implemented`.

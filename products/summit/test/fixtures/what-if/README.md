# `what-if` snapshot fixtures

Captured outputs of `runWhatIfCommand` for the five non-move scenarios in all
three output formats (`.txt`, `.json`, `.md`). Used by
`products/summit/test/what-if.test.js` to assert byte-identity across the
spec 830 refactor that introduces two-sided `--move` rendering.

## Regenerating

```sh
node products/summit/test/fixtures/what-if/regenerate.mjs
```

The script imports the post-refactor formatter and aggregation surface, loops
over the rows in `rows.mjs`, and writes one file per (scenario, format) into
this directory. It runs under `node` (not `bun`) to match the production
handler's serialization exactly.

## Roster

The fixtures use `FIXTURE_ROSTER` from `products/summit/test/fixtures.js`
(loaded via `loadStarterData()`). No new fixture roster is introduced.

## Scenario rows

| scenario-id     | `target`                          | `cliOpts`                                                                          |
| --------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| `add-reporting` | `{ teamId: "platform" }`          | `{ add: "{ discipline: software_engineering, level: J060 }" }`                     |
| `add-project`   | `{ projectId: "migration-q2" }`   | `{ add: "{ discipline: software_engineering, level: J060 }", allocation: "0.5" }`  |
| `remove`        | `{ teamId: "platform" }`          | `{ remove: "Bob" }`                                                                |
| `promote`       | `{ teamId: "platform" }`          | `{ promote: "Carol" }`                                                             |
| `promote-focus` | `{ teamId: "platform" }`          | `{ promote: "Carol", focus: "delivery" }`                                          |

The single source of truth is `rows.mjs`, imported by both `regenerate.mjs`
and the byte-identity tests.

## Invariants

- **Fixtures are regenerated only when the upstream contract intentionally
  changes** — never silently after a refactor. The whole point of the
  fixtures is to catch incidental output changes.
- **Byte-identity** — any post-refactor regeneration (after the Step 6
  migration of this script) must produce the exact same bytes as the
  Step 1 commit. CI fails if it does not.
- **No top-level side effects in `regenerate.mjs`** — the write loop is
  guarded by `import.meta.url === \`file://${process.argv[1]}\`` so that
  importing the module (e.g. from a test) does not trigger fixture writes.
- **Trailing newlines match `runWhatIfCommand`** — `.txt` ends in `\n`
  (the `lines.join("\n")` body ends with a pushed empty string), `.json`
  ends in `\n` (explicit `+ "\n"` after `JSON.stringify(..., null, 2)`),
  `.md` ends in `\n` (`lines.join("\n") + "\n"`).

# 120: Implementation Plan

## Design Decision

Extend the existing `Finder` class in `libraries/libutil/finder.js` with a
`findData(baseName, homeDir)` method. Finder already owns upward path traversal
(`findUpward`) and is used by libstorage for the same pattern. Adding data path
resolution here avoids a new module and reuses existing infrastructure.

The `homeDir` parameter (a string) is passed by callers — composition roots call
`os.homedir()` and inject the result. This avoids adding `os` to Finder's
constructor and changing all existing call sites.

The `--data` CLI flag is handled by each product's bin/ file before calling
`findData` — Finder doesn't need to know about CLI args.

## Changes

### 1. Extend `libraries/libutil/finder.js`

Add `findData` method to the Finder class:

```js
/**
 * Resolve a data directory by upward traversal, with HOME fallback.
 * @param {string} baseName - Directory name to find (e.g. "data")
 * @param {string} homeDir - User home directory path
 * @returns {string} Absolute path to found directory
 */
findData(baseName, homeDir) {
  const cwd = this.#process.cwd();
  const found = this.findUpward(cwd, baseName);
  if (found) return found;

  const homePath = path.join(homeDir, ".fit", baseName);
  if (fs.existsSync(homePath)) return homePath;

  throw new Error(
    `No ${baseName} directory found. Use --data=<path> to specify location.`,
  );
}
```

Uses `findUpward` from CWD (walks up to 3 parents), then checks `~/.fit/{baseName}/`.

### 2. Add tests in `libraries/libutil/test/finder.test.js`

Add `describe("findData", ...)` block with test cases:

- Finds `data/` in CWD via `findUpward`
- Finds `data/` in a parent directory via `findUpward`
- Falls back to `~/.fit/data/` when CWD traversal fails
- Throws when neither CWD traversal nor HOME fallback finds the directory
- CWD takes priority over HOME (even when both exist)

Uses real temp directories (matching the existing test pattern with `tempDir`).

### 3. Modify `products/pathway/bin/fit-pathway.js`

- **Delete** local `resolveDataPath` function (lines 340–381)
- **Remove** `PATHWAY_DATA` env var support
- **Import** `Finder` from `@forwardimpact/libutil` and `homedir` from `os`
- **Change** call site (~line 407):

```js
import { Finder } from "@forwardimpact/libutil";
import { homedir } from "os";

// In main():
let dataDir;
if (options.data) {
  dataDir = resolve(options.data);
} else {
  const finder = new Finder(fs, logger, process);
  dataDir = join(finder.findData("data", homedir()), "pathway");
}
```

Note: pathway already has a logger or can use a minimal one. If no logger
exists in the CLI entry point, create one or use `createMockLogger` — check
what's available. Alternatively, if the CLI doesn't already have a logger,
the simplest path is to create a `createLogger("cli")` or use the existing
imports.

### 4. Modify `products/map/bin/fit-map.js`

- **Delete** `dirExists` helper (lines 54–61) and `findDataDir` (lines 66–91)
- **Import** `Finder` from `@forwardimpact/libutil` and `homedir` from `os`
- **Change** call sites:

```js
let dataDir;
if (options.data) {
  const resolved = resolve(options.data);
  if (!(await dirExists(resolved))) {
    throw new Error(`Data directory not found: ${options.data}`);
  }
  dataDir = resolved;
} else {
  const finder = new Finder(fs, logger, process);
  dataDir = join(finder.findData("data", homedir()), "pathway");
}
```

### 5. Modify `products/guide/bin/fit-guide.js`

- **Import** `Finder` from `@forwardimpact/libutil` and `homedir` from `os`
- **Add** data path resolution:

```js
const finder = new Finder(fs, logger, process);
const dataDir = finder.findData("data", homedir());
```

Makes the base data path available for guide's resource/index loading.

### 6. Improve libs-\* skill files for capability-oriented discovery

During initial planning for this feature, `Finder` was not discovered or
considered because the `libs-system-utilities` skill only lists
`countTokens`, `generateHash`, `generateUuid` as libutil's main API. The
`Finder` class, `BundleDownloader`, `Retry`, `execLine`, `updateEnvFile`, and
`waitFor` are all absent — making them invisible to agents scanning skills for
relevant capabilities.

The root cause is structural: the **Libraries** table lists API names (classes,
functions) rather than describing capabilities. An agent planning "data path
resolution" searches for concepts like "find directories" or "upward traversal"
— not `Finder`. Listing `Finder` helps only if you already know it exists.

#### Approach: capability-oriented Libraries table

Replace the current `Main API` column with a `Capabilities` column that
describes what the library can do in task-oriented language. Keep API names in
a separate `Key Exports` column so both discovery paths work.

**Before** (API inventory):

```
| Library | Main API                                      | Purpose                   |
| ------- | --------------------------------------------- | ------------------------- |
| libutil | `countTokens`, `generateHash`, `generateUuid` | Token counting, hashing … |
```

**After** (capability-oriented):

```
| Library | Capabilities                                                          | Key Exports                                                            |
| ------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| libutil | Path resolution and upward directory search, bundle download and      | `Finder`, `BundleDownloader`, `TarExtractor`, `Retry`,                 |
|         | extraction, retry with backoff, child process execution, token        | `ProcessorBase`, `countTokens`, `generateHash`, `execLine`,            |
|         | counting, hashing, env file management                               | `updateEnvFile`, `waitFor`                                             |
```

#### Apply consistently across all six skill files

For each `libs-*` skill file:

1. **Libraries table** — replace `Main API` + `Purpose` columns with
   `Capabilities` + `Key Exports`. Capabilities use task-oriented language
   that matches how agents search ("store files to cloud", "evaluate access
   policies", "resolve project paths"). Key Exports lists all public classes
   and functions from the library's `index.js`.
2. **Decision Guide** — expand to cover the full API surface, not just the
   most common classes. Add entries for newly surfaced capabilities (e.g.
   `Finder.findUpward` vs `findData` vs `findProjectRoot`).
3. **DI Wiring** — ensure every class with a constructor is documented. Fix
   incorrect claims like libutil's "Pure functions — no DI, no classes."

#### Verification for skill files

For each library in each skill file, diff the `Key Exports` column against the
library's `index.js` exports. Every public export should appear. Run
`grep "^export" libraries/{lib}/index.js` to enumerate.

## Files

| File | Action |
|------|--------|
| `libraries/libutil/finder.js` | Add `findData` method |
| `libraries/libutil/test/finder.test.js` | Add `findData` test cases |
| `products/pathway/bin/fit-pathway.js` | Replace local resolution |
| `products/map/bin/fit-map.js` | Replace local resolution |
| `products/guide/bin/fit-guide.js` | Add data path resolution |
| `.claude/skills/libs-system-utilities/SKILL.md` | Surface full libutil API |
| `.claude/skills/libs-*/SKILL.md` | Audit all six for missing exports |

## Verification

1. `node --test libraries/libutil/test/finder.test.js` — new + existing tests pass
2. `npm test` — all tests pass
3. `npx fit-map validate` — finds `data/pathway/` via upward traversal
4. `npx fit-pathway skill --list` — works from monorepo root
5. `npx fit-map validate --data=./examples/pathway` — CLI flag override works
6. `npm run lint && npm run format` — clean

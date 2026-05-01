---
spec: 710
title: fit-rc logs subcommand
status: plan draft
---

## Approach

Land `fit-rc logs <service>` as a thin addition to the existing CLI lane: a new
entry in libcli's `commands` array, a new `case "logs"` in the dispatch switch,
and a new `ServiceManager.logs(name)` domain method that streams
`<rootDir>/<log_dir>/<name>/current` to an injectable stdout sink. Reuse the
existing `#findServiceIndex` helper for the unknown-service throw (criterion
#3), gate the missing-arg case in the dispatcher via `cli.usageError` (criterion
#4), and treat ENOENT on the read stream as the "no logs yet" condition that
resolves silently (criterion #5). Tests follow the `manager-{verb}.test.js`
pattern with bespoke inline mocks. The getting-started snippet is rewritten in
place.

## Step 1 — `ServiceManager.logs(name)` and `stdout` injection

**Intent.** Add the domain method that maps a service name to a log read and
writes its bytes to an injected stdout sink.

**Files:**

- modified: `libraries/librc/src/manager.js`

**Changes:**

1. Add `import { pipeline } from "node:stream/promises";` to the imports block.
2. Extend the `Dependencies` JSDoc typedef with
   `@property {NodeJS.WritableStream} [stdout] - Stdout sink (default process.stdout)`.
3. Add `#stdout;` to the private fields and assign it in the constructor:
   `this.#stdout = deps.stdout ?? process.stdout;`
4. Append a new public method directly below `status()`:

   ```js
   /**
    * Emits the contents of a service's current log file to stdout.
    * @param {string} serviceName - Service name (required)
    * @returns {Promise<void>}
    */
   async logs(serviceName) {
     this.#findServiceIndex(serviceName); // throws "Unknown service: <name>"
     const logPath = path.join(
       this.#config.rootDir,
       this.#config.init.log_dir,
       serviceName,
       "current",
     );
     const source = this.#fs.createReadStream(logPath);
     try {
       await pipeline(source, this.#stdout, { end: false });
     } catch (err) {
       if (err.code === "ENOENT") return;
       throw err;
     }
   }
   ```

**Verification:** `bun run check` passes; the new method is importable from
`@forwardimpact/librc`.

## Step 2 — Wire `logs` into the CLI dispatcher

**Intent.** Declare the command for libcli (so it appears in `--help`) and route
it through the switch with explicit missing-arg gating.

**Files:**

- modified: `libraries/librc/bin/fit-rc.js`

**Changes:**

1. In the `commands` array, after the `restart` entry, add:

   ```js
   {
     name: "logs",
     args: "<service>",
     description: "Print a service's current log to stdout",
   },
   ```

2. In the `examples` array, append `"fit-rc logs trace"`.

3. In the `switch (command)` block, add a new case before `default`:

   ```js
   case "logs":
     if (!serviceName) {
       cli.usageError("logs requires a service argument");
       process.exit(2);
     }
     await manager.logs(serviceName);
     break;
   ```

   (The `<service>` form in `args` is help-text only; libcli does not enforce
   required positionals — see `libraries/libcli/src/cli.js`.)

**Verification:**

- `bunx fit-rc --help` stdout contains a line matching `^\s+logs\b` (criterion
  #1).
- `bunx fit-rc logs 2>&1 1>/dev/null` exits ≥ 1 with stderr matching both
  `/service/i` and `/(missing|required)/i` (criterion #4).

## Step 3 — Unit tests for `ServiceManager.logs`

**Intent.** Cover the four interface rows from the design at the manager
boundary.

**Files:**

- created: `libraries/librc/test/manager-logs.test.js`

**Changes:** New test file mirroring `manager-stop.test.js`'s `beforeEach`
mock-config / mock-logger shape, plus a `Readable` import from `node:stream`.
Each test injects:

- `deps.fs.createReadStream(path)` — returns a `Readable.from([...])`, or a
  stream whose `_read` synchronously emits an `error` event with the desired
  `code` for the negative paths.
- `deps.stdout` — a `Writable` whose `_write(chunk, _enc, cb)` pushes into a
  captured `Buffer[]`, then `cb()`.

| Test                                                          | Setup                                                               | Asserts                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `throws "Unknown service: <name>" for unrecognised name`      | default mockConfig (no `unknown` service)                           | `await manager.logs("unknown")` rejects with `/Unknown service: unknown/` (criterion #3) |
| `emits file bytes to the stdout sink for a known service`     | `createReadStream` returns `Readable.from(["spec-710-canary\n"])`   | captured stdout buffer concatenated as utf8 contains `spec-710-canary` (criterion #2)    |
| `resolves silently when the current file is missing (ENOENT)` | `createReadStream` returns a stream that emits `{ code: "ENOENT" }` | `manager.logs("trace")` resolves; captured stdout is empty (criterion #5)                |
| `resolves silently when the current file is empty`            | `createReadStream` returns `Readable.from([])`                      | resolves; captured stdout is empty (criterion #5)                                        |
| `propagates non-ENOENT stream errors`                         | `createReadStream` returns a stream that emits `{ code: "EACCES" }` | `manager.logs("trace")` rejects with `/EACCES/`                                          |

**Verification:** `bun test libraries/librc` passes — five new tests, no
regressions in `manager-start.test.js` / `manager-stop.test.js`.

## Step 4 — Replace the troubleshooting snippet

**Intent.** Repair the getting-started page so the flow stays inside `fit-rc`.

**Files:**

- modified: `websites/fit/docs/getting-started/engineers/guide/index.md`

**Changes (lines 146–156, "### Service startup failures"):**

Before:

```sh
ls data/logs/          # List available service log directories
cat data/logs/trace/current  # View the trace service log (example)
```

After:

```sh
npx fit-rc status                 # Identify the failing service
npx fit-rc logs <service>         # Print its current log (example: npx fit-rc logs trace)
```

Update the trailing prose. Before:

> Each microservice writes to `data/logs/{service}/current`. Common causes are
> missing environment variables or port conflicts.

After:

> Common causes are missing environment variables or port conflicts.

(The path leak `data/logs/{service}/current` is no longer an audience-relevant
detail once `fit-rc logs` is the surface.)

**Verification:**

- `grep -nE 'cat data/logs/[^[:space:]]+/current' websites/fit/docs/getting-started/engineers/guide/index.md`
  returns no match (criterion #6 negative half).
- `grep -nE 'npx fit-rc logs <service>' websites/fit/docs/getting-started/engineers/guide/index.md`
  returns one match in the "Service startup failures" block (criterion #6
  positive half).

## Step 5 — Verify

**Intent.** Confirm all six spec criteria and the project quality gate pass
before opening the implementation PR.

**Files:** none.

**Commands (run sequentially):**

1. `bun run check` — format + lint pass (CONTRIBUTING.md § Quality Commands).
2. `bun test libraries/librc` — five new tests + existing tests green.
3. `node libraries/librc/bin/fit-rc.js --help | grep -E '^\s+logs\b'` —
   criterion #1.
4. `node libraries/librc/bin/fit-rc.js logs 2>&1 >/dev/null | grep -iE 'service.*(missing|required)|(missing|required).*service'`
   — criterion #4.
5. `grep -nE 'cat data/logs/[^[:space:]]+/current' websites/fit/docs/getting-started/engineers/guide/index.md`
   returns no match; `grep -nE 'npx fit-rc logs' …` returns a match — criterion
   #6.

Criteria #2, #3, #5 are covered by Step 3 unit tests.

## Libraries used

`node:stream/promises` (pipeline), `node:stream` (Readable, Writable — test file
only).

## Risks

- **`pipeline` ending `process.stdout`.** `pipeline(source, destination)` closes
  `destination` by default, which on `process.stdout` is fatal in a long-running
  shell. Step 1 passes `{ end: false }`; the implementer must preserve this
  option exactly. Node's `stream/promises` `pipeline` has supported the option
  since Node 18 — repo runtime is Node 20+ (see `package.json` engines).
- **Error event ordering on `createReadStream`.** ENOENT on a readable stream
  fires asynchronously after `createReadStream` returns; tests must construct
  mock streams that emit `error` on the next tick (e.g. via `process.nextTick`
  inside `_read`) so `pipeline` sees the rejection rather than an immediate
  synchronous throw.

## Execution recommendation

One agent, sequential. Route to `staff-engineer` — code, tests, and the
getting-started doc edit are tightly coupled (~80 lines src, ~120 lines test, ~6
lines doc) and benefit from the same head holding the design context. No
parallelism justified at this size.

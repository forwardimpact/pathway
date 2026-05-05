# Plan-A — Spec 810: Outpost Mail Attachment Path-Traversal Hardening

Spec: [spec.md](spec.md) · Design: [design-a.md](design-a.md)

## Approach

Add `sanitiseAttachmentName` as a new pure exported helper in
`sync-helpers.mjs`, then revise `copySingleAttachment` to (a) consume `att.name`
only through that sanitiser, (b) feed the dedup branch the sanitised name, and
(c) assert resolved-path containment under `destDir` before the copy. Two new
test files in `products/outpost/test/` cover the sanitiser invariants in
isolation and the containment post-condition end-to-end. No changes outside
the in-scope file plus its two new test files; the rendering call site at
`sync.mjs:94` is explicitly out of scope per spec.

Libraries used: none (Node built-ins only — `node:path`, `node:fs`, `node:os`,
`node:test`, `node:assert`).

## Steps

### 1. Add `sanitiseAttachmentName` to `sync-helpers.mjs`

Files modified:

- `products/outpost/templates/.claude/skills/sync-apple-mail/scripts/sync-helpers.mjs`

Add a new exported pure function above `copySingleAttachment` (insert after
`fetchAttachments`, before the private `indexAttachmentPath` helper at line
213). Implementation must satisfy every invariant listed in design § Interfaces:
total, closed (no `/`, `\`, or `\x00`–`\x1f`/`\x7f`), single basename under both
POSIX and win32 separator semantics, non-trivial (never `""`, `.`, `..`), and
identity on benign UTF-8.

```js
const FALLBACK_ATTACHMENT_NAME = "unnamed";
const CONTROL_CHARS_RE = /[\x00-\x1f\x7f]/g;

/**
 * Coerce an arbitrary `attachments.name` value into a single, non-empty
 * basename safe to join under a per-thread destDir. Strips path separators
 * (POSIX and win32), strips ASCII control bytes, then takes the last
 * non-empty/non-dot segment. Returns `"unnamed"` for any input that
 * collapses to empty, `.`, or `..`. Never throws.
 */
export function sanitiseAttachmentName(raw) {
  if (typeof raw !== "string") return FALLBACK_ATTACHMENT_NAME;
  // Strip control bytes first so a name like "\u0000bar" does not survive
  // segment-splitting as two empty leading segments.
  const stripped = raw.replace(CONTROL_CHARS_RE, "");
  // Split on both separators so "..\\..\\..\\foo" segments correctly under
  // POSIX too. Empty input → empty array → fallback.
  const segments = stripped.split(/[\/\\]/);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (seg && seg !== "." && seg !== "..") return seg;
  }
  return FALLBACK_ATTACHMENT_NAME;
}
```

Verify: `node --check products/outpost/templates/.claude/skills/sync-apple-mail/scripts/sync-helpers.mjs`
exits 0; the file's existing `export function` lines are unchanged; the new
export is added once.

### 2. Revise `copySingleAttachment` to use the sanitiser and assert containment

Files modified:

- `products/outpost/templates/.claude/skills/sync-apple-mail/scripts/sync-helpers.mjs`

Replace the current body (lines 276-304) with the version below. Three changes
from today: the `att.name || "unnamed"` short-circuit is removed in favour of
`sanitiseAttachmentName(att.name)`; the dedup `${mid}_${name}` branch operates
on the already-sanitised name; a `resolve`-based containment check sits between
`mkdirSync` and `copyFileSync`. Import `resolve` and `sep` from `node:path` by
extending the existing import on line 10:

```diff
-import { basename, join } from "node:path";
+import { basename, join, resolve, sep } from "node:path";
```

Replace lines 276-304 with the body below. Behaviour change to call out for
the implementer: today the missing-source branch returns `name = att.name ||
"unnamed"` (raw attacker-controlled string in the result); the revised body
returns `name = sanitiseAttachmentName(att.name)` (sanitised). Callers of
`copyThreadAttachments` only consume `name` for log/index keys, so the change
is observable but safe.

```js
function copySingleAttachment(
  att,
  mid,
  threadId,
  attachmentIndex,
  seenFilenames,
) {
  const name = sanitiseAttachmentName(att.name);
  const source = attachmentIndex.get(`${mid}:${att.attachment_id}`);

  if (!source || !existsSync(source)) {
    return { name, available: false, path: null };
  }

  let destName = name;
  if (seenFilenames.has(destName)) {
    destName = sanitiseAttachmentName(`${mid}_${name}`);
  }
  seenFilenames.add(destName);

  const destDir = join(ATTACHMENTS_DIR, String(threadId));
  mkdirSync(destDir, { recursive: true });
  const destPath = join(destDir, destName);

  const resolvedDir = resolve(destDir);
  const resolvedPath = resolve(destPath);
  const dirWithSep = resolvedDir.endsWith(sep)
    ? resolvedDir
    : resolvedDir + sep;
  if (!resolvedPath.startsWith(dirWithSep)) {
    return { name: destName, available: false, path: null };
  }

  try {
    copyFileSync(source, destPath);
    return { name: destName, available: true, path: destPath };
  } catch {
    return { name: destName, available: false, path: null };
  }
}
```

Verify: `node --check` on the modified file passes; `git diff` shows only the
import line, the new `sanitiseAttachmentName` export from step 1, and the
revised `copySingleAttachment` body — no other helpers or exports change.

### 3. Add sanitiser unit tests

Files created:

- `products/outpost/test/sync-helpers-sanitise.test.js`

`node:test` + `node:assert`, matching the repo convention
(`products/outpost/test/scheduler.test.js` line 6-7). One `describe` block per
spec § Success Criteria row 1 and row 3; each input from the spec gets one
`test`. Imports the function via the `.mjs` extension:

```js
import { test, describe } from "node:test";
import assert from "node:assert";
import { sanitiseAttachmentName } from "../templates/.claude/skills/sync-apple-mail/scripts/sync-helpers.mjs";
```

Cases (each is one `test`):

| Input | Expected output | Spec criterion |
|---|---|---|
| `"../../../foo"` | `"foo"` | row 1 traversal |
| `"/etc/passwd"` | `"passwd"` | row 1 absolute-path |
| `"..\\..\\..\\foo"` | `"foo"` | row 1 win32 traversal |
| `"\u0000bar"` | `"bar"` | row 1 control char |
| `"."` | `"unnamed"` | row 1 single dot |
| `".."` | `"unnamed"` | row 1 double dot |
| `""` | `"unnamed"` | row 1 empty |
| `null` | `"unnamed"` | row 1 null |
| `undefined` | `"unnamed"` | total (design invariant) |
| `42` | `"unnamed"` | total (non-string) |
| `"contract.pdf"` | `"contract.pdf"` (byte-identical) | row 3 benign |
| `"Q3 plan.xlsx"` | `"Q3 plan.xlsx"` | row 3 benign whitespace |
| `"image (2).png"` | `"image (2).png"` | row 3 benign parens |
| `"café résumé.pdf"` | `"café résumé.pdf"` | row 3 non-ASCII |

Each assertion uses `assert.strictEqual` so byte-for-byte equality on the
benign UTF-8 row holds. No filesystem touched — pure-function tests only.

Verify: `bun test products/outpost/test/sync-helpers-sanitise.test.js` reports
14 tests passing, 0 failing.

### 4. Export `copySingleAttachment` with JSDoc

Files modified:

- `products/outpost/templates/.claude/skills/sync-apple-mail/scripts/sync-helpers.mjs`

`copySingleAttachment` is not exported today (line 276 has no `export`).
Export it for testing and add a JSDoc block — `eslint.config.js` enables
`jsdoc/require-jsdoc` with `publicOnly: true`, so `bun run jsdoc` (run by
`bun run check`) errors on a public function without a docstring. The
docstring also pins the dedup contract (`seenFilenames` is the caller's
responsibility) so the new public surface does not become an unsafe seam:

```diff
-function copySingleAttachment(
+/**
+ * Copy a single attachment for `mid` into the per-thread cache directory.
+ * Sanitises `att.name` and asserts resolved-path containment under the
+ * thread's destDir before writing — never writes outside that directory.
+ * The `seenFilenames` Set is the caller's dedup state (typically owned by
+ * `copyThreadAttachments`); call sites that bypass it are responsible for
+ * their own collision handling.
+ */
+export function copySingleAttachment(
```

Verify: `bun run jsdoc` exits 0 against the modified file.

### 5. Add `copySingleAttachment` containment integration test

Files created:

- `products/outpost/test/sync-helpers-copy.test.js`

The integration test must not write into the user's live
`~/.cache/fit/outpost/apple_mail/attachments/`. The module computes
`ATTACHMENTS_DIR` from `homedir()` at load time, so isolation is achieved by
overriding `process.env.HOME` to a temp dir **before** the module is imported,
then loading `sync-helpers.mjs` via dynamic import. After `after()` runs, the
temp dir is removed and `process.env.HOME` is restored.

```js
import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, sep, resolve } from "node:path";

let helpers;
let attachmentIndex;
let tmpHome;
let originalHome;
let sourcePath;
const MID = 42;
const THREAD_ID = "999";

describe("copySingleAttachment containment", () => {
  before(async () => {
    originalHome = process.env.HOME;
    tmpHome = mkdtempSync(join(tmpdir(), "outpost-copy-"));
    process.env.HOME = tmpHome;
    helpers = await import(
      "../templates/.claude/skills/sync-apple-mail/scripts/sync-helpers.mjs"
    );
    sourcePath = join(tmpHome, "source.bin");
    writeFileSync(sourcePath, "payload");
    attachmentIndex = new Map([[`${MID}:att1`, sourcePath]]);
  });

  after(() => {
    rmSync(tmpHome, { recursive: true, force: true });
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
  });

  // each test constructs its own seenFilenames Set so dedup state does not
  // leak across cases
  // ... test cases below ...
});
```

Each test case constructs `att = { name: <case-input>, attachment_id: "att1" }`
(or a non-matching `attachment_id` for the missing-source case) and a fresh
`seenFilenames = new Set()`. Verification logic:

- For `available: true`: assert `resolve(result.path).startsWith(resolve(join(helpers.ATTACHMENTS_DIR, THREAD_ID)) + sep)` — guarantees `result.path` is strictly inside the thread directory under the temp HOME.
- Additionally, for traversal/absolute payloads: assert `existsSync(join(tmpHome, "escape.txt")) === false` and `existsSync(join(tmpHome, "passwd")) === false` — confirms the payload did not create a file outside the thread directory at the nominal escape target.
- For `available: false`: assert `result.path === null`.

Test cases:

| Case | `att.name` | `att.attachment_id` | Expected `result.available` | Additional assertions |
|---|---|---|---|---|
| benign | `"report.pdf"` | `"att1"` | `true` | `result.name === "report.pdf"`; `result.path` ends with `${sep}report.pdf` |
| traversal | `"../../../escape.txt"` | `"att1"` | `true` | `result.name === "escape.txt"`; `existsSync(join(tmpHome, "escape.txt")) === false` |
| absolute | `"/etc/passwd"` | `"att1"` | `true` | `result.name === "passwd"`; `existsSync(join(tmpHome, "passwd")) === false` |
| empty/null | `null` | `"att1"` | `true` | `result.name === "unnamed"`; `result.path` ends with `${sep}unnamed` |
| missing-source | `"foo.pdf"` | `"missing"` | `false` | `result.path === null` (lookup misses the populated index) |

Verify: `bun test products/outpost/test/sync-helpers-copy.test.js` reports
5 tests passing, 0 failing. After the run, `tmpHome` is removed and
`process.env.HOME` is restored — the user's real Outpost cache is never
touched.

### 6. Run repository quality gates

Files modified: none directly (`format:fix` may rewrite touched files).

```sh
bun run format:fix    # writes formatter changes; root package.json runs `biome format --write .`
bun run check         # = format && lint && jsdoc && harness && context
bun test products/outpost/test/sync-helpers-sanitise.test.js \
        products/outpost/test/sync-helpers-copy.test.js
```

All exit 0. `format:fix` is required (not `format`) per the kata-plan
DO-CONFIRM — the read-only `format` command flags drift but does not write,
which would push unformatted code. After `format:fix`, re-run the two test
files to confirm they still pass.

## Risks

| Risk | Mitigation |
|---|---|
| Exporting `copySingleAttachment` widens the module's public surface; another caller could later import it and bypass `copyThreadAttachments`'s dedup `Set`. | The JSDoc block added in step 4 pins the dedup contract: `seenFilenames` is the caller's responsibility, and call sites that bypass it own their own collision handling. |
| The integration test imports `sync-helpers.mjs` dynamically after overriding `process.env.HOME`. If a future change moves `ATTACHMENTS_DIR` resolution out of module-load (e.g., into a function), the override technique stops working. | The test's `before()` hook performs the dynamic import explicitly so the dependency is visible; if a refactor breaks isolation, the test crashes in `before()` (loud failure) rather than silently writing to the user's cache. |
| Re-running the dedup branch's `${mid}_${name}` through `sanitiseAttachmentName` is belt-and-braces — `mid` is a numeric DB ROWID (`fetchAttachments` selects integers), so `${mid}_${name}` cannot inject separators a properly sanitised `name` would not already lack. | Kept anyway as a single rule that any dedup string satisfies the sanitiser's invariants; cost is one extra call per collision (rare path). If the implementer prefers, drop the re-call and assert by inspection — both are sound. |

## Execution

Single agent: **`staff-engineer`**. The plan is one logical unit (one helper
file + two test files) with no parallelism worth coordinating. Sequence:

1. Step 1 — add `sanitiseAttachmentName` export.
2. Step 2 — revise `copySingleAttachment` body (depends on step 1).
3. Step 3 — sanitiser unit tests (depends on step 1's export, independent of
   step 2).
4. Step 4 — export `copySingleAttachment` with JSDoc (depends on step 2 — the
   step 2 body must be in place before adding `export`, so `bun run jsdoc`
   evaluates the new public function).
5. Step 5 — copy integration tests (depends on step 4's export).
6. Step 6 — quality gates (depends on all of the above).

The design's Layer-2 containment check is exercised by inspection (resolved
separator-boundary prefix is reviewable in the code) and indirectly by step
5's traversal cases — adding a test that injects a regressed Layer-1 would
require module-stub infrastructure not present in this repo, and the spec's
verification criteria do not require it.

Open the implementation PR as `impl(810): outpost mail attachment path-traversal hardening`
once steps 1-5 land in the working tree and step 6 passes locally.

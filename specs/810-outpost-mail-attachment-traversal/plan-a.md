# Plan-A — Spec 810: Outpost Mail Attachment Path-Traversal Hardening

Spec: [spec.md](spec.md) · Design: [design-a.md](design-a.md)

## Approach

Add `sanitiseAttachmentName` as a new pure exported helper in
`sync-helpers.mjs`, then revise `copySingleAttachment` to (a) consume `att.name`
only through that sanitiser, (b) feed the dedup branch the sanitised name, and
(c) assert resolved-path containment under `destDir` before the copy. Plumb an
optional `attachmentsDir = ATTACHMENTS_DIR` parameter through the already-
exported `copyThreadAttachments` to its private `copySingleAttachment` callee
so the integration test can inject a temp directory — matching the
dependency-injection pattern used by `state-manager.test.js` and
`kb-manager.test.js`. `copySingleAttachment` stays private; tests exercise it
through `copyThreadAttachments`. Two new test files in `products/outpost/test/`
cover the sanitiser invariants in isolation and the containment post-condition
end-to-end. No changes outside the in-scope file plus its two new test files;
the rendering call site at `sync.mjs:94` is explicitly out of scope per spec.

Bun's `os.homedir()` does not honour `process.env.HOME` (calls `getpwuid`
directly), so `HOME` overrides do not redirect `ATTACHMENTS_DIR` under
`bun test` — the DI parameter is the clean isolation channel.

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

### 2. Revise `copySingleAttachment` to use the sanitiser, assert containment, and accept `attachmentsDir`

Files modified:

- `products/outpost/templates/.claude/skills/sync-apple-mail/scripts/sync-helpers.mjs`

Locate `copySingleAttachment` by symbol (it appears once in the file; current
body at lines 276-304 of the pre-step-1 file — note that step 1's insertion
shifts these by ~25 lines, so anchor by symbol not line number). Replace the
body with the version below. Four changes from today:

1. `att.name || "unnamed"` short-circuit removed; `sanitiseAttachmentName(att.name)` used instead.
2. Dedup `${mid}_${name}` branch unchanged in shape — `mid` is a numeric DB
   ROWID (`fetchAttachments` selects integers) and `name` is already sanitised,
   so `${mid}_${name}` cannot introduce separators that would defeat Layer 2.
   No second sanitise call.
3. A `resolve`-based containment check sits between `mkdirSync` and `copyFileSync`.
4. New optional parameter `attachmentsDir = ATTACHMENTS_DIR` (default preserves
   today's behaviour for `copyThreadAttachments`'s production call shape; tests
   thread a temp dir through `copyThreadAttachments` per step 4).

Behaviour change to call out for the implementer: every return path now uses
the sanitised `name` (or `destName`) — today the `copyFileSync`-failure branch
returns the unsanitised `att.name || "unnamed"`. Returning the sanitised value
unifies all four return shapes. Callers of `copyThreadAttachments` consume
`name` only for log/index keys, so the change is observable but safe.

Extend the `node:path` import:

```diff
-import { basename, join } from "node:path";
+import { basename, join, resolve, sep } from "node:path";
```

Replace the function body with:

```js
function copySingleAttachment(
  att,
  mid,
  threadId,
  attachmentIndex,
  seenFilenames,
  attachmentsDir = ATTACHMENTS_DIR,
) {
  const name = sanitiseAttachmentName(att.name);
  const source = attachmentIndex.get(`${mid}:${att.attachment_id}`);

  if (!source || !existsSync(source)) {
    return { name, available: false, path: null };
  }

  let destName = name;
  if (seenFilenames.has(destName)) destName = `${mid}_${name}`;
  seenFilenames.add(destName);

  const destDir = join(attachmentsDir, String(threadId));
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

### 4. Plumb `attachmentsDir` through `copyThreadAttachments`

Files modified:

- `products/outpost/templates/.claude/skills/sync-apple-mail/scripts/sync-helpers.mjs`

Add an optional `attachmentsDir = ATTACHMENTS_DIR` parameter to
`copyThreadAttachments` and forward it to `copySingleAttachment`. The single
production caller (`sync.mjs:207`, single-call site, no other importers per
`rg copyThreadAttachments products/outpost`) keeps working without changes.

```diff
 export function copyThreadAttachments(
   threadId,
   messages,
   attachmentsByMsg,
   attachmentIndex,
+  attachmentsDir = ATTACHMENTS_DIR,
 ) {
   const results = {};
   const seenFilenames = new Set();

   for (const msg of messages) {
     const mid = msg.message_id;
     const msgAttachments = attachmentsByMsg[mid] ?? [];
     if (msgAttachments.length === 0) continue;

     results[mid] = msgAttachments.map((att) =>
-      copySingleAttachment(att, mid, threadId, attachmentIndex, seenFilenames),
+      copySingleAttachment(
+        att,
+        mid,
+        threadId,
+        attachmentIndex,
+        seenFilenames,
+        attachmentsDir,
+      ),
     );
   }
   return results;
 }
```

`copySingleAttachment` stays private — no `export` keyword added. Public
surface unchanged: `sanitiseAttachmentName` (new from step 1) and
`copyThreadAttachments` (existing, now with one optional parameter). The
existing JSDoc on `copyThreadAttachments` (line 306 today: `/** Copy all
attachments for a thread's messages into the cache directory, deduplicating
filenames. */`) remains correct — extend it with one sentence noting the
optional `attachmentsDir` injection point for tests:

```diff
-/** Copy all attachments for a thread's messages into the cache directory, deduplicating filenames. */
+/** Copy all attachments for a thread's messages into the cache directory, deduplicating filenames. `attachmentsDir` defaults to the module-level `ATTACHMENTS_DIR`; tests inject a temp directory. */
```

Verify: `bun run jsdoc` exits 0; `node --check` on the modified file passes;
`rg "copyThreadAttachments\(" products/outpost/templates` lists the single
call at `sync.mjs:207` unchanged.

### 5. Add `copyThreadAttachments` containment integration test

Files created:

- `products/outpost/test/sync-helpers-copy.test.js`

Tests inject a temp `attachmentsDir` per step 4's parameter — no `HOME`
override, no dynamic import. (Bun's `os.homedir()` ignores `process.env.HOME`
and reads `getpwuid` directly, so an env-override approach would not work
under `bun test`; DI is the clean isolation channel.)

```js
import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, sep, resolve } from "node:path";
import { copyThreadAttachments } from "../templates/.claude/skills/sync-apple-mail/scripts/sync-helpers.mjs";

const MID = 42;
const THREAD_ID = "999";

let tmpRoot; // mkdtemp root, removed in after()
let attachmentsDir; // <tmpRoot>/attachments
let sourcePath; // <tmpRoot>/source.bin (real file the index points at)
let attachmentIndex; // populated for the four reachable cases

describe("copyThreadAttachments containment", () => {
  before(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "outpost-copy-"));
    attachmentsDir = join(tmpRoot, "attachments");
    sourcePath = join(tmpRoot, "source.bin");
    writeFileSync(sourcePath, "payload");
    attachmentIndex = new Map([[`${MID}:att1`, sourcePath]]);
  });

  after(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  // helper: collect every regular-file path under `dir`, recursively.
  function listFiles(dir) {
    const out = [];
    const stack = [dir];
    while (stack.length) {
      const current = stack.pop();
      let entries;
      try {
        entries = readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        const p = join(current, e.name);
        if (e.isDirectory()) stack.push(p);
        else if (e.isFile()) out.push(p);
      }
    }
    return out;
  }

  function runOne(att) {
    const messages = [{ message_id: MID }];
    const attachmentsByMsg = { [MID]: [att] };
    const results = copyThreadAttachments(
      THREAD_ID,
      messages,
      attachmentsByMsg,
      attachmentIndex,
      attachmentsDir,
    );
    return results[MID][0];
  }
});
```

Each `test(...)` constructs its own `att = { name: <case-input>,
attachment_id: <id> }`, calls `runOne(att)`, then makes the assertions in
the table below. After every test, the harness asserts that **every file
under `tmpRoot` is either the seed `source.bin` or lives under
`<attachmentsDir>/<THREAD_ID>/`** — i.e., no copy escaped the thread
directory:

```js
function assertNoEscape() {
  const threadDir = resolve(join(attachmentsDir, THREAD_ID)) + sep;
  for (const p of listFiles(tmpRoot)) {
    if (p === sourcePath) continue;
    assert.ok(
      resolve(p).startsWith(threadDir),
      `file escaped containment: ${p}`,
    );
  }
}
```

Test cases (each calls `runOne` then `assertNoEscape`):

| Case | `att.name` | `att.attachment_id` | Expected `result.available` | Per-case assertions |
|---|---|---|---|---|
| benign | `"report.pdf"` | `"att1"` | `true` | `result.name === "report.pdf"`; `resolve(result.path).startsWith(resolve(join(attachmentsDir, THREAD_ID)) + sep)`; `result.path.endsWith(\`${sep}report.pdf\`)` |
| traversal | `"../../../escape.txt"` | `"att1"` | `true` | `result.name === "escape.txt"`; resolve-prefix assertion (same as benign) |
| absolute | `"/etc/passwd"` | `"att1"` | `true` | `result.name === "passwd"`; resolve-prefix assertion |
| empty/null | `null` | `"att1"` | `true` | `result.name === "unnamed"`; resolve-prefix assertion |
| missing-source | `"foo.pdf"` | `"missing"` | `false` | `result.path === null` (lookup misses the populated index) |

The recursive `assertNoEscape` is the post-condition the spec demands —
"never writes outside `destDir`" — verified empirically by walking the temp
tree, not by checking a hand-picked candidate path. If a future change
reverts Layer 1 or Layer 2, a stray write under `<tmpRoot>/escape.txt` or
`<tmpRoot>/.cache/...` is detected.

Verify: `bun test products/outpost/test/sync-helpers-copy.test.js` reports
5 tests passing, 0 failing. After the run, `tmpRoot` is removed; the user's
real Outpost cache is never touched (the `attachmentsDir` argument never
defaults to `ATTACHMENTS_DIR` in this test file).

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
| Layer 2 (containment check) cannot be exercised in isolation by the test suite — Layer 1 reduces every realistic input to a safe basename before Layer 2 runs, and there is no module-stub infrastructure in the repo to inject a regressed sanitiser. | Layer 2 is verified by code inspection (the resolved separator-boundary prefix is small and reviewable) and by the recursive `assertNoEscape` walk in step 5, which would catch any future regression in either layer that produces an out-of-tree write. The spec's success criteria (row 2) accept either branch of the disjunction (`destPath === <destDir>/<sanitised>` OR `available: false`); the integration test pins the first branch end-to-end. |
| Adding an optional `attachmentsDir` parameter to `copyThreadAttachments` widens its signature. The default value preserves today's call shape, but a future refactor that drops the default would silently break the production caller at `sync.mjs:207`. | The default `= ATTACHMENTS_DIR` is required for production safety. A code review on any future change to `copyThreadAttachments` should preserve the default; the JSDoc updated in step 4 records the intent. |
| Bun's `os.homedir()` does not honour `process.env.HOME` (verified empirically: `bun -e 'process.env.HOME="/x"; console.log(require("os").homedir())'` prints the real home). A reader unfamiliar with this divergence might propose env-override isolation in a follow-up patch. | The plan documents the divergence in the Approach paragraph and step 5; the DI parameter is the only correct isolation channel under `bun test`. |

## Execution

Single agent: **`staff-engineer`**. The plan is one logical unit (one helper
file + two test files) with no parallelism worth coordinating. Sequence:

1. Step 1 — add `sanitiseAttachmentName` export.
2. Step 2 — revise `copySingleAttachment` body and add `attachmentsDir` param
   (depends on step 1).
3. Step 3 — sanitiser unit tests (depends on step 1's export, independent of
   step 2).
4. Step 4 — plumb `attachmentsDir` through `copyThreadAttachments` (depends on
   step 2).
5. Step 5 — copy integration tests via `copyThreadAttachments` (depends on
   step 4).
6. Step 6 — quality gates (depends on all of the above).

The design's Layer-2 containment check is exercised by inspection (resolved
separator-boundary prefix is reviewable in the code) and by the recursive
`assertNoEscape` walk in step 5 — a stray write outside the thread directory
would fail that assertion regardless of which layer regressed. Injecting a
deliberately-broken Layer 1 into the test would require module-stub
infrastructure not present in this repo, and the spec's verification criteria
do not require it.

Open the implementation PR as `impl(810): outpost mail attachment path-traversal hardening`
once steps 1-5 land in the working tree and step 6 passes locally.

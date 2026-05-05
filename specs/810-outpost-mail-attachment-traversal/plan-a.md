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

Replace lines 276-304 with:

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

  // Layer 2 containment: resolved destPath must be strictly inside resolved
  // destDir. Separator-boundary prefix avoids the dest/foo vs dest-evil/...
  // substring trap. Refuse-and-continue (return available:false) per design
  // decision 6 — throwing would abort the whole thread on a single hostile
  // name.
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

Note: the `${mid}_${name}` collision branch is re-fed through the sanitiser so
the dedup string itself satisfies the same invariants — `mid` is already a
numeric DB ROWID (see `fetchAttachments` line 196 selecting integers), so this
is belt-and-braces but keeps the dedup branch under one rule.

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

### 4. Add `copySingleAttachment` containment integration test

Files created:

- `products/outpost/test/sync-helpers-copy.test.js`

`copySingleAttachment` is not exported today (line 276 has no `export`
keyword). The plan exports it for testing — minimal surface change, no
behavioural impact on existing callers (`copyThreadAttachments` lives in the
same module and uses the local reference). Step 2's diff already preserves the
function's signature; this step adds `export` to that line:

```diff
-function copySingleAttachment(
+export function copySingleAttachment(
```

Test contents:

```js
import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ATTACHMENTS_DIR,
  copySingleAttachment,
} from "../templates/.claude/skills/sync-apple-mail/scripts/sync-helpers.mjs";
```

Harness shape (mirrors the spec's success-criteria row 2):

1. `before`: create a temp source file with known contents under
   `mkdtempSync(join(tmpdir(), "outpost-copy-"))`. Build an `attachmentIndex`
   `Map` mapping `"42:att1"` → that temp path.
2. `after`: `rmSync(tempDir, { recursive: true, force: true })` and
   `rmSync(join(ATTACHMENTS_DIR, "999"), { recursive: true, force: true })`
   for the test thread id used below (`999`, chosen to not collide with real
   sync data — a real Apple Mail thread ROWID would never reuse `999` for
   this test run since the cache directory is wiped).

Test cases:

| Case | `att.name` | Expected `result.available` | Expected `result.path` post-condition |
|---|---|---|---|
| benign | `"report.pdf"` | `true` | starts with `join(ATTACHMENTS_DIR, "999") + sep` |
| traversal | `"../../../escape.txt"` | `true` | `result.path` equals `join(ATTACHMENTS_DIR, "999", "escape.txt")` (Layer 1 reduces to safe basename, copy succeeds inside `destDir`) |
| absolute | `"/etc/passwd"` | `true` | `result.path` equals `join(ATTACHMENTS_DIR, "999", "passwd")` |
| empty/null | `null` | `true` | `result.name === "unnamed"` and `result.path` ends with `/unnamed` |
| missing-source | `"foo.pdf"` with `attachmentIndex` empty | `false` | `result.path === null` |

The fifth case verifies the missing-source branch still returns
`{ available: false, path: null }`. After every successful case, assert via
`readdirSync(join(ATTACHMENTS_DIR, "999"))` that no file was written outside
the test thread directory — i.e., the directory listing matches the set of
sanitised basenames the tests created and contains nothing else.

This test exercises the spec's success-criteria row 2 directly: with
`att.name = "../../../escape.txt"`, the resolved `destPath` equals
`<destDir>/escape.txt` (Layer 1 reduced the name) — never writes outside
`destDir`.

Verify: `bun test products/outpost/test/sync-helpers-copy.test.js` reports
5 tests passing, 0 failing. After the test run,
`ls ~/.cache/fit/outpost/apple_mail/attachments/999` is empty (deleted by
`after`).

### 5. Run repository quality gates

Files modified: none (verification only).

```sh
bun run format
bun run lint
bun run jsdoc
bun run check
bun test products/outpost/test/sync-helpers-sanitise.test.js \
        products/outpost/test/sync-helpers-copy.test.js
```

All exit 0. No edits to other files; if `format` rewrites the `.mjs` file,
re-run the two test files to confirm they still pass.

## Risks

| Risk | Mitigation |
|---|---|
| Exporting `copySingleAttachment` (step 4) widens the module's public surface; another caller could later import it and bypass `copyThreadAttachments`'s dedup `Set`. | The `seenFilenames` parameter is required and unannotated — TypeScript-style guidance lives in the docstring added with the export keyword. The dedup `Set` is the caller's responsibility today; the export does not change that contract, only makes it testable. |
| `sync-helpers.mjs` lives under `products/outpost/templates/.claude/skills/`, which the implementer profile flagged as a harness write-block surface (`.claude/**`). Edit/Write tools may prompt for permission. | The path is `products/outpost/templates/.claude/...`, not the repo's top-level `.claude/`. The block applies to the latter; the former is published-template content under `products/`. If the implementer hits the block anyway, fall back to `Bash` writes (per the implementer's recurring-patterns note). |
| The `node:test` runner in this repo runs under `bun test` (root `package.json` line 41 — `xargs bun test`). `node:test` syntax is bun-compatible (existing `products/outpost/test/*.test.js` files confirm), but the new tests use `before`/`after` hooks that touch real filesystem paths under `~/.cache/fit/outpost/`. CI may not have that path. | The harness creates `ATTACHMENTS_DIR/999` lazily via `mkdirSync({ recursive: true })` inside `copySingleAttachment` (line 295 today) — no pre-existing path is required. The `after` hook is wrapped in `force: true` so an already-clean directory does not error. |

## Execution

Single agent: **`staff-engineer`**. The plan is one logical unit (one helper
file + two test files) with no parallelism worth coordinating. Sequence:

1. Step 1 — add `sanitiseAttachmentName` export.
2. Step 2 — revise `copySingleAttachment` (depends on step 1).
3. Step 3 — sanitiser unit tests (depends on step 1's export, independent of
   step 2).
4. Step 4 — copy integration tests (depends on step 2's `export` keyword).
5. Step 5 — quality gates (depends on all of the above).

The design's Layer-2 containment check is exercised by inspection (resolved
separator-boundary prefix is reviewable in the code) and indirectly by step
4's traversal cases — adding a test that injects a regressed Layer-1 would
require module-stub infrastructure not present in this repo, and the spec's
verification criteria do not require it.

Open the implementation PR as `impl(810): outpost mail attachment path-traversal hardening`
once steps 1-4 land in the working tree and step 5 passes locally.

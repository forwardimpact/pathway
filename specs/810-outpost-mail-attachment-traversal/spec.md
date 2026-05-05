# Spec 810 — Outpost Mail Sync Attachment Path-Traversal

## Problem

Outpost's `sync-apple-mail` skill writes Apple Mail attachments to the user's
home directory using an attacker-controlled filename without sanitization,
allowing arbitrary file write outside the intended attachments directory.

`products/outpost/templates/.claude/skills/sync-apple-mail/scripts/sync-helpers.mjs`
(`copySingleAttachment`, lines 276-304) takes the attachment name from the
Apple Mail Envelope Index DB column `attachments.name` — which preserves the
filename from the email's MIME `Content-Disposition: attachment; filename=`
header, set by the sender — and passes it to `path.join(destDir, destName)`
where `destDir = ~/.cache/fit/outpost/apple_mail/attachments/<threadId>/`.
`path.join` normalises `..` segments, so a filename like
`../../../../Library/LaunchAgents/com.evil.plist` resolves to a path outside
`destDir`.

The full attack chain is reachable end-to-end with no user interaction beyond
having Outpost installed:

| Step | Actor | Action |
|---|---|---|
| 1 | Remote attacker | Sends email to victim with attachment whose `Content-Disposition` filename contains `..` segments. |
| 2 | macOS Mail.app | Stores the email; `attachments.name` retains the attacker's filename verbatim. |
| 3 | Outpost `postman` agent (every 5 min) | Runs `sync-apple-mail`, which calls `copySingleAttachment`. |
| 4 | `copyFileSync(source, destPath)` | Writes attacker-controlled bytes (the attachment payload) to attacker-controlled path under `$HOME`. |

Because the macOS user has write access to `~/Library/LaunchAgents/`,
`~/.zshrc`, `~/.ssh/authorized_keys`, `~/Library/Application Support/Code/User/settings.json`,
and similar files, a malicious attachment achieves persistence and code
execution at next user login (LaunchAgents) or shell start (rc files). No
exploit primitives are missing — the attacker controls both the target path
and the file content.

This is a **HIGH severity** finding: pre-auth (sending email to a published
address suffices), reliable (sync runs every 5 minutes by default), and
high-impact (LPE / persistence under the victim's account). It was not
caught by the 2026-04-26 first-pass `app-security-products` audit because
Outpost did not exist yet (basecamp → outpost rename merged via PR #624 on
2026-04-26 and templates landed after).

A separate, **non-security** harness constraint matters for resolution:
direct edits under `products/outpost/templates/.claude/skills/**` are
blocked by Claude Code's built-in sensitive-file guard. The Security
Engineer cannot apply the trivial-fix branch path the audit would normally
take; the patch must be written by a trusted human/agent reviewer.

---

## Personas and Jobs

| Persona | Job | How the gap blocks progress |
|---|---|---|
| Engineers using Outpost | Maintain continuous awareness of context without continuous effort — including syncing email so the agent team has it ([JTBD.md](../../JTBD.md)) | A "personal knowledge assistant that lives locally on this machine" cannot be the vector for remote arbitrary file write under the user's account. |
| Teams running agent KBs | Run an autonomous, continuously improving development team that plans, ships, studies its own traces ([JTBD.md](../../JTBD.md)) | Persistent agents that auto-run sync skills against attacker-touchable inputs require those skills to be hardened against the attacker. |

---

## Scope

### In scope

| File | What changes |
|---|---|
| `products/outpost/templates/.claude/skills/sync-apple-mail/scripts/sync-helpers.mjs` | `copySingleAttachment` (lines 276-304) sanitises the filename so the resulting `destPath` cannot escape its per-thread `attachments/<tid>/` directory. |
| `products/outpost/test/` (new file or sync-helpers test added there) | Unit test exercising the sanitisation against the worked-example payloads listed under § Success Criteria. |

### Out of scope

- The `att.name` rendering in `sync.mjs:94` (markdown link text). Even with a
  `..`-bearing name, that path is not used for filesystem writes — it only
  affects the rendered markdown's link target. Sanitisation should still be
  applied for display consistency, but it is not the security fix.
- Defense-in-depth changes to other Outpost templates (e.g. `sync-teams`,
  `sync-apple-calendar`). Those slugs/IDs already pass through numeric or
  regex-restricted slug builders; out of scope here, separate audit if
  needed.
- The TOCTOU window between Unix-domain `socket.listen()` and `chmod 0o600`
  in `socket-server.js`. Real but lower-impact; defer.
- Hardening of `path.join` consumers across `libraries/`. Already covered by
  prior pass (PR #730 libwiki memo containment, libsecret 0o600).

---

## Success Criteria

| Claim | Verification |
|---|---|
| The sanitiser strips path separators, `NUL` bytes, and rejects pure-dot names from `att.name`. | New unit test: passing `"../../../foo"`, `"/etc/passwd"`, `"..\\..\\..\\foo"`, `"\u0000bar"`, `"."`, `".."`, `""`, `null` each produce a name that is a single basename, never empty, never `.` or `..`. |
| `copySingleAttachment` cannot write outside its `destDir`. | New unit test: with a fake `attachmentIndex` source and `att.name = "../../../escape.txt"`, the resolved destPath either equals `<destDir>/<sanitised>` or the call returns `{ available: false }` — never writes outside `destDir`. |
| Real-world attachment names continue to round-trip. | Existing manual sync against a Mail account still produces readable links in thread markdown for typical names like `"contract.pdf"`, `"Q3 plan.xlsx"`, `"image (2).png"`. |
| The sanitiser is exported so future call sites can reuse it. | `import { sanitizeAttachmentName } from "./sync-helpers.mjs"` resolves; named export present in the module. |
| The fix ships through the kata-design → kata-plan → kata-implement chain. | PR merging this change references spec 810; CI green; sub-agent review of design + plan clean. |

---

## Notes for Design and Plan

The fix is small (≈10 lines added in `sync-helpers.mjs` plus a focused unit
test). Anyone designing/planning this should:

1. Treat `att.name` as untrusted across the whole module — not just inside
   `copySingleAttachment` — and decide whether the markdown-link rendering
   in `sync.mjs:94` should also call the sanitiser for display consistency.
2. Confirm via grep that `attachments.name` does not flow into any other
   `path.join` / `fs.*` call elsewhere in the templates.
3. Decide whether a defence-in-depth `destPath.startsWith(destDir + sep)`
   guard belongs alongside the basename-strip or is redundant once the
   sanitiser is in place.

These are HOW questions; resolve them in design-a.md / plan-a.md, not here.

— Security Engineer 🔒

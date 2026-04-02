# 280 — Migrate from Make to Just

## Problem

The monorepo uses GNU Make (`Makefile`) as its task runner and `scripts/env.sh`
as a layered dotenv loader. Three problems have accumulated:

### 1. Fragile dotenv layering

Environment loading is split across two systems that must stay in sync:

- **`Makefile`** declares `ENVLOAD = ENV=$(ENV) STORAGE=$(STORAGE) AUTH=$(AUTH)
  ./scripts/env.sh` and prefixes every recipe that needs environment variables
  with `@$(ENVLOAD)`.
- **`scripts/env.sh`** sources up to four files in order: `.env`,
  `.env.${ENV}`, `.env.storage.${STORAGE}`, `.env.auth.${AUTH}`.

This indirection creates maintenance burden (every env-dependent recipe must
remember the `$(ENVLOAD)` prefix), obscures the load order from anyone reading
the Makefile, and makes the env layer opaque to tools that don't understand
shell exec wrappers.

There are **9 `.env.*.example` files** at the repo root today:

| File | Purpose |
| --- | --- |
| `.env.example` | Base secrets and API credentials |
| `.env.local.example` | Local dev networking (service URLs, ports) |
| `.env.docker.example` | Docker Compose proxy/networking |
| `.env.auth.none.example` | Auth disabled |
| `.env.auth.gotrue.example` | GoTrue auth config |
| `.env.auth.supabase.example` | Supabase auth config |
| `.env.storage.local.example` | Local filesystem storage |
| `.env.storage.minio.example` | MinIO storage config |
| `.env.storage.supabase.example` | Supabase storage config |

### 2. Agentic workflow failures from working directory changes

The Claude Code stop hook in `.claude/settings.json` runs `make memory-commit`
on every agent stop. When the agent has changed its working directory during a
session, `make` cannot find the `Makefile` and the hook fails. This interrupts
agent workflows and can cause memory loss.

```json
"Stop": [{ "hooks": [{ "type": "command", "command": "make memory-commit" }] }]
```

The same vulnerability exists for the `SessionStart` hook (`make install`).

GNU Make only searches the current directory for `Makefile`. `just` searches the
current directory and all ancestor directories for a `justfile`, making it
immune to this failure mode.

### 3. Make-specific boilerplate

Every target in the Makefile requires a `.PHONY` declaration because Make is a
build system, not a command runner. The current file has **50+ `.PHONY`
declarations** for what are all command-runner tasks. `just` treats all recipes
as commands by default — no `.PHONY` needed.

## Scope

### In scope

1. **Replace `Makefile` with `justfile`** — translate all 50+ Make targets to
   `just` recipes with identical names and behaviour.

2. **Replace `scripts/env.sh` with native `just` dotenv loading** — collapse
   the 9 `.env.*.example` files and shell-script loader into a small set of
   complete, self-contained profile files loaded by `just`'s built-in
   `set dotenv-load`. No generation step, no helper recipes, no scripts.

3. **Update `.claude/settings.json` hooks** — change `make install` and
   `make memory-commit` to `just install` and `just memory-commit`.

4. **Update all GitHub Actions workflows** — 12+ workflow files invoke
   `make install`, `make synthetic`, or other targets. Each must be updated to
   `just` with appropriate `just` installation steps added to CI.

5. **Update all documentation** — `README.md`, `CONTRIBUTING.md`,
   `CONTINUOUS_IMPROVEMENT.md`, and spec documents that reference `make`
   commands.

6. **Update configuration files** — `config/config.example.json` references
   `make supabase-up` / `make supabase-down` in service definitions.

7. **Update shell scripts** — `.devcontainer/setup.sh` invokes `make codegen`,
   `make env-setup`, `make data-init`.

8. **Update error messages** — `scripts/auth-user.js` outputs `make auth-user`,
   `make env-storage`, `make env-secrets` in error guidance.

9. **Update ignore files** — `.prettierignore` excludes `**/Makefile`.

10. **Delete `Makefile` and `scripts/env.sh`** — no coexistence of old and new.

### Out of scope

- Changing the actual commands that recipes run (the `bun`, `bunx`, `docker
  compose` invocations remain identical).
- Refactoring service definitions, codegen, or processing pipelines.
- Historical spec documents in `specs/` — these are immutable records and will
  not be updated.

## Dotenv Consolidation

The current system has 9 `.env.*.example` files and a shell script that layers
them at runtime based on three axis variables (`ENV`, `STORAGE`, `AUTH`). This
complexity exists to avoid duplicating a handful of variables across profiles.
In practice, the auth files contain 2–3 variables each and storage files contain
3–6. The layering machinery costs more than the duplication it prevents.

### Design: Complete profile files

Collapse the 9 example files into **3 complete, self-contained profiles**:

| File | Contents | When to use |
| --- | --- | --- |
| `.env.example` | API credentials, service secrets, database, debug | Always — copy to `.env` |
| `.env.local.example` | All of: service URLs (localhost), `STORAGE_TYPE=local`, `AUTH_TYPE=none` | Local development |
| `.env.docker.example` | All of: proxy config, service URLs (docker), storage and auth for Docker Compose | Docker development |

Each profile file is **complete** — it contains every variable needed for that
environment, including the auth and storage settings that were previously in
separate files. There is deliberate duplication of a few variables between
profiles; this is the right trade-off because it eliminates the layering
machinery entirely.

Users who need non-default auth or storage (e.g., GoTrue auth with local
services) edit the relevant variables directly in their `.env.local` copy.
Commented-out blocks with alternative values and instructions make this
straightforward — the same pattern used for optional Teams Extension config
today.

### Deleted files

The 6 axis-specific files are deleted:

- `.env.auth.none.example`
- `.env.auth.gotrue.example`
- `.env.auth.supabase.example`
- `.env.storage.local.example`
- `.env.storage.minio.example`
- `.env.storage.supabase.example`

Their contents (2–6 variables each) are folded into the profile files above.

### Justfile dotenv configuration

```just
set dotenv-load
```

One line. `just` loads `.env` automatically. No `ENVLOAD` prefix, no helper
recipes, no shell script. Every recipe sees the full environment natively.

For the Docker Compose targets that currently pass `--env-file` flags explicitly
(e.g., `docker compose --env-file .env --env-file .env.docker ...`), these
simplify to just `docker compose` since all variables are already in the
environment via `just`'s dotenv loading.

### Setup flow

```sh
cp .env.example .env          # secrets and credentials
cp .env.local.example .env    # append or use local profile
#  — or —
cp .env.docker.example .env   # append or use docker profile
```

The `env-reset` recipe handles this automatically, same as today but simpler.

### Trade-offs

| Aspect | Current (Make + env.sh) | Proposed (just) |
| --- | --- | --- |
| Env load mechanism | External shell script + exec wrapper | Native `set dotenv-load` |
| Working directory resilience | None — fails if cwd changes | Just walks ancestors to find justfile |
| New recipe cost | 3 lines (.PHONY + target + command) | 1–2 lines (recipe + command) |
| Env example files | 9 files + layering script | 3 complete profile files |
| scripts/env.sh | Required | Deleted |
| Variable pass-through | `ENVLOAD` prefix on every recipe | None — automatic |
| Auth/storage switching | Change `AUTH`/`STORAGE` variable | Edit `.env` directly |

## Affected Files

### Deleted

| File | Reason |
| --- | --- |
| `Makefile` | Replaced by `justfile` |
| `scripts/env.sh` | Replaced by native just dotenv loading |
| `.env.auth.none.example` | Folded into `.env.local.example` |
| `.env.auth.gotrue.example` | Folded into profile files |
| `.env.auth.supabase.example` | Folded into profile files |
| `.env.storage.local.example` | Folded into `.env.local.example` |
| `.env.storage.minio.example` | Folded into profile files |
| `.env.storage.supabase.example` | Folded into `.env.docker.example` |

### Created

| File | Purpose |
| --- | --- |
| `justfile` | All recipes from Makefile, with dotenv configuration |

### Modified

| File | Change |
| --- | --- |
| `.claude/settings.json` | `make install` → `just install`, `make memory-commit` → `just memory-commit` |
| `.github/workflows/check-quality.yml` | `make install` → `just install`, add just installation step |
| `.github/workflows/check-test.yml` | `make install` → `just install`, `make synthetic` → `just synthetic`, add just installation step |
| `.github/workflows/dependabot-triage.yml` | `make install` → `just install`, add just installation step |
| `.github/workflows/guide-setup.yml` | `make install` → `just install`, add just installation step |
| `.github/workflows/improvement-coach.yml` | `make install` → `just install`, add just installation step |
| `.github/workflows/product-backlog.yml` | `make install` → `just install`, add just installation step |
| `.github/workflows/product-feedback.yml` | `make install` → `just install`, add just installation step |
| `.github/workflows/publish-npm.yml` | `make install` → `just install`, add just installation step |
| `.github/workflows/release-readiness.yml` | `make install` → `just install`, add just installation step |
| `.github/workflows/release-review.yml` | `make install` → `just install`, add just installation step |
| `.github/workflows/security-audit.yml` | `make install` → `just install`, add just installation step |
| `README.md` | `make quickstart` → `just quickstart` |
| `CONTRIBUTING.md` | `make quickstart` → `just quickstart`, `make audit` → `just audit`, `make audit-vulnerabilities` → `just audit-vulnerabilities` |
| `CONTINUOUS_IMPROVEMENT.md` | `make memory-update` → `just memory-update`, `make memory-commit` → `just memory-commit`, `make install` → `just install` |
| `config/config.example.json` | `make supabase-up` → `just supabase-up`, `make supabase-down` → `just supabase-down` |
| `.devcontainer/setup.sh` | `make codegen` → `just codegen`, `make env-setup` → `just env-setup`, `make data-init` → `just data-init` |
| `scripts/auth-user.js` | Error messages: `make auth-user` → `just auth-user`, etc. |
| `.prettierignore` | `**/Makefile` → `**/justfile` |

## Success Criteria

1. **`just install` works from any subdirectory** — run `cd libraries/libskill
   && just install` and verify it finds the root justfile and succeeds.

2. **All CI workflows pass** — every GitHub Actions workflow that previously
   used `make` passes with `just`.

3. **Dotenv loading produces identical environments** — for the default local
   profile, the environment variables available to recipes match what
   `scripts/env.sh` previously produced. Verify by comparing `env | sort`
   output before and after migration.

4. **Claude Code hooks succeed after cwd change** — simulate the failure case:
   `cd /tmp && just memory-commit` (invoked from outside the repo) should either
   succeed or fail gracefully, not with "justfile not found."

5. **No file in the repo references `make ` as a command invocation** — except
   historical spec documents in `specs/` which are immutable records.

6. **`Makefile` and `scripts/env.sh` are deleted** — no coexistence.

7. **`just --list` produces a categorized, documented recipe list** — matching
   or improving on `grep '##' Makefile` discoverability.

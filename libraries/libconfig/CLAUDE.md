# Configuration and supervision libraries

Three libraries form the config-to-runtime pipeline. The config file format
lives in [`../../config/CLAUDE.md`](../../config/CLAUDE.md); usage from
services and products is in their respective CLAUDE.md files.

## `libconfig`

`Config` class with namespace-specific factories:

| Factory | Namespace | Config path | Env prefix |
|---|---|---|---|
| `createServiceConfig(name)` | `service` | `service.<name>` | `SERVICE_{NAME}_*` |
| `createProductConfig(name)` | `product` | `product.<name>` | `PRODUCT_{NAME}_*` |
| `createInitConfig()` | `init` | `init` | — |
| `createExtensionConfig(name)` | `extension` | `extension.<name>` | `EXTENSION_{NAME}_*` |
| `createScriptConfig(name)` | `script` | `script.<name>` | `SCRIPT_{NAME}_*` |

Merge order: constructor defaults → `config.json` block → `.env`.
Non-credential keys are set on `process.env` unconditionally from `.env` —
the file is the persistent source of truth. Credential keys (API keys, tokens)
are loaded into a private map; shell env wins at read time for credentials.

## `librc`

`ServiceManager` reads `init.services` via `createInitConfig()` and delegates
to `libsupervise` (svscan) for process supervision. The CLI is `fit-rc`.

Scoping rule: `start(name)`, `stop(name)`, and `restart(name)` operate on the
named service and everything declared after it in the `init.services` array.
Services before the target are not touched. A named `start` reuses the running
svscan daemon; a full `start` (no name) restarts the daemon for a fresh
environment. See [`config/CLAUDE.md`](../../config/CLAUDE.md) for the
declaration order convention.

## `libsupervise`

Daemontools-style process supervisor. `fit-rc` is the only consumer — services
and products do not import `libsupervise` directly.

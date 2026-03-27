# 120: Unified Data Path Resolution

## Problem

Three CLI products need to resolve a data directory:

- **fit-pathway** has a 7-step resolution function with a product-specific env
  var (`PATHWAY_DATA`), home directory check (`~/.fit/pathway/data`), and
  multiple CWD fallbacks including `examples/` directories.
- **fit-map** has a 4-candidate discovery function with no env var or home
  directory support.
- **fit-guide** has no data path resolution at all — it relies on service
  infrastructure but cannot find local data files (resources, indices).

Each product reimplements resolution with different priority orders, different
env vars, and different fallback candidates. There is no way for a user to set
the data directory once and have it apply to all `fit-*` commands.

## Goal

Extend the existing `Finder` class in libutil with a `findData` method that
every `fit-*` CLI uses to resolve the base data directory, with a consistent
resolution order.

## Resolution Order

1. **CLI flag** (`--data=<path>`) — explicit override, handled by callers
2. **Upward traversal** from CWD — `findUpward` looking for `data/`
3. **HOME fallback** (`~/.fit/data/`) — user-global installation

The method returns the **base** data path (e.g. `data/`). Each product appends
its own subdirectory (e.g. `pathway/`).

## What Changes

| Before | After |
|--------|-------|
| `PATHWAY_DATA` env var (pathway only) | Dropped (use `--data` flag) |
| `~/.fit/pathway/data` home path | `~/.fit/data/` (products append suffix) |
| `examples/pathway/`, `examples/` fallbacks | Dropped — use `--data` or create `./data/` |
| fit-map: no home fallback | Full resolution via Finder |
| fit-guide: no data path at all | Full resolution via Finder |
| Three bespoke implementations | One method on Finder |

## Why

- **Consistency** — one resolution order across all products.
- **Reuse** — Finder already handles upward path traversal for libstorage;
  data path resolution is the same pattern with a HOME fallback.
- **fit-guide needs it** — currently cannot find local data files without
  service infrastructure running.
- **Fewer bugs** — one implementation to maintain instead of three diverging
  copies.

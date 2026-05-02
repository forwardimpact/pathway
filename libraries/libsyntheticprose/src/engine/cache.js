/**
 * ProseCache — synchronous prose cache backed by a JSON file on disk.
 *
 * Holds the cache map and exposes a sync read surface so callers can
 * decide what to do on hit/miss without paying for a microtask.
 *
 * On-disk format is a flat object keyed by entity key, with a top-level
 * `_schema` field. Bumping `_schema` invalidates the whole file; per-key
 * context drift is the caller's responsibility (re-run `generate`).
 *
 * @module libsyntheticprose/engine/cache
 */

import { readFileSync, writeFileSync, existsSync } from "fs";

const SCHEMA_VERSION = 1;
const SCHEMA_FIELD = "_schema";

export class ProseCache {
  /**
   * @param {object} options
   * @param {string} options.cachePath - Path to prose cache JSON file
   * @param {object} options.logger - Logger instance
   */
  constructor({ cachePath, logger }) {
    if (!cachePath) throw new Error("cachePath is required");
    if (!logger) throw new Error("logger is required");
    this.cachePath = cachePath;
    this.logger = logger;
    this.entries = this.#load();
    this.dirty = false;
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * @param {string} key
   * @returns {string | undefined}
   */
  get(key) {
    if (this.entries.has(key)) {
      this.stats.hits++;
      return this.entries.get(key);
    }
    this.stats.misses++;
    return undefined;
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.entries.has(key);
  }

  /**
   * @returns {IterableIterator<string>}
   */
  keys() {
    return this.entries.keys();
  }

  /**
   * @param {string} key
   * @param {string} value
   */
  set(key, value) {
    this.entries.set(key, value);
    this.dirty = true;
  }

  save() {
    if (!this.dirty) return;
    const payload = { [SCHEMA_FIELD]: SCHEMA_VERSION };
    for (const [key, value] of this.entries) {
      payload[key] = value;
    }
    writeFileSync(this.cachePath, JSON.stringify(payload, null, 2));
    this.dirty = false;
  }

  #load() {
    try {
      if (existsSync(this.cachePath)) {
        const parsed = JSON.parse(readFileSync(this.cachePath, "utf-8"));
        const schema = parsed?.[SCHEMA_FIELD];
        if (schema !== undefined && schema !== SCHEMA_VERSION) {
          this.logger.info(
            "prose-cache",
            `Cache schema mismatch (file=${schema}, expected=${SCHEMA_VERSION}); discarding`,
          );
          return new Map();
        }
        const entries = new Map();
        for (const [key, value] of Object.entries(parsed)) {
          if (key === SCHEMA_FIELD) continue;
          entries.set(key, value);
        }
        return entries;
      }
    } catch {
      /* cache corrupt or missing */
    }
    return new Map();
  }
}

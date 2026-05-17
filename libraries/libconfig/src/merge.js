/**
 * Pure namespace-ownership classifier used by `bootstrapProject`.
 *
 * `mergeConfigFragment` enforces ownership at the **top-level key** but
 * surfaces diagnostics at the **leaf path** that disagrees — design 1000-c
 * Decision #3. `mergeEnvEntries` applies the same three rows at bare-key
 * granularity.
 */

function canonicalize(value) {
  if (value === undefined) {
    throw new Error("canonicalize: undefined not allowed");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return JSON.stringify(value);
  }
  const sortedKeys = Object.keys(value).sort();
  const parts = sortedKeys.map(
    (k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`,
  );
  return `{${parts.join(",")}}`;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function walkLeafConflicts(existing, fragment, prefix, conflicts) {
  if (isPlainObject(existing) && isPlainObject(fragment)) {
    const keys = new Set([...Object.keys(existing), ...Object.keys(fragment)]);
    for (const key of keys) {
      const nextPath = `${prefix}.${key}`;
      if (!(key in existing) || !(key in fragment)) continue;
      if (canonicalize(existing[key]) === canonicalize(fragment[key])) continue;
      walkLeafConflicts(existing[key], fragment[key], nextPath, conflicts);
    }
    return;
  }
  // At least one side is a scalar/array, or the two sides have different
  // shapes (object vs scalar) — record the conflict at the parent path.
  conflicts.push({ kind: "config", path: prefix });
}

/**
 * Classify a config fragment against the on-disk subtree.
 * @param {object} params
 * @param {object} [params.existing]   Current `config.json` contents (or `{}`).
 * @param {object} [params.fragment]   Caller's proposed contribution.
 * @param {string[]} [params.overwrites]  Top-level keys the caller has signed
 *   off to replace wholesale.
 * @returns {{ result: object, conflicts: {kind: "config", path: string}[] }}
 */
export function mergeConfigFragment({
  existing = {},
  fragment = {},
  overwrites = [],
} = {}) {
  const overwriteSet = new Set(overwrites);
  const conflicts = [];
  const result = { ...existing };
  for (const [topKey, subtree] of Object.entries(fragment)) {
    if (!(topKey in existing)) {
      result[topKey] = subtree;
      continue;
    }
    if (canonicalize(existing[topKey]) === canonicalize(subtree)) continue;
    if (overwriteSet.has(topKey)) {
      result[topKey] = subtree;
      continue;
    }
    walkLeafConflicts(existing[topKey], subtree, topKey, conflicts);
  }
  return { result, conflicts };
}

/**
 * Classify `.env` entries at bare-key granularity. Value comparison is
 * byte-for-byte after `KEY=`.
 * @param {object} params
 * @param {Record<string,string>} [params.existing]
 * @param {Record<string,string>} [params.fragment]
 * @param {string[]} [params.overwrites]
 * @returns {{ result: Record<string,string>, conflicts: {kind: "env", path: string}[] }}
 */
export function mergeEnvEntries({
  existing = {},
  fragment = {},
  overwrites = [],
} = {}) {
  const overwriteSet = new Set(overwrites);
  const conflicts = [];
  const result = { ...existing };
  for (const [key, value] of Object.entries(fragment)) {
    if (!(key in existing)) {
      result[key] = value;
      continue;
    }
    if (existing[key] === value) continue;
    if (overwriteSet.has(key)) {
      result[key] = value;
      continue;
    }
    conflicts.push({ kind: "env", path: key });
  }
  return { result, conflicts };
}

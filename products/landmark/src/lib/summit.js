/**
 * Summit growth alignment wrapper.
 *
 * Wraps Summit's computeGrowthAlignment with dynamic import for
 * optional runtime and a test injection seam.
 */

let cachedFn = null;
let cachedErrorClass = null;
let cacheSet = false;

export async function loadSummit() {
  if (cacheSet) return { fn: cachedFn, GrowthContractError: cachedErrorClass };
  try {
    const mod = await import("@forwardimpact/summit");
    cachedFn = mod?.computeGrowthAlignment ?? null;
    cachedErrorClass = mod?.GrowthContractError ?? null;
  } catch {
    cachedFn = null;
    cachedErrorClass = null;
  }
  cacheSet = true;
  return { fn: cachedFn, GrowthContractError: cachedErrorClass };
}

/**
 * Test helper — reset cache and optionally inject a stub.
 */
export function __setSummitForTests({ fn, GrowthContractError } = {}) {
  cachedFn = fn ?? null;
  cachedErrorClass = GrowthContractError ?? null;
  cacheSet = true;
}

/**
 * Reset the cache (for tests that need fresh module resolution).
 */
export function __resetSummitCache() {
  cachedFn = null;
  cachedErrorClass = null;
  cacheSet = false;
}

/**
 * Compute growth recommendations via Summit.
 *
 * @param {object} params - Passed through to computeGrowthAlignment.
 * @returns {Promise<{available: boolean, recommendations: Array, warnings: string[]}>}
 */
export async function computeGrowth(params) {
  const { fn, GrowthContractError } = await loadSummit();
  if (!fn) {
    return { available: false, recommendations: [], warnings: [] };
  }
  try {
    const recommendations = fn(params);
    return { available: true, recommendations, warnings: [] };
  } catch (err) {
    if (GrowthContractError && err instanceof GrowthContractError) {
      return {
        available: true,
        recommendations: [],
        warnings: [
          `Summit growth alignment skipped: ${err.message} (code: ${err.code ?? "unknown"})`,
        ],
      };
    }
    return {
      available: true,
      recommendations: [],
      warnings: [`Summit growth computation failed: ${err.message}`],
    };
  }
}

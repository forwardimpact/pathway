/**
 * Supabase client factory for Summit.
 *
 * Mirrors the env-var contract used by `@forwardimpact/map`'s `createMapClient`.
 * The Map-sourced roster path depends on this from day one; later parts reuse
 * the same factory for evidence and outcomes decorators.
 */

export class SupabaseUnavailableError extends Error {
  constructor(reason) {
    super(`Supabase connection unavailable: ${reason}`);
    this.code = "SUMMIT_SUPABASE_UNAVAILABLE";
  }
}

/**
 * Create a Supabase client configured for Map's activity schema.
 *
 * @param {object} [opts]
 * @param {string} [opts.url] - Override for MAP_SUPABASE_URL.
 * @param {string} [opts.serviceRoleKey] - Override for MAP_SUPABASE_SERVICE_ROLE_KEY.
 * @param {string} [opts.schema] - Database schema (default: "activity").
 * @returns {Promise<import("@supabase/supabase-js").SupabaseClient>}
 */
export async function createSummitClient(opts = {}) {
  const url = opts.url ?? process.env.MAP_SUPABASE_URL;
  const key = opts.serviceRoleKey ?? process.env.MAP_SUPABASE_SERVICE_ROLE_KEY;
  const schema = opts.schema ?? "activity";

  if (!url || !key) {
    throw new SupabaseUnavailableError(
      "MAP_SUPABASE_URL / MAP_SUPABASE_SERVICE_ROLE_KEY not set. " +
        "Run `fit-map activity start` and export the URL + key it prints, " +
        "or use --roster <path> to load from a local YAML file instead.",
    );
  }

  let createClient;
  try {
    ({ createClient } = await import("@supabase/supabase-js"));
  } catch {
    throw new Error(
      "Supabase features require @supabase/supabase-js. " +
        "Install with: npm install @supabase/supabase-js",
    );
  }

  return createClient(url, key, { db: { schema } });
}

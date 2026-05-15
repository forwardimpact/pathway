/**
 * Shared Supabase client wiring for fit-map CLI commands.
 *
 * Reads Supabase URL and service-role key from libconfig — never
 * directly from process.env. Callers build a Config via
 * `createProductConfig("map")` in their bin and pass it through.
 */

import { createClient } from "@supabase/supabase-js";

/** Create a Supabase client configured for the activity schema. */
export function createMapClient({ config, schema = "activity" } = {}) {
  if (!config) throw new Error("createMapClient: config required");
  return createClient(config.supabaseUrl(), config.supabaseServiceRoleKey(), {
    db: { schema },
  });
}

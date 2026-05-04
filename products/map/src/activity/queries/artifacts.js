/**
 * Artifact Queries
 *
 * Query functions for GitHub artifacts.
 */

/**
 * Get GitHub artifacts, optionally filtered by person or type.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @param {Object} [options]
 * @param {string} [options.email] - Filter by person email
 * @param {string} [options.managerEmail] - Filter to a manager's direct reports
 * @param {string} [options.type] - Filter by artifact type (pull_request, review, commit)
 * @returns {Promise<Array<Object>>} Artifacts
 */
export async function getArtifacts(supabase, options = {}) {
  let query = supabase.from("github_artifacts").select("*");

  if (options.email) {
    query = query.eq("email", options.email);
  }

  if (options.managerEmail) {
    const { data: team } = await supabase.rpc("get_team", {
      root_email: options.managerEmail,
    });
    const emails = (team || []).map((p) => p.email);
    if (emails.length === 0) return [];
    query = query.in("email", emails);
  }

  if (options.type) {
    query = query.eq("artifact_type", options.type);
  }

  const { data, error } = await query.order("occurred_at", {
    ascending: false,
  });

  if (error) throw new Error(`getArtifacts: ${error.message}`);
  return data;
}

/**
 * Get artifacts that have no associated evidence rows.
 * Used by Guide to find unscored artifacts for interpretation.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @param {Object} [options]
 * @param {string} [options.email] - Filter by person email
 * @param {string} [options.managerEmail] - Filter to a manager's direct reports
 * @param {string} [options.type] - Filter by artifact type
 * @returns {Promise<Array<Object>>} Artifacts without evidence
 */
export async function getUnscoredArtifacts(supabase, options = {}) {
  // Get all artifact IDs that have evidence
  const { data: scored } = await supabase
    .from("evidence")
    .select("artifact_id");
  const scoredIds = new Set((scored || []).map((e) => e.artifact_id));

  // Get artifacts and filter client-side
  const artifacts = await getArtifacts(supabase, options);
  return artifacts.filter((a) => !scoredIds.has(a.artifact_id));
}

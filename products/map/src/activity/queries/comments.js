/**
 * Snapshot Comments Queries
 *
 * Query functions for GetDX snapshot comments (engineer voice).
 */

/**
 * Get snapshot comments with optional filters.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Object} [options]
 * @param {string} [options.snapshotId] - Filter by snapshot
 * @param {string} [options.email] - Filter by respondent email
 * @param {string} [options.managerEmail] - Filter to this manager's team
 * @returns {Promise<Array<Object>>} Comments
 */
export async function getSnapshotComments(supabase, options = {}) {
  let query = supabase
    .from("getdx_snapshot_comments")
    .select("*, getdx_snapshots(scheduled_for)")
    .order("timestamp", { ascending: false });

  if (options.snapshotId) {
    query = query.eq("snapshot_id", options.snapshotId);
  }

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

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

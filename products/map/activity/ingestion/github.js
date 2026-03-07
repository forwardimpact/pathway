/**
 * GitHub Activity Ingestion
 *
 * Receives GitHub webhook events, stores raw events, and extracts normalized
 * artifacts (PRs, reviews, commits). Links artifacts to the unified person
 * model via github_username → email.
 */

/**
 * Artifact types extracted from GitHub events.
 * @readonly
 * @enum {string}
 */
export const ArtifactType = {
  PULL_REQUEST: "pull_request",
  REVIEW: "review",
  COMMIT: "commit",
};

/**
 * Store a raw GitHub webhook event.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @param {Object} params
 * @param {string} params.deliveryId - X-GitHub-Delivery header
 * @param {string} params.eventType - X-GitHub-Event header
 * @param {Object} params.payload - Webhook payload
 * @returns {Promise<{stored: boolean, error?: string}>}
 */
export async function storeEvent(supabase, { deliveryId, eventType, payload }) {
  const { error } = await supabase.from("github_events").upsert(
    {
      delivery_id: deliveryId,
      event_type: eventType,
      action: payload.action || null,
      repository: payload.repository?.full_name || "unknown",
      sender_github_username: payload.sender?.login || null,
      occurred_at: payload.created_at || new Date().toISOString(),
      raw: payload,
    },
    { onConflict: "delivery_id" },
  );

  if (error) return { stored: false, error: error.message };
  return { stored: true };
}

/**
 * Look up email for a GitHub username from organization_people.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @param {string} githubUsername - GitHub login
 * @returns {Promise<string|null>} Email or null if not found
 */
async function resolveEmail(supabase, githubUsername) {
  if (!githubUsername) return null;

  const { data } = await supabase
    .from("organization_people")
    .select("email")
    .eq("github_username", githubUsername)
    .single();

  return data?.email || null;
}

/**
 * Extract artifacts from a pull_request event.
 * @param {Object} payload - Webhook payload
 * @returns {Array<Object>} Extracted artifact rows
 */
function extractPullRequestArtifacts(payload) {
  const pr = payload.pull_request;
  if (!pr) return [];

  return [
    {
      artifact_type: ArtifactType.PULL_REQUEST,
      external_id: `pr:${payload.repository.full_name}#${pr.number}`,
      repository: payload.repository.full_name,
      github_username: pr.user?.login || null,
      occurred_at: pr.created_at || pr.updated_at,
      metadata: {
        number: pr.number,
        title: pr.title,
        state: pr.state,
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changed_files,
        merged: pr.merged || false,
        base_branch: pr.base?.ref,
        head_branch: pr.head?.ref,
      },
      raw: pr,
    },
  ];
}

/**
 * Extract artifacts from a pull_request_review event.
 * @param {Object} payload - Webhook payload
 * @returns {Array<Object>} Extracted artifact rows
 */
function extractReviewArtifacts(payload) {
  const review = payload.review;
  if (!review) return [];

  return [
    {
      artifact_type: ArtifactType.REVIEW,
      external_id: `review:${payload.repository.full_name}#${payload.pull_request?.number}:${review.id}`,
      repository: payload.repository.full_name,
      github_username: review.user?.login || null,
      occurred_at: review.submitted_at,
      metadata: {
        pr_number: payload.pull_request?.number,
        state: review.state,
        body_length: review.body?.length || 0,
      },
      raw: review,
    },
  ];
}

/**
 * Extract artifacts from a push event (commits).
 * @param {Object} payload - Webhook payload
 * @returns {Array<Object>} Extracted artifact rows
 */
function extractCommitArtifacts(payload) {
  const commits = payload.commits || [];

  return commits.map((commit) => ({
    artifact_type: ArtifactType.COMMIT,
    external_id: `commit:${payload.repository.full_name}:${commit.id}`,
    repository: payload.repository.full_name,
    github_username: payload.sender?.login || null,
    occurred_at: commit.timestamp,
    metadata: {
      sha: commit.id,
      message: commit.message,
      added: commit.added?.length || 0,
      removed: commit.removed?.length || 0,
      modified: commit.modified?.length || 0,
    },
    raw: commit,
  }));
}

/**
 * Extract artifacts from a webhook payload based on event type.
 * @param {string} eventType - GitHub event type
 * @param {Object} payload - Webhook payload
 * @returns {Array<Object>} Extracted artifact rows
 */
export function extractArtifacts(eventType, payload) {
  switch (eventType) {
    case "pull_request":
      return extractPullRequestArtifacts(payload);
    case "pull_request_review":
      return extractReviewArtifacts(payload);
    case "push":
      return extractCommitArtifacts(payload);
    default:
      return [];
  }
}

/**
 * Store extracted artifacts, resolving github_username → email.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @param {Array<Object>} artifacts - Extracted artifact objects
 * @returns {Promise<{imported: number, errors: Array<string>}>}
 */
export async function storeArtifacts(supabase, artifacts) {
  const errors = [];
  let imported = 0;

  for (const artifact of artifacts) {
    const email = await resolveEmail(supabase, artifact.github_username);

    const { error } = await supabase.from("github_artifacts").upsert(
      {
        artifact_type: artifact.artifact_type,
        external_id: artifact.external_id,
        repository: artifact.repository,
        github_username: artifact.github_username,
        email,
        occurred_at: artifact.occurred_at,
        metadata: artifact.metadata,
        raw: artifact.raw,
      },
      { onConflict: "external_id" },
    );

    if (error) {
      errors.push(`${artifact.external_id}: ${error.message}`);
    } else {
      imported++;
    }
  }

  return { imported, errors };
}

/**
 * Process a GitHub webhook: store event + extract and store artifacts.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Supabase client
 * @param {Object} params
 * @param {string} params.deliveryId - X-GitHub-Delivery header
 * @param {string} params.eventType - X-GitHub-Event header
 * @param {Object} params.payload - Webhook payload
 * @returns {Promise<{event: boolean, artifacts: number, errors: Array<string>}>}
 */
export async function processWebhook(
  supabase,
  { deliveryId, eventType, payload },
) {
  const eventResult = await storeEvent(supabase, {
    deliveryId,
    eventType,
    payload,
  });

  const artifacts = extractArtifacts(eventType, payload);
  const artifactResult = await storeArtifacts(supabase, artifacts);

  return {
    event: eventResult.stored,
    artifacts: artifactResult.imported,
    errors: [
      ...(eventResult.error ? [eventResult.error] : []),
      ...artifactResult.errors,
    ],
  };
}

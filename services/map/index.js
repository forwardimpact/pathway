import { services } from "@forwardimpact/librpc";
import { getUnscoredArtifacts } from "@forwardimpact/map/activity/queries/artifacts";
import { getPerson } from "@forwardimpact/map/activity/queries/org";

const { MapBase } = services;

/**
 * Spec 800: per-source dispatch for artifact reads. Adding Copilot or
 * Claude Code activity adds a new registry entry; the gRPC methods,
 * MCP tools, and evaluation skill remain unchanged.
 */
class SourceTypeRegistry {
  #handlers = new Map();

  /** Register a detail handler for an artifact_type. */
  register(artifactType, handler) {
    this.#handlers.set(artifactType, handler);
  }

  /** Whether a handler is registered for the given artifact_type. */
  has(artifactType) {
    return this.#handlers.has(artifactType);
  }

  /** Resolve the handler for an artifact_type or throw if unknown. */
  get(artifactType) {
    const h = this.#handlers.get(artifactType);
    if (!h) throw new Error(`Unknown artifact type: ${artifactType}`);
    return h;
  }

  /** List the artifact_types currently registered. */
  types() {
    return [...this.#handlers.keys()];
  }
}

/**
 * GitHub source-type detail handler. Projects the github_artifacts row
 * into the structure Guide's evaluation skill consumes.
 */
function githubDetailHandler(artifact) {
  return {
    artifact_id: artifact.artifact_id,
    artifact_type: artifact.artifact_type,
    email: artifact.email,
    repository: artifact.repository,
    occurred_at: artifact.occurred_at,
    metadata: artifact.metadata,
  };
}

/**
 * Spec 800: Activity reads and writes for Guide's evaluation pipeline.
 *
 * The constructor takes an explicit source-type registry so tests can
 * substitute fakes; production callers receive one preconfigured with
 * GitHub handlers. WriteEvidence enforces marker grounding by calling
 * back into svcpathway via the injected pathwayClient.
 */
export class MapService extends MapBase {
  #supabase;
  #registry;
  #pathwayClient;

  /**
   * @param {import("@forwardimpact/libconfig").ServiceConfig} config
   * @param {object} bundle
   * @param {import("@supabase/supabase-js").SupabaseClient} bundle.supabase
   * @param {object} bundle.pathwayClient - svcpathway gRPC client
   * @param {SourceTypeRegistry} [bundle.registry]
   */
  constructor(config, { supabase, pathwayClient, registry } = {}) {
    super(config);
    if (!supabase) throw new Error("supabase is required");
    if (!pathwayClient) throw new Error("pathwayClient is required");
    this.#supabase = supabase;
    this.#pathwayClient = pathwayClient;
    this.#registry = registry ?? defaultRegistry();
  }

  /** @param {import("@forwardimpact/libtype").map.GetUnscoredArtifactsRequest} req */
  async GetUnscoredArtifacts(req) {
    const options = {};
    const email = req?.email;
    const managerEmail = req?.manager_email ?? req?.managerEmail;
    if (email) options.email = email;
    if (managerEmail) options.managerEmail = managerEmail;
    // org-wide scope: pass no scope filter, return all unscored artifacts.

    const artifacts = await getUnscoredArtifacts(this.#supabase, options);
    const rows = artifacts
      .filter((a) => this.#registry.has(a.artifact_type))
      .map((a) => ({
        artifact_id: a.artifact_id,
        artifact_type: a.artifact_type,
        email: a.email,
      }));
    return { content: JSON.stringify(rows) };
  }

  /** @param {import("@forwardimpact/libtype").map.GetArtifactRequest} req */
  async GetArtifact(req) {
    const id = req?.artifact_id ?? req?.artifactId;
    if (!id) throw new Error("artifact_id is required");
    const { data, error } = await this.#supabase
      .from("github_artifacts")
      .select("*")
      .eq("artifact_id", id)
      .single();
    if (error) throw new Error(`GetArtifact: ${error.message}`);
    const handler = this.#registry.get(data.artifact_type);
    return { content: JSON.stringify(handler(data)) };
  }

  /** @param {import("@forwardimpact/libtype").map.WriteEvidenceRequest} req */
  async WriteEvidence(req) {
    const rows = req?.rows ?? [];
    if (rows.length === 0) return { content: "0 rows written" };

    const dbRows = rows.map(normaliseEvidenceRow);
    for (const row of dbRows) validateEvidenceRow(row);

    await this.#assertMarkerGrounding(dbRows);

    const { error } = await this.#supabase.from("evidence").upsert(dbRows, {
      onConflict: "artifact_id,skill_id,level_id,marker_text",
      ignoreDuplicates: true,
    });
    if (error) throw new Error(`WriteEvidence: ${error.message}`);
    return { content: `${dbRows.length} rows written` };
  }

  /**
   * Marker-grounding validation: every (skill_id, level_id, marker_text)
   * triple must match the engineering standard returned by svcpathway for
   * the artifact author's profile. Rows are grouped by artifact so each
   * author profile is resolved at most once.
   */
  async #assertMarkerGrounding(dbRows) {
    const rowsByArtifact = groupBy(dbRows, (r) => r.artifact_id);
    for (const [artifactId, artifactRows] of rowsByArtifact) {
      const authorEmail = await this.#getArtifactEmail(artifactId);
      const validKeys = await this.#getValidMarkerKeys(authorEmail);
      for (const row of artifactRows) {
        const key = `${row.skill_id}\t${row.level_id}\t${row.marker_text}`;
        if (!validKeys.has(key)) {
          throw new Error(
            `Marker not in standard for ${authorEmail}: ` +
              `${row.skill_id} / ${row.level_id} / ${row.marker_text}`,
          );
        }
      }
    }
  }

  async #getArtifactEmail(artifactId) {
    const { data, error } = await this.#supabase
      .from("github_artifacts")
      .select("email")
      .eq("artifact_id", artifactId)
      .single();
    if (error || !data) throw new Error(`Artifact not found: ${artifactId}`);
    return data.email;
  }

  async #getValidMarkerKeys(email) {
    const person = await getPerson(this.#supabase, email);
    if (!person) throw new Error(`Person not found: ${email}`);
    const markersResult = await this.#pathwayClient.GetMarkersForProfile({
      discipline: person.discipline,
      level: person.level,
      track: person.track || undefined,
    });
    return new Set(
      (markersResult?.content || "")
        .split("\n")
        .filter(Boolean)
        .map((line) => line.split("\t").slice(0, 3).join("\t")),
    );
  }

  /** @param {import("@forwardimpact/libtype").map.GetPersonRequest} req */
  async GetPerson(req) {
    const email = req?.email;
    if (!email) throw new Error("email is required");
    const person = await getPerson(this.#supabase, email);
    if (!person) throw new Error(`Person not found: ${email}`);
    return {
      content: JSON.stringify({
        email: person.email,
        name: person.name,
        discipline: person.discipline,
        level: person.level,
        track: person.track,
        manager_email: person.manager_email,
      }),
    };
  }
}

/** Normalise camelCase / snake_case payloads to the DB column shape. */
function normaliseEvidenceRow(r) {
  return {
    artifact_id: r.artifact_id ?? r.artifactId,
    skill_id: r.skill_id ?? r.skillId,
    level_id: r.level_id ?? r.levelId,
    marker_text: r.marker_text ?? r.markerText,
    matched: r.matched,
    rationale: r.rationale,
  };
}

/** Reject incomplete rows before any DB or pathway calls. */
function validateEvidenceRow(row) {
  if (!row.artifact_id) throw new Error("artifact_id is required");
  if (!row.skill_id) throw new Error("skill_id is required");
  if (!row.level_id) throw new Error("level_id is required");
  if (!row.marker_text) throw new Error("marker_text is required");
  if (row.matched == null) throw new Error("matched is required");
  if (!row.rationale) throw new Error("rationale is required");
}

/** Group an iterable of objects into a Map keyed by `keyFn(item)`. */
function groupBy(items, keyFn) {
  const out = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(item);
  }
  return out;
}

/**
 * Default source-type registry. Exported so tests and svcmap consumers
 * can extend it without re-registering GitHub handlers.
 */
export function defaultRegistry() {
  const registry = new SourceTypeRegistry();
  registry.register("pull_request", githubDetailHandler);
  registry.register("review", githubDetailHandler);
  registry.register("commit", githubDetailHandler);
  return registry;
}

export { SourceTypeRegistry };

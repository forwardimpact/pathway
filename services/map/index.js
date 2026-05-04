import { services } from "@forwardimpact/librpc";
import { getUnscoredArtifacts } from "@forwardimpact/map/activity/queries/artifacts";
import { getPerson } from "@forwardimpact/map/activity/queries/org";

const { MapBase } = services;

class SourceTypeRegistry {
  #handlers = new Map();

  register(artifactType, handler) {
    this.#handlers.set(artifactType, handler);
  }

  get(artifactType) {
    const h = this.#handlers.get(artifactType);
    if (!h) throw new Error(`Unknown artifact type: ${artifactType}`);
    return h;
  }

  types() {
    return [...this.#handlers.keys()];
  }
}

function parseMarkerSet(content) {
  return new Set(
    (content || "")
      .split("\n")
      .filter(Boolean)
      .map((line) => line.split("\t").slice(0, 3).join("\t")),
  );
}

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

/** Activity data gateway: reads/writes over gRPC for agent consumption. */
export class MapService extends MapBase {
  #supabase;
  #registry;
  #pathwayClient;

  /** @param {object} config @param {{ supabase: object, pathwayClient: object }} deps */
  constructor(config, { supabase, pathwayClient }) {
    super(config);
    this.#supabase = supabase;
    this.#pathwayClient = pathwayClient;
    this.#registry = new SourceTypeRegistry();
    this.#registry.register("pull_request", githubDetailHandler);
    this.#registry.register("review", githubDetailHandler);
    this.#registry.register("commit", githubDetailHandler);
  }

  /** @param {object} req */
  async GetUnscoredArtifacts(req) {
    const options = {};
    if (req.email) options.email = req.email;
    if (req.manager_email || req.managerEmail)
      options.managerEmail = req.manager_email || req.managerEmail;
    const artifacts = await getUnscoredArtifacts(this.#supabase, options);
    const knownTypes = new Set(this.#registry.types());
    const rows = artifacts
      .filter((a) => knownTypes.has(a.artifact_type))
      .map((a) => ({
        artifact_id: a.artifact_id,
        artifact_type: a.artifact_type,
        email: a.email,
      }));
    return { content: JSON.stringify(rows) };
  }

  /** @param {object} req */
  async GetArtifact(req) {
    const id = req.artifact_id || req.artifactId;
    const { data, error } = await this.#supabase
      .from("github_artifacts")
      .select("*")
      .eq("artifact_id", id)
      .single();
    if (error) throw new Error(`GetArtifact: ${error.message}`);
    const handler = this.#registry.get(data.artifact_type);
    return { content: JSON.stringify(handler(data)) };
  }

  /** @param {object} req */
  async WriteEvidence(req) {
    const rows = req.rows || [];
    if (rows.length === 0) return { content: "0 rows written" };

    const dbRows = rows.map((r) => ({
      artifact_id: r.artifact_id ?? r.artifactId,
      skill_id: r.skill_id ?? r.skillId,
      level_id: r.level_id ?? r.levelId,
      marker_text: r.marker_text ?? r.markerText,
      matched: r.matched,
      rationale: r.rationale,
    }));

    for (const row of dbRows) {
      if (!row.rationale) throw new Error("rationale is required");
      if (!row.level_id) throw new Error("level_id is required");
      if (row.matched == null) throw new Error("matched is required");
    }

    await this.#validateMarkerGrounding(dbRows);

    const { error } = await this.#supabase.from("evidence").upsert(dbRows, {
      onConflict: "artifact_id,skill_id,level_id,marker_text",
      ignoreDuplicates: true,
    });
    if (error) throw new Error(`WriteEvidence: ${error.message}`);
    return { content: `${dbRows.length} rows written` };
  }

  async #validateMarkerGrounding(dbRows) {
    const artifactIds = [...new Set(dbRows.map((r) => r.artifact_id))];
    for (const artifactId of artifactIds) {
      const { data: artifact } = await this.#supabase
        .from("github_artifacts")
        .select("email")
        .eq("artifact_id", artifactId)
        .single();
      if (!artifact) throw new Error(`Artifact not found: ${artifactId}`);
      const person = await getPerson(this.#supabase, artifact.email);
      if (!person) throw new Error(`Person not found: ${artifact.email}`);

      const markersResult = await this.#pathwayClient.GetMarkersForProfile({
        discipline: person.discipline,
        level: person.level,
        track: person.track || undefined,
      });
      const validMarkers = parseMarkerSet(markersResult.content);

      const artifactRows = dbRows.filter((r) => r.artifact_id === artifactId);
      for (const row of artifactRows) {
        const key = `${row.skill_id}\t${row.level_id}\t${row.marker_text}`;
        if (!validMarkers.has(key)) {
          throw new Error(
            `Marker not in standard: ${row.skill_id} / ${row.level_id} / ${row.marker_text}`,
          );
        }
      }
    }
  }

  /** @param {object} req */
  async GetPerson(req) {
    const person = await getPerson(this.#supabase, req.email);
    if (!person) throw new Error(`Person not found: ${req.email}`);
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

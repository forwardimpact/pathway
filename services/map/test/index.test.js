/**
 * Spec 800 svcmap unit tests.
 *
 * Each test constructs MapService with a fake Supabase client and a fake
 * pathway client so the gRPC and DB surfaces stay out of scope. The
 * fakes implement only what the code under test exercises.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MapService, defaultRegistry } from "../index.js";

// ---------------------------------------------------------------------------
// Fake plumbing
// ---------------------------------------------------------------------------

const config = { name: "map" };

function makeFakeSupabase({
  artifacts = [],
  evidenceById = new Map(),
  people = [],
} = {}) {
  let lastUpsertRows = null;

  function from(table) {
    if (table === "github_artifacts") return githubArtifactsTable();
    if (table === "evidence") return evidenceTable();
    if (table === "organization_people") return peopleTable();
    throw new Error(`Unmocked table: ${table}`);
  }

  function githubArtifactsTable() {
    let filter = null;
    const builder = {
      select: () => builder,
      eq: (col, value) => {
        filter = { col, value };
        return builder;
      },
      single: async () => {
        const match = artifacts.find((a) => a[filter.col] === filter.value);
        if (!match) return { data: null, error: { message: "not found" } };
        return { data: match, error: null };
      },
      order: () => builder,
    };
    return builder;
  }

  function evidenceTable() {
    return {
      select: () => ({
        // The unscored-artifacts query reads existing evidence rows.
        async then(resolve) {
          resolve({
            data: [...evidenceById.values()].flat().map((r) => ({
              artifact_id: r.artifact_id,
            })),
            error: null,
          });
        },
      }),
      upsert: async (rows) => {
        lastUpsertRows = rows;
        return { error: null };
      },
    };
  }

  function peopleTable() {
    let filter = null;
    const builder = {
      select: () => builder,
      eq: (col, value) => {
        filter = { col, value };
        return builder;
      },
      single: async () => {
        const match = people.find((p) => p[filter.col] === filter.value);
        if (!match) {
          return { data: null, error: { code: "PGRST116", message: "no row" } };
        }
        return { data: match, error: null };
      },
    };
    return builder;
  }

  return { from, lastUpsertRows: () => lastUpsertRows };
}

function makeFakePathwayClient(markersByProfile = new Map()) {
  return {
    GetMarkersForProfile: async ({ discipline, level, track }) => {
      const key = `${discipline}|${level}|${track ?? ""}`;
      return { content: markersByProfile.get(key) ?? "" };
    },
  };
}

// ---------------------------------------------------------------------------
// SourceTypeRegistry
// ---------------------------------------------------------------------------

describe("SourceTypeRegistry default", () => {
  it("registers GitHub artifact types out of the box", () => {
    const registry = defaultRegistry();
    assert.deepEqual(
      [...registry.types()].sort(),
      ["commit", "pull_request", "review"].sort(),
    );
  });

  it("rejects unknown artifact types in get()", () => {
    const registry = defaultRegistry();
    assert.throws(
      () => registry.get("copilot_session"),
      /Unknown artifact type/,
    );
  });

  it("supports registering a new source type without touching existing ones", () => {
    const registry = defaultRegistry();
    registry.register("copilot_session", {
      tableName: "copilot_artifacts",
      idColumn: "artifact_id",
      emailColumn: "email",
      detail: () => ({ source: "copilot" }),
    });
    assert.equal(registry.has("copilot_session"), true);
    assert.equal(registry.has("pull_request"), true);
  });
});

// ---------------------------------------------------------------------------
// WriteEvidence — the single enforcement point for marker grounding
// ---------------------------------------------------------------------------

describe("MapService.WriteEvidence", () => {
  const actaeon = {
    email: "actaeon@bionova.example",
    name: "Actaeon",
    discipline: "software_engineering",
    level: "J060",
    track: null,
    manager_email: "athena@bionova.example",
  };
  const validMarkers = new Map([
    [
      "software_engineering|J060|",
      "data_integration\tworking\tIntegrated a third-party API end-to-end",
    ],
  ]);

  it("returns early on empty payload", async () => {
    const supabase = makeFakeSupabase();
    const pathway = makeFakePathwayClient();
    const svc = new MapService(config, { supabase, pathwayClient: pathway });
    const result = await svc.WriteEvidence({ rows: [] });
    assert.match(result.content, /0 rows/);
  });

  it("rejects rows missing rationale", async () => {
    const supabase = makeFakeSupabase();
    const pathway = makeFakePathwayClient();
    const svc = new MapService(config, { supabase, pathwayClient: pathway });
    await assert.rejects(
      () =>
        svc.WriteEvidence({
          rows: [
            {
              artifact_id: "a1",
              skill_id: "s1",
              level_id: "working",
              marker_text: "did a thing",
              matched: true,
              rationale: "",
            },
          ],
        }),
      /rationale is required/,
    );
  });

  it("rejects rows whose marker text is not in the engineering standard", async () => {
    const supabase = makeFakeSupabase({
      artifacts: [{ artifact_id: "a1", email: actaeon.email }],
      people: [actaeon],
    });
    const pathway = makeFakePathwayClient(validMarkers);
    const svc = new MapService(config, { supabase, pathwayClient: pathway });

    await assert.rejects(
      () =>
        svc.WriteEvidence({
          rows: [
            {
              artifact_id: "a1",
              skill_id: "data_integration",
              level_id: "working",
              marker_text: "Made up by the LLM",
              matched: true,
              rationale: "free-associated",
            },
          ],
        }),
      /Marker not in standard/,
    );
  });

  it("upserts rows whose markers match the engineering standard", async () => {
    const supabase = makeFakeSupabase({
      artifacts: [{ artifact_id: "a1", email: actaeon.email }],
      people: [actaeon],
    });
    const pathway = makeFakePathwayClient(validMarkers);
    const svc = new MapService(config, { supabase, pathwayClient: pathway });

    const result = await svc.WriteEvidence({
      rows: [
        {
          artifact_id: "a1",
          skill_id: "data_integration",
          level_id: "working",
          marker_text: "Integrated a third-party API end-to-end",
          matched: true,
          rationale: "PR adds a new external service integration with tests.",
        },
      ],
    });
    assert.match(result.content, /1 rows/);
    const [row] = supabase.lastUpsertRows();
    assert.equal(row.matched, true);
    assert.equal(row.rationale.startsWith("PR adds"), true);
  });
});

// ---------------------------------------------------------------------------
// GetPerson — error path
// ---------------------------------------------------------------------------

describe("MapService.GetPerson", () => {
  it("throws when email is missing", async () => {
    const svc = new MapService(config, {
      supabase: makeFakeSupabase(),
      pathwayClient: makeFakePathwayClient(),
    });
    await assert.rejects(() => svc.GetPerson({}), /email is required/);
  });

  it("returns a JSON profile for a known person", async () => {
    const svc = new MapService(config, {
      supabase: makeFakeSupabase({
        people: [
          {
            email: "athena@bionova.example",
            name: "Athena",
            discipline: "software_engineering",
            level: "J080",
            track: null,
            manager_email: "ceo@bionova.example",
          },
        ],
      }),
      pathwayClient: makeFakePathwayClient(),
    });
    const result = await svc.GetPerson({ email: "athena@bionova.example" });
    const parsed = JSON.parse(result.content);
    assert.equal(parsed.email, "athena@bionova.example");
    assert.equal(parsed.level, "J080");
  });
});

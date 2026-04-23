import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createMockQueries } from "@forwardimpact/libharness";

import { runHealthCommand } from "../src/commands/health.js";
import { EMPTY_STATES } from "../src/lib/empty-state.js";
import { MAP_DATA, SCORES, SNAPSHOTS, TEAM } from "./fixtures.js";

const HEALTH_SNAPSHOTS = [SNAPSHOTS[0]];

const HEALTH_EVIDENCE = [
  {
    skill_id: "task_completion",
    level_id: "working",
    matched: true,
    artifact_id: "art-1",
    created_at: "2025-01-15T00:00:00Z",
    github_artifacts: { email: "alice@example.com" },
  },
  {
    skill_id: "task_completion",
    level_id: "foundational",
    matched: true,
    artifact_id: "art-2",
    created_at: "2025-02-01T00:00:00Z",
    github_artifacts: { email: "bob@example.com" },
  },
  {
    skill_id: "planning",
    level_id: "awareness",
    matched: false,
    artifact_id: "art-3",
    created_at: "2025-01-20T00:00:00Z",
    github_artifacts: { email: "alice@example.com" },
  },
];

function stubQueries({
  team = TEAM,
  snapshots = HEALTH_SNAPSHOTS,
  scores = SCORES,
  evidence = HEALTH_EVIDENCE,
} = {}) {
  return createMockQueries({
    getOrganization: team,
    getTeam: team,
    listSnapshots: snapshots,
    getSnapshotScores: scores,
    getEvidence: evidence,
  });
}

function summitPresent(_params) {
  return {
    available: true,
    recommendations: [
      {
        skill: "planning",
        impact: "critical",
        candidates: [
          { email: "bob@example.com", name: "Bob", currentLevel: "Level II" },
        ],
      },
    ],
    warnings: [],
  };
}

function summitAbsent() {
  return { available: false, recommendations: [], warnings: [] };
}

describe("health command", () => {
  it("renders health with Summit present", async () => {
    const result = await runHealthCommand({
      options: { manager: "alice@example.com" },
      mapData: MAP_DATA,
      supabase: {},
      format: "text",
      queries: stubQueries(),
      summitFn: summitPresent,
    });
    assert.ok(result.view);
    assert.ok(result.view.drivers.length > 0);
    assert.equal(result.view.summitAvailable, true);

    const quality = result.view.drivers.find((d) => d.id === "quality");
    assert.ok(quality);
    assert.equal(quality.score, 42);
    assert.ok(quality.contributingSkills.length > 0);
    assert.ok(quality.recommendations.length > 0);
  });

  it("renders health without Summit", async () => {
    const result = await runHealthCommand({
      options: { manager: "alice@example.com" },
      mapData: MAP_DATA,
      supabase: {},
      format: "text",
      queries: stubQueries(),
      summitFn: summitAbsent,
    });
    assert.ok(result.view);
    assert.equal(result.view.summitAvailable, false);

    const quality = result.view.drivers.find((d) => d.id === "quality");
    assert.equal(quality.recommendations.length, 0);
  });

  it("warns on unknown item_id", async () => {
    const scoresWithUnknown = [
      ...SCORES,
      { snapshot_id: "snap-1", item_id: "unknown_driver", score: 50 },
    ];
    const result = await runHealthCommand({
      options: { manager: "alice@example.com" },
      mapData: MAP_DATA,
      supabase: {},
      format: "text",
      queries: stubQueries({ scores: scoresWithUnknown }),
      summitFn: summitAbsent,
    });
    assert.ok(result.meta.warnings.some((w) => w.includes("unknown_driver")));
  });

  it("returns NO_SNAPSHOTS when empty", async () => {
    const result = await runHealthCommand({
      options: { manager: "alice@example.com" },
      mapData: MAP_DATA,
      supabase: {},
      format: "text",
      queries: stubQueries({ snapshots: [] }),
      summitFn: summitAbsent,
    });
    assert.equal(result.view, null);
    assert.equal(result.meta.emptyState, EMPTY_STATES.NO_SNAPSHOTS);
  });

  it("returns MANAGER_NOT_FOUND for unknown manager", async () => {
    const result = await runHealthCommand({
      options: { manager: "nobody@example.com" },
      mapData: MAP_DATA,
      supabase: {},
      format: "text",
      queries: stubQueries({ team: [] }),
      summitFn: summitAbsent,
    });
    assert.equal(result.view, null);
    assert.ok(result.meta.emptyState.includes("nobody@example.com"));
  });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { createDataLoader } from "@forwardimpact/map/loader";

import {
  computeGrowthAlignment,
  GrowthContractError,
} from "../src/aggregation/growth.js";

const FIXTURE_DATA = join(import.meta.dirname, "fixtures", "map-data");

async function loadData() {
  return createDataLoader().loadAllData(FIXTURE_DATA);
}

test("computeGrowthAlignment returns [] for empty team", async () => {
  const mapData = await loadData();
  const result = computeGrowthAlignment({ team: [], mapData });
  assert.deepEqual(result, []);
});

test("computeGrowthAlignment surfaces critical gaps first", async () => {
  const mapData = await loadData();
  const team = [
    {
      email: "a@example.com",
      name: "A",
      job: { discipline: "software_engineering", level: "J040" },
    },
    {
      email: "b@example.com",
      name: "B",
      job: { discipline: "software_engineering", level: "J040" },
    },
  ];
  const recs = computeGrowthAlignment({ team, mapData });
  assert.ok(recs.length > 0);
  // All three starter skills are gaps at J040, so everything should be
  // in the "critical" bucket.
  const critical = recs.filter((r) => r.impact === "critical");
  assert.ok(critical.length >= 3);
});

test("computeGrowthAlignment ranks candidates by proximity", async () => {
  const mapData = await loadData();
  const team = [
    {
      email: "senior@example.com",
      name: "Senior",
      job: { discipline: "software_engineering", level: "J060" },
    },
    {
      email: "junior@example.com",
      name: "Junior",
      job: { discipline: "software_engineering", level: "J040" },
    },
  ];
  const recs = computeGrowthAlignment({ team, mapData });
  const planning = recs.find((r) => r.skillId === "planning");
  assert.ok(planning);
  // Senior has planning=foundational (closer), Junior has planning=awareness
  // so senior should rank first.
  assert.equal(planning.candidates[0].email, "senior@example.com");
});

test("computeGrowthAlignment throws GrowthContractError on unknown discipline", async () => {
  const mapData = await loadData();
  const team = [
    {
      email: "x@example.com",
      name: "X",
      job: { discipline: "nope", level: "J060" },
    },
  ];
  assert.throws(
    () => computeGrowthAlignment({ team, mapData }),
    GrowthContractError,
  );
});

test("computeGrowthAlignment attaches null driverContext for every rec in Part 05", async () => {
  const mapData = await loadData();
  const team = [
    {
      email: "a@example.com",
      name: "A",
      job: { discipline: "software_engineering", level: "J040" },
    },
  ];
  const recs = computeGrowthAlignment({ team, mapData });
  for (const rec of recs) {
    assert.equal(rec.driverContext, null);
  }
});

test("computeGrowthAlignment signature — accepts a single destructured param", async () => {
  // Function accepts team / mapData / evidence / driverScores as
  // destructured options; with a default of `{}`, Function.length is 0.
  // Just exercise the full signature to ensure it doesn't throw.
  const mapData = await loadData();
  const recs = computeGrowthAlignment({
    team: [],
    mapData,
    evidence: undefined,
    driverScores: undefined,
  });
  assert.deepEqual(recs, []);
});

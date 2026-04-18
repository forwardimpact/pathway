import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { createDataLoader } from "@forwardimpact/map/loader";

import {
  computeCoverage,
  derivePersonMatrix,
  resolveTeam,
} from "../src/aggregation/coverage.js";
import { TeamNotFoundError } from "../src/aggregation/errors.js";
import { parseRosterYaml } from "../src/roster/yaml.js";
import { Audience, withAudienceFilter } from "../src/lib/audience.js";
import { coverageToJson } from "../src/formatters/coverage/json.js";
import { coverageToText } from "../src/formatters/coverage/text.js";

const FIXTURE_DATA = join(import.meta.dirname, "fixtures", "map-data");

// Proficiency math under the starter framework:
// - software_engineering has task_completion as its CORE (primary) skill,
//   planning as SUPPORTING (secondary), incident_response as BROAD.
// - J060 base proficiencies: primary=working, secondary=foundational, broad=awareness.
// - J040 base proficiencies: primary=foundational, secondary=awareness, broad=awareness.
// - platform track modifies reliability: +1 and delivery: -1. Because
//   task_completion/planning live in delivery, a platform member loses one
//   step in those; reliability (incident_response) gains one capped by the
//   level's max.
//
// So at J060 without a track, task_completion = working (working+).
// At J060 with platform, task_completion = foundational (below working).
//
// Fixture below lets the reporting team have one working+ holder (Bob) and
// the project team have two working+ holders (Bob + External) via J060
// without the platform track.
const FIXTURE_ROSTER = `
teams:
  platform:
    - name: Alice
      email: alice@example.com
      job:
        discipline: software_engineering
        level: J060
        track: platform
    - name: Bob
      email: bob@example.com
      job:
        discipline: software_engineering
        level: J060
    - name: Carol
      email: carol@example.com
      job:
        discipline: software_engineering
        level: J040
        track: platform

projects:
  migration-q2:
    - email: bob@example.com
      allocation: 0.6
    - name: External
      job:
        discipline: software_engineering
        level: J060
      allocation: 1.0
`;

async function loadData() {
  return createDataLoader().loadAllData(FIXTURE_DATA);
}

test("derivePersonMatrix returns a non-empty matrix for a valid job", async () => {
  const data = await loadData();
  const person = {
    name: "Alice",
    email: "alice@example.com",
    job: {
      discipline: "software_engineering",
      level: "J060",
      track: "platform",
    },
  };
  const matrix = derivePersonMatrix(person, data);
  assert.equal(matrix.email, "alice@example.com");
  assert.equal(matrix.allocation, 1.0);
  assert.ok(matrix.matrix.length > 0);
});

test("derivePersonMatrix honours explicit allocation", async () => {
  const data = await loadData();
  const person = {
    name: "Alice",
    email: "alice@example.com",
    job: { discipline: "software_engineering", level: "J060" },
    allocation: 0.4,
  };
  const matrix = derivePersonMatrix(person, data);
  assert.equal(matrix.allocation, 0.4);
});

test("resolveTeam resolves a reporting team and its members", async () => {
  const data = await loadData();
  const roster = parseRosterYaml(FIXTURE_ROSTER);
  const resolved = resolveTeam(roster, data, { teamId: "platform" });
  assert.equal(resolved.id, "platform");
  assert.equal(resolved.type, "reporting");
  assert.equal(resolved.members.length, 3);
  assert.equal(resolved.effectiveFte, 3);
});

test("resolveTeam throws TeamNotFoundError for unknown team", async () => {
  const data = await loadData();
  const roster = parseRosterYaml(FIXTURE_ROSTER);
  assert.throws(
    () => resolveTeam(roster, data, { teamId: "nope" }),
    TeamNotFoundError,
  );
});

test("resolveTeam returns project members with allocation", async () => {
  const data = await loadData();
  const roster = parseRosterYaml(FIXTURE_ROSTER);
  const resolved = resolveTeam(roster, data, { projectId: "migration-q2" });
  assert.equal(resolved.type, "project");
  assert.equal(resolved.members.length, 2);
  const bob = resolved.members.find((m) => m.email === "bob@example.com");
  assert.equal(bob.allocation, 0.6);
  assert.equal(resolved.effectiveFte, 1.6);
});

test("computeCoverage aggregates per-skill headcount and effective depth", async () => {
  const data = await loadData();
  const roster = parseRosterYaml(FIXTURE_ROSTER);
  const resolved = resolveTeam(roster, data, { teamId: "platform" });
  const coverage = computeCoverage(resolved, data);

  assert.equal(coverage.teamId, "platform");
  assert.equal(coverage.memberCount, 3);
  // Every starter skill is represented in the coverage map.
  assert.ok(coverage.skills.has("task_completion"));
  assert.ok(coverage.skills.has("planning"));
  assert.ok(coverage.skills.has("incident_response"));

  // Bob (J060, no track) is the only trackless J060 in the team — the
  // other two are platform-tracked so their task_completion lands at
  // foundational (below working).
  const task = coverage.skills.get("task_completion");
  assert.equal(task.headcountDepth, 1);
  assert.equal(task.effectiveDepth, 1);

  // incident_response: Alice (J060, platform) gets reliability +1 bump
  // from awareness → foundational (still below working), so depth is 0.
  const incident = coverage.skills.get("incident_response");
  assert.equal(incident.headcountDepth, 0);
});

test("computeCoverage allocates effective depth proportionally for projects", async () => {
  const data = await loadData();
  const roster = parseRosterYaml(FIXTURE_ROSTER);
  const resolved = resolveTeam(roster, data, { projectId: "migration-q2" });
  const coverage = computeCoverage(resolved, data);

  const task = coverage.skills.get("task_completion");
  // Bob at 0.6 + External at 1.0, both trackless J060 → task_completion
  // at working (primary of software_engineering). Effective depth = 1.6.
  assert.equal(task.headcountDepth, 2);
  assert.ok(Math.abs(task.effectiveDepth - 1.6) < 0.001);
});

test("withAudienceFilter strips holder identity at director audience", async () => {
  const data = await loadData();
  const roster = parseRosterYaml(FIXTURE_ROSTER);
  const resolved = resolveTeam(roster, data, { teamId: "platform" });
  const coverage = computeCoverage(resolved, data);

  const manager = withAudienceFilter(coverage, Audience.MANAGER);
  const director = withAudienceFilter(coverage, Audience.DIRECTOR);

  const managerHolders = manager.skills.get("task_completion").holders;
  const directorHolders = director.skills.get("task_completion").holders;

  assert.ok(managerHolders.length > 0);
  assert.ok(managerHolders[0].email);
  assert.ok(managerHolders[0].name);

  assert.ok(directorHolders.length > 0);
  assert.equal(directorHolders[0].email, undefined);
  assert.equal(directorHolders[0].name, undefined);
  assert.ok("proficiency" in directorHolders[0]);
  assert.ok("allocation" in directorHolders[0]);
});

test("coverageToJson round-trips through JSON.stringify", async () => {
  const data = await loadData();
  const roster = parseRosterYaml(FIXTURE_ROSTER);
  const resolved = resolveTeam(roster, data, { teamId: "platform" });
  const coverage = computeCoverage(resolved, data);

  const payload = coverageToJson(coverage);
  const roundTrip = JSON.parse(JSON.stringify(payload));
  assert.equal(roundTrip.team, "platform");
  assert.equal(roundTrip.type, "reporting");
  assert.ok(roundTrip.coverage.task_completion);
});

test("coverageToText includes growth hint when gaps are present", async () => {
  const data = await loadData();
  const roster = parseRosterYaml(FIXTURE_ROSTER);
  const resolved = resolveTeam(roster, data, { teamId: "platform" });
  const coverage = computeCoverage(resolved, data);

  // The platform team has incident_response at depth 0 — a gap.
  assert.equal(coverage.skills.get("incident_response").headcountDepth, 0);

  const text = coverageToText(coverage, data);
  assert.ok(
    text.includes("fit-summit growth platform"),
    "output should hint at the growth command when gaps exist",
  );
});

test("coverageToText omits growth hint when no gaps are present", async () => {
  const data = await loadData();
  const roster = parseRosterYaml(FIXTURE_ROSTER);
  const resolved = resolveTeam(roster, data, { teamId: "platform" });
  const coverage = computeCoverage(resolved, data);

  // Remove all gap skills so no hint should appear.
  for (const [id, skill] of coverage.skills) {
    if (skill.headcountDepth === 0) coverage.skills.delete(id);
  }

  const text = coverageToText(coverage, data);
  assert.ok(
    !text.includes("fit-summit growth"),
    "output should not hint at growth when there are no gaps",
  );
});

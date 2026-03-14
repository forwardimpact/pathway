/**
 * Activity generation — roster, teams, snapshots, scores, webhooks, evidence.
 *
 * @module libuniverse/engine/activity
 */

import { generateHash } from "@forwardimpact/libutil";

const COMMIT_MULT = {
  baseline: 1.0,
  moderate: 1.5,
  elevated: 2.5,
  spike: 4.0,
  sustained_spike: 3.5,
  very_high: 5.0,
};
const PR_MULT = { baseline: 1.0, moderate: 1.3, elevated: 2.0, very_high: 3.5 };

const ALL_DRIVERS = [
  "clear_direction",
  "say_on_priorities",
  "requirements_quality",
  "ease_of_release",
  "test_efficiency",
  "managing_tech_debt",
  "code_review",
  "documentation",
  "codebase_experience",
  "incident_response",
  "learning_culture",
  "experimentation",
  "connectedness",
  "efficient_processes",
  "deep_work",
  "leveraging_user_feedback",
];

const DRIVER_NAMES = Object.fromEntries(
  ALL_DRIVERS.map((d) => [
    d,
    d
      .split("_")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" "),
  ]),
);

const FEATURES = [
  "authentication",
  "pipeline",
  "scoring",
  "analytics",
  "export",
  "batch-processing",
  "data-validation",
  "api-gateway",
  "monitoring",
  "caching",
  "search",
  "notification",
  "scheduling",
  "reporting",
];

const COMMIT_MSGS = [
  "Add {f} endpoint",
  "Fix {f} validation",
  "Update {f} tests",
  "Refactor {f} module",
  "Optimize {f} performance",
  "Add error handling for {f}",
  "Update {f} documentation",
  "Implement {f} caching",
  "Add {f} monitoring",
  "Fix race condition in {f}",
  "Migrate {f} to new API",
  "Add integration tests for {f}",
  "Clean up {f} imports",
];

const PR_TITLES = [
  "Add {f} support",
  "Implement {f} workflow",
  "Fix {f} edge cases",
  "Upgrade {f} dependencies",
  "Refactor {f} architecture",
  "Add {f} tests",
];

const PR_BODIES = [
  "LGTM",
  "Looks good to me!",
  "Nice work.",
  "A few minor comments.",
  "Please address the feedback.",
  "Approved with minor suggestions.",
];

const PROFICIENCY_ORDER = [
  "awareness",
  "foundational",
  "working",
  "practitioner",
  "expert",
];

/**
 * Generate all activity data from AST and entities.
 * @param {import('../dsl/parser.js').UniverseAST} ast
 * @param {import('./rng.js').SeededRNG} rng
 * @param {object[]} people
 * @param {object[]} teams
 * @returns {object}
 */
export function generateActivity(ast, rng, people, teams) {
  const roster = people.map((p) => ({
    email: p.email,
    name: p.name,
    github_username: p.github_username,
    discipline: p.discipline,
    level: p.level,
    track: p.track,
    manager_email: p.manager_email,
    team_id: p.team_id,
  }));

  const activityTeams = buildActivityTeams(ast, teams);
  const snapshots = generateSnapshots(ast);
  const scores = generateScores(ast, rng, snapshots, activityTeams);
  const webhooks = generateWebhooks(ast, rng, people, teams);
  const evidence = generateEvidence(ast, rng, people, teams);

  return { roster, activityTeams, snapshots, scores, webhooks, evidence };
}

function buildActivityTeams(ast, teams) {
  const result = [];

  for (const org of ast.orgs) {
    result.push({
      getdx_team_id: `gdx_org_${org.id}`,
      name: org.name,
      is_parent: true,
      parent_id: null,
      manager_id: null,
      contributors: 0,
      reference_id: null,
      ancestors: [],
      last_changed_at: new Date("2025-01-01").toISOString(),
    });
  }

  const orgMap = new Map(ast.orgs.map((o) => [o.id, o]));
  for (const dept of ast.departments) {
    const parentOrg = orgMap.get(dept.parent);
    result.push({
      getdx_team_id: `gdx_dept_${dept.id}`,
      name: dept.name,
      is_parent: true,
      parent_id: parentOrg ? `gdx_org_${parentOrg.id}` : null,
      manager_id: null,
      contributors: dept.headcount,
      reference_id: null,
      ancestors: parentOrg ? [`gdx_org_${parentOrg.id}`] : [],
      last_changed_at: new Date("2025-01-01").toISOString(),
    });
  }

  const deptMap = new Map(ast.departments.map((d) => [d.id, d]));
  for (const team of teams) {
    const dept = deptMap.get(team.department);
    const parentDeptId = dept ? `gdx_dept_${dept.id}` : null;
    const parentOrg = dept ? orgMap.get(dept.parent) : null;
    const ancestors = [];
    if (parentOrg) ancestors.push(`gdx_org_${parentOrg.id}`);
    if (parentDeptId) ancestors.push(parentDeptId);

    result.push({
      getdx_team_id: team.getdx_team_id,
      name: team.name,
      is_parent: false,
      parent_id: parentDeptId,
      manager_id: team.manager ? `gdx_mgr_${team.manager}` : null,
      contributors: team.size,
      reference_id: null,
      ancestors,
      last_changed_at: new Date("2025-01-01").toISOString(),
    });
  }

  return result;
}

function generateSnapshots(ast) {
  if (!ast.snapshots) return [];
  const [fromY, fromM] = ast.snapshots.quarterly_from.split("-").map(Number);
  const [toY, toM] = ast.snapshots.quarterly_to.split("-").map(Number);
  const snaps = [];
  let y = fromY,
    m = fromM;

  while (y < toY || (y === toY && m <= toM)) {
    const q = Math.ceil(m / 3);
    const id = `snap_${y}_Q${q}`;
    const done = new Date(y, m, 1).toISOString();
    snaps.push({
      snapshot_id: id,
      account_id: ast.snapshots.account_id,
      last_result_change_at: done,
      scheduled_for: `${y}-${String(m).padStart(2, "0")}-15`,
      completed_at: done,
      completed_count: 180,
      deleted_at: null,
      total_count: ast.people?.count || 50,
    });
    m += 3;
    if (m > 12) {
      m -= 12;
      y++;
    }
  }

  return snaps;
}

function generateScores(ast, rng, snapshots, activityTeams) {
  const scores = [];
  const leafTeams = activityTeams.filter((t) => !t.is_parent);

  for (const snap of snapshots) {
    const snapDate = new Date(snap.completed_at);
    for (const team of leafTeams) {
      for (const driverId of ALL_DRIVERS) {
        let base = 65 + rng.gaussian(0, 8);

        for (const scenario of ast.scenarios) {
          const start = new Date(scenario.timerange_start + "-01");
          const end = new Date(scenario.timerange_end + "-28");
          if (snapDate >= start && snapDate <= end) {
            for (const affect of scenario.affects) {
              if (team.getdx_team_id === `gdx_team_${affect.team_id}`) {
                const dx = (affect.dx_drivers || []).find(
                  (d) => d.driver_id === driverId,
                );
                if (dx)
                  base += dx.magnitude * ((snapDate - start) / (end - start));
              }
            }
          }
        }

        const score = Math.max(0, Math.min(100, Math.round(base * 10) / 10));
        scores.push({
          snapshot_id: snap.snapshot_id,
          snapshot_team_id: `st_${snap.snapshot_id}_${team.getdx_team_id}`,
          team_name: team.name,
          getdx_team_id: team.getdx_team_id,
          is_parent: team.is_parent,
          parent_id: team.parent_id,
          ancestors: team.ancestors,
          item_id: driverId,
          item_type: "driver",
          item_name: DRIVER_NAMES[driverId] || driverId,
          response_count: rng.randomInt(5, team.contributors || 10),
          score,
          contributor_count: team.contributors || 0,
          vs_prev: round1(rng.gaussian(0, 3)),
          vs_org: round1(rng.gaussian(0, 5)),
          vs_50th: round1(rng.gaussian(2, 5)),
          vs_75th: round1(rng.gaussian(-3, 5)),
          vs_90th: round1(rng.gaussian(-8, 5)),
        });
      }
    }
  }

  return scores;
}

function generateWebhooks(ast, rng, people, teams) {
  const webhooks = [];
  const starts = ast.scenarios.map((s) => new Date(s.timerange_start + "-01"));
  const ends = ast.scenarios.map((s) => new Date(s.timerange_end + "-28"));
  const globalStart = new Date(Math.min(...starts, new Date("2024-07-01")));
  const globalEnd = new Date(Math.max(...ends, new Date("2026-01-28")));

  const membersByTeam = new Map();
  for (const team of teams)
    membersByTeam.set(
      team.id,
      people.filter((p) => p.team_id === team.id),
    );

  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  let week = new Date(globalStart);
  let counter = 0;

  while (week < globalEnd) {
    const weekEnd = new Date(week.getTime() + oneWeek);

    for (const team of teams) {
      const members = membersByTeam.get(team.id) || [];
      if (members.length === 0) continue;

      let cm = 1,
        pm = 1;
      for (const s of ast.scenarios) {
        const sStart = new Date(s.timerange_start + "-01");
        const sEnd = new Date(s.timerange_end + "-28");
        if (week >= sStart && week <= sEnd) {
          for (const a of s.affects) {
            if (a.team_id === team.id) {
              cm = Math.max(cm, COMMIT_MULT[a.github_commits] || 1);
              pm = Math.max(pm, PR_MULT[a.github_prs] || 1);
            }
          }
        }
      }

      const orgName = ast.orgs[0]?.id || "org";
      const pushCount = Math.round(members.length * cm * 0.3);
      for (let i = 0; i < pushCount; i++) {
        const author = rng.pick(members);
        const repo = rng.pick(
          team.repos.length > 0 ? team.repos : ["default-repo"],
        );
        const feat = rng.pick(FEATURES);
        const ts = randDate(rng, week, weekEnd);
        const cid = generateHash(
          String(counter),
          author.name,
          ts.toISOString(),
        );

        webhooks.push({
          delivery_id: `evt-${String(++counter).padStart(8, "0")}`,
          event_type: "push",
          occurred_at: ts.toISOString(),
          payload: {
            ref: "refs/heads/main",
            commits: [
              {
                id: cid + cid,
                message: rng.pick(COMMIT_MSGS).replace("{f}", feat),
                timestamp: ts.toISOString(),
                added: [`src/${feat}.js`],
                removed: [],
                modified: ["src/index.js"],
              },
            ],
            repository: { full_name: `${orgName}/${repo}` },
            sender: { login: author.github_username },
          },
        });
      }

      const prCount = Math.round(members.length * pm * 0.15);
      for (let i = 0; i < prCount; i++) {
        const author = rng.pick(members);
        const repo = rng.pick(
          team.repos.length > 0 ? team.repos : ["default-repo"],
        );
        const feat = rng.pick(FEATURES);
        const ts = randDate(rng, week, weekEnd);
        const prNum = rng.randomInt(1, 999);
        const branch = `feature/${feat}`;

        webhooks.push({
          delivery_id: `evt-${String(++counter).padStart(8, "0")}`,
          event_type: "pull_request",
          occurred_at: ts.toISOString(),
          payload: {
            action: rng.pick(["opened", "closed"]),
            number: prNum,
            pull_request: {
              number: prNum,
              title: rng.pick(PR_TITLES).replace("{f}", feat),
              state: "open",
              user: { login: author.github_username },
              created_at: ts.toISOString(),
              updated_at: ts.toISOString(),
              additions: rng.randomInt(10, 500),
              deletions: rng.randomInt(0, 100),
              changed_files: rng.randomInt(1, 20),
              merged: false,
              base: { ref: "main" },
              head: { ref: branch },
            },
            repository: { full_name: `${orgName}/${repo}` },
            sender: { login: author.github_username },
          },
        });

        if (rng.random() > 0.4) {
          const reviewer = rng.pick(
            members.filter((m) => m.name !== author.name) || [author],
          );
          const rts = new Date(ts.getTime() + rng.randomInt(1, 48) * 3600000);
          webhooks.push({
            delivery_id: `evt-${String(++counter).padStart(8, "0")}`,
            event_type: "pull_request_review",
            occurred_at: rts.toISOString(),
            payload: {
              action: "submitted",
              review: {
                id: rng.randomInt(10000, 99999),
                user: { login: reviewer.github_username },
                state: rng.pick(["approved", "changes_requested", "commented"]),
                body: rng.pick(PR_BODIES),
                submitted_at: rts.toISOString(),
              },
              pull_request: { number: prNum },
              repository: { full_name: `${orgName}/${repo}` },
              sender: { login: reviewer.github_username },
            },
          });
        }
      }
    }

    week = weekEnd;
  }

  return webhooks;
}

function generateEvidence(ast, rng, people, teams) {
  const evidence = [];

  for (const scenario of ast.scenarios) {
    const sStart = new Date(scenario.timerange_start + "-01");
    const sEnd = new Date(scenario.timerange_end + "-28");

    for (const affect of scenario.affects) {
      const team = teams.find((t) => t.id === affect.team_id);
      if (!team) continue;
      const teamPeople = people.filter((p) => p.team_id === team.id);
      const floorIdx = PROFICIENCY_ORDER.indexOf(affect.evidence_floor);

      for (const person of teamPeople) {
        for (const skillId of affect.evidence_skills || []) {
          const profIdx = Math.min(
            PROFICIENCY_ORDER.length - 1,
            Math.max(floorIdx, floorIdx + rng.randomInt(0, 1)),
          );
          evidence.push({
            person_email: person.email,
            person_name: person.name,
            skill_id: skillId,
            proficiency: PROFICIENCY_ORDER[profIdx],
            scenario_id: scenario.id,
            team_id: team.id,
            observed_at: randDate(rng, sStart, sEnd).toISOString(),
            source: "synthetic",
          });
        }
      }
    }
  }

  return evidence;
}

function randDate(rng, start, end) {
  return new Date(
    start.getTime() + rng.random() * (end.getTime() - start.getTime()),
  );
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

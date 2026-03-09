/**
 * Tier 0 — Deterministic Entity & Activity Generation
 *
 * Generates all structural data without any LLM calls.
 * Uses seedrandom for deterministic output.
 */

import { createSeededRNG } from './rng.js'
import { GREEK_NAMES, MANAGER_NAMES, toGithubUsername, toEmail } from './names.js'
import { generateHash } from '@forwardimpact/libutil'

/**
 * Generate all entities from the parsed AST.
 * @param {import('../dsl/parser.js').UniverseAST} ast
 * @returns {object} Entity graph
 */
export function generate(ast) {
  const rng = createSeededRNG(ast.seed)
  const domain = ast.domain

  const orgs = buildOrganizations(ast, domain)
  const departments = buildDepartments(ast, domain)
  const teams = buildTeams(ast, domain)
  const people = generatePeople(ast, rng, teams, domain)
  const projects = buildProjects(ast, teams, people, domain)
  const activity = generateActivity(ast, rng, people, teams)

  return {
    orgs,
    departments,
    teams,
    people,
    projects,
    scenarios: ast.scenarios,
    snapshots: ast.snapshots,
    framework: ast.framework,
    content: ast.content,
    activity,
    domain,
  }
}

/**
 * @param {import('../dsl/parser.js').UniverseAST} ast
 * @param {string} domain
 */
function buildOrganizations(ast, domain) {
  return ast.orgs.map(org => ({
    id: org.id,
    name: org.name,
    location: org.location,
    iri: `https://${domain}/org/${org.id}`,
  }))
}

function buildDepartments(ast, domain) {
  return ast.departments.map(dept => ({
    id: dept.id,
    name: dept.name,
    parent: dept.parent,
    headcount: dept.headcount,
    iri: `https://${domain}/department/${dept.id}`,
  }))
}

function buildTeams(ast, domain) {
  return ast.teams.map(team => ({
    id: team.id,
    name: team.name,
    size: team.size,
    manager: team.manager,
    repos: team.repos || [],
    department: team.department,
    iri: `https://${domain}/team/${team.id}`,
    getdx_team_id: `gdx_team_${team.id}`,
  }))
}

/**
 * Generate people deterministically from distribution config.
 * @param {import('../dsl/parser.js').UniverseAST} ast
 * @param {ReturnType<import('./rng.js').createSeededRNG>} rng
 * @param {object[]} teams
 * @param {string} domain
 * @returns {object[]}
 */
function generatePeople(ast, rng, teams, domain) {
  const { count, distribution, disciplines } = ast.people
  const people = []
  const usedNames = new Set()

  // Reserve manager names first
  const managerAssignments = new Map()
  for (const team of teams) {
    if (team.manager) {
      const mgrName = MANAGER_NAMES[team.manager] || team.manager
      managerAssignments.set(team.id, mgrName)
      usedNames.add(mgrName)
    }
  }

  // Build level weights
  const levelKeys = Object.keys(distribution)
  const levelWeights = Object.values(distribution)

  // Build discipline weights
  const discKeys = Object.keys(disciplines)
  const discWeights = Object.values(disciplines)

  // Available names pool (excluding reserved manager names)
  const availableNames = GREEK_NAMES.filter(n => !usedNames.has(n))
  const shuffled = rng.shuffle(availableNames)

  // Create managers first
  for (const team of teams) {
    if (team.manager) {
      const mgrName = managerAssignments.get(team.id)
      const level = rng.pick(['L3', 'L4', 'L5'])
      const disc = discKeys.length > 0 ?
        discKeys[rng.weightedPick(discWeights)] :
        'software_engineering'

      const id = mgrName.toLowerCase().replace(/\s+/g, '-')
      people.push({
        id,
        name: mgrName,
        email: toEmail(mgrName, domain),
        github: toGithubUsername(mgrName),
        github_username: toGithubUsername(mgrName),
        discipline: disc,
        level,
        track: null,
        team_id: team.id,
        department: team.department,
        is_manager: true,
        manager_email: null,
        hire_date: '2023-01-15',
        iri: `https://${domain}/person/${id}`,
      })
    }
  }

  // Fill remaining people
  let nameIdx = 0
  while (people.length < count && nameIdx < shuffled.length) {
    const name = shuffled[nameIdx++]
    const level = levelKeys[rng.weightedPick(levelWeights)]
    const disc = discKeys[rng.weightedPick(discWeights)]

    // Assign to a team (round-robin with some randomness)
    const team = rng.pick(teams)

    // Find team manager
    const teamManager = people.find(p => p.is_manager && p.team_id === team.id)
    const managerEmail = teamManager ? teamManager.email : null

    const id = name.toLowerCase().replace(/\s+/g, '-')
    people.push({
      id,
      name,
      email: toEmail(name, domain),
      github: toGithubUsername(name),
      github_username: toGithubUsername(name),
      discipline: disc,
      level,
      track: null,
      team_id: team.id,
      department: team.department,
      is_manager: false,
      manager_email: managerEmail,
      hire_date: `2023-${String(rng.randomInt(1, 12)).padStart(2, '0')}-${String(rng.randomInt(1, 28)).padStart(2, '0')}`,
      iri: `https://${domain}/person/${id}`,
    })
  }

  return people
}

function buildProjects(ast, teams, people, domain) {
  return ast.projects.map(proj => ({
    id: proj.id,
    name: proj.name,
    type: proj.type,
    phase: proj.phase || null,
    teams: proj.teams || [],
    timeline_start: proj.timeline_start,
    timeline_end: proj.timeline_end,
    prose_topic: proj.prose_topic || null,
    prose_tone: proj.prose_tone || null,
    iri: `https://${domain}/project/${proj.id}`,
  }))
}

// ─── Activity Generation ─────────────────────────

/**
 * Signal curve multipliers for activity patterns.
 */
const COMMIT_PATTERNS = {
  baseline: 1.0,
  moderate: 1.5,
  elevated: 2.5,
  spike: 4.0,
  sustained_spike: 3.5,
  very_high: 5.0,
}

const PR_PATTERNS = {
  baseline: 1.0,
  moderate: 1.3,
  elevated: 2.0,
  very_high: 3.5,
}

/**
 * Generate all activity data.
 */
function generateActivity(ast, rng, people, teams) {
  const roster = buildRoster(people)
  const activityTeams = buildActivityTeams(ast, teams)
  const snapshots = generateSnapshots(ast)
  const scores = generateScores(ast, rng, snapshots, activityTeams)
  const webhooks = generateWebhooks(ast, rng, people, teams)
  const evidence = generateEvidence(ast, rng, people, teams)

  return { roster, activityTeams, snapshots, scores, webhooks, evidence }
}

function buildRoster(people) {
  return people.map(p => ({
    email: p.email,
    name: p.name,
    github_username: p.github_username,
    discipline: p.discipline,
    level: p.level,
    track: p.track,
    manager_email: p.manager_email,
    team_id: p.team_id,
  }))
}

function buildActivityTeams(ast, teams) {
  const deptMap = new Map(ast.departments.map(d => [d.id, d]))
  const orgMap = new Map(ast.orgs.map(o => [o.id, o]))

  const result = []

  // Add org-level entries
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
      last_changed_at: new Date('2025-01-01').toISOString(),
    })
  }

  // Add department-level entries
  for (const dept of ast.departments) {
    const parentOrg = orgMap.get(dept.parent)
    result.push({
      getdx_team_id: `gdx_dept_${dept.id}`,
      name: dept.name,
      is_parent: true,
      parent_id: parentOrg ? `gdx_org_${parentOrg.id}` : null,
      manager_id: null,
      contributors: dept.headcount,
      reference_id: null,
      ancestors: parentOrg ? [`gdx_org_${parentOrg.id}`] : [],
      last_changed_at: new Date('2025-01-01').toISOString(),
    })
  }

  // Add team-level entries
  for (const team of teams) {
    const dept = deptMap.get(team.department)
    const parentDeptId = dept ? `gdx_dept_${dept.id}` : null
    const parentOrg = dept ? orgMap.get(dept.parent) : null
    const ancestors = []
    if (parentOrg) ancestors.push(`gdx_org_${parentOrg.id}`)
    if (parentDeptId) ancestors.push(parentDeptId)

    result.push({
      getdx_team_id: team.getdx_team_id,
      name: team.name,
      is_parent: false,
      parent_id: parentDeptId,
      manager_id: team.manager ? `gdx_mgr_${team.manager}` : null,
      contributors: team.size,
      reference_id: null,
      ancestors,
      last_changed_at: new Date('2025-01-01').toISOString(),
    })
  }

  return result
}

/**
 * Generate quarterly snapshot metadata.
 */
function generateSnapshots(ast) {
  if (!ast.snapshots) return []

  const snapshots = []
  const [fromYear, fromMonth] = ast.snapshots.quarterly_from.split('-').map(Number)
  const [toYear, toMonth] = ast.snapshots.quarterly_to.split('-').map(Number)

  let year = fromYear
  let month = fromMonth
  let quarter = Math.ceil(month / 3)

  while (year < toYear || (year === toYear && month <= toMonth)) {
    const snapshotId = `snap_${year}_Q${quarter}`
    const scheduledFor = `${year}-${String(month).padStart(2, '0')}-15`
    const completedAt = new Date(year, month, 1).toISOString()

    snapshots.push({
      snapshot_id: snapshotId,
      account_id: ast.snapshots.account_id,
      last_result_change_at: completedAt,
      scheduled_for: scheduledFor,
      completed_at: completedAt,
      completed_count: 180,
      deleted_at: null,
      total_count: ast.people?.count || 211,
    })

    // Advance to next quarter
    month += 3
    if (month > 12) {
      month -= 12
      year++
    }
    quarter = Math.ceil(month / 3)
  }

  return snapshots
}

/**
 * All 14 DX driver IDs.
 */
const ALL_DRIVERS = [
  'clear_direction', 'say_on_priorities', 'requirements_quality',
  'ease_of_release', 'test_efficiency', 'managing_tech_debt',
  'code_review', 'documentation', 'codebase_experience',
  'incident_response', 'learning_culture', 'experimentation',
  'connectedness', 'efficient_processes', 'deep_work',
  'leveraging_user_feedback',
]

const DRIVER_NAMES = {
  clear_direction: 'Clear Direction',
  say_on_priorities: 'Say on Priorities',
  requirements_quality: 'Requirements Quality',
  ease_of_release: 'Ease of Release',
  test_efficiency: 'Test Efficiency',
  managing_tech_debt: 'Managing Tech Debt',
  code_review: 'Code Review',
  documentation: 'Documentation',
  codebase_experience: 'Codebase Experience',
  incident_response: 'Incident Response',
  learning_culture: 'Learning Culture',
  experimentation: 'Experimentation',
  connectedness: 'Connectedness',
  efficient_processes: 'Efficient Processes',
  deep_work: 'Deep Work',
  leveraging_user_feedback: 'Leveraging User Feedback',
}

/**
 * Generate DX scores for each snapshot × team × driver.
 */
function generateScores(ast, rng, snapshots, activityTeams) {
  const scores = []
  const leafTeams = activityTeams.filter(t => !t.is_parent)

  for (const snap of snapshots) {
    const snapDate = new Date(snap.completed_at)

    for (const team of leafTeams) {
      for (const driverId of ALL_DRIVERS) {
        // Base score around 65 with noise
        let baseScore = 65 + rng.gaussian(0, 8)

        // Apply scenario effects
        for (const scenario of ast.scenarios) {
          const start = new Date(scenario.timerange_start + '-01')
          const end = new Date(scenario.timerange_end + '-28')

          if (snapDate >= start && snapDate <= end) {
            for (const affect of scenario.affects) {
              if (team.getdx_team_id === `gdx_team_${affect.team_id}`) {
                const dxDriver = (affect.dx_drivers || []).find(d => d.driver_id === driverId)
                if (dxDriver) {
                  // Progress through scenario timeline
                  const elapsed = (snapDate - start) / (end - start)
                  baseScore += dxDriver.magnitude * elapsed
                }
              }
            }
          }
        }

        // Clamp to 0-100
        const score = Math.max(0, Math.min(100, Math.round(baseScore * 10) / 10))

        scores.push({
          snapshot_id: snap.snapshot_id,
          snapshot_team_id: `st_${snap.snapshot_id}_${team.getdx_team_id}`,
          team_name: team.name,
          getdx_team_id: team.getdx_team_id,
          is_parent: team.is_parent,
          parent_id: team.parent_id,
          ancestors: team.ancestors,
          item_id: driverId,
          item_type: 'driver',
          item_name: DRIVER_NAMES[driverId] || driverId,
          response_count: rng.randomInt(5, team.contributors || 10),
          score,
          contributor_count: team.contributors || 0,
          vs_prev: Math.round(rng.gaussian(0, 3) * 10) / 10,
          vs_org: Math.round(rng.gaussian(0, 5) * 10) / 10,
          vs_50th: Math.round(rng.gaussian(2, 5) * 10) / 10,
          vs_75th: Math.round(rng.gaussian(-3, 5) * 10) / 10,
          vs_90th: Math.round(rng.gaussian(-8, 5) * 10) / 10,
        })
      }
    }
  }

  return scores
}

/**
 * Commit message templates.
 */
const COMMIT_MESSAGES = [
  'Add {feature} endpoint', 'Fix {feature} validation', 'Update {feature} tests',
  'Refactor {feature} module', 'Optimize {feature} performance',
  'Add error handling for {feature}', 'Update {feature} documentation',
  'Implement {feature} caching', 'Add {feature} monitoring',
  'Fix race condition in {feature}', 'Migrate {feature} to new API',
  'Add integration tests for {feature}', 'Clean up {feature} imports',
]

const FEATURES = [
  'authentication', 'pipeline', 'scoring', 'analytics', 'export',
  'batch processing', 'data validation', 'API gateway', 'monitoring',
  'caching', 'search', 'notification', 'scheduling', 'reporting',
]

const PR_TITLES = [
  'Add {feature} support', 'Implement {feature} workflow',
  'Fix {feature} edge cases', 'Upgrade {feature} dependencies',
  'Refactor {feature} architecture', 'Add {feature} tests',
]

const BRANCH_NAMES = [
  'feature/{feature}', 'fix/{feature}', 'refactor/{feature}',
  'chore/{feature}', 'improvement/{feature}',
]

/**
 * Generate individual GitHub webhook payloads.
 */
function generateWebhooks(ast, rng, people, teams) {
  const webhooks = []

  // Time range: from earliest scenario start to latest scenario end
  const scenarioStarts = ast.scenarios.map(s => new Date(s.timerange_start + '-01'))
  const scenarioEnds = ast.scenarios.map(s => new Date(s.timerange_end + '-28'))
  const globalStart = new Date(Math.min(...scenarioStarts, new Date('2024-07-01')))
  const globalEnd = new Date(Math.max(...scenarioEnds, new Date('2026-01-28')))

  // Build team member lookup
  const teamMembers = new Map()
  for (const team of teams) {
    teamMembers.set(team.id, people.filter(p => p.team_id === team.id))
  }

  // Generate week by week
  const oneWeek = 7 * 24 * 60 * 60 * 1000
  let weekStart = new Date(globalStart)
  let deliveryCounter = 0

  while (weekStart < globalEnd) {
    const weekEnd = new Date(weekStart.getTime() + oneWeek)

    for (const team of teams) {
      const members = teamMembers.get(team.id) || []
      if (members.length === 0) continue

      // Calculate activity multiplier from scenarios
      let commitMult = COMMIT_PATTERNS.baseline
      let prMult = PR_PATTERNS.baseline

      for (const scenario of ast.scenarios) {
        const sStart = new Date(scenario.timerange_start + '-01')
        const sEnd = new Date(scenario.timerange_end + '-28')

        if (weekStart >= sStart && weekStart <= sEnd) {
          for (const affect of scenario.affects) {
            if (affect.team_id === team.id) {
              const cm = COMMIT_PATTERNS[affect.github_commits] || 1
              const pm = PR_PATTERNS[affect.github_prs] || 1
              commitMult = Math.max(commitMult, cm)
              prMult = Math.max(prMult, pm)
            }
          }
        }
      }

      // Generate push events
      const pushCount = Math.round(members.length * commitMult * 0.3)
      for (let i = 0; i < pushCount; i++) {
        const author = rng.pick(members)
        const repo = rng.pick(team.repos.length > 0 ? team.repos : ['default-repo'])
        const feature = rng.pick(FEATURES).replace(/\s+/g, '-')
        const message = rng.pick(COMMIT_MESSAGES).replace('{feature}', feature)
        const timestamp = randomDateInRange(rng, weekStart, weekEnd)
        const commitId = generateHash(String(deliveryCounter), author.name, timestamp.toISOString())

        webhooks.push({
          delivery_id: `evt-${String(++deliveryCounter).padStart(8, '0')}`,
          event_type: 'push',
          occurred_at: timestamp.toISOString(),
          payload: {
            ref: 'refs/heads/main',
            commits: [{
              id: commitId + commitId, // 16-char hash
              message,
              timestamp: timestamp.toISOString(),
              added: [`src/${feature}.js`],
              removed: [],
              modified: ['src/index.js'],
            }],
            repository: { full_name: `bionova/${repo}` },
            sender: { login: author.github_username },
          },
        })
      }

      // Generate PR events
      const prCount = Math.round(members.length * prMult * 0.15)
      for (let i = 0; i < prCount; i++) {
        const author = rng.pick(members)
        const repo = rng.pick(team.repos.length > 0 ? team.repos : ['default-repo'])
        const feature = rng.pick(FEATURES).replace(/\s+/g, '-')
        const title = rng.pick(PR_TITLES).replace('{feature}', feature)
        const branch = rng.pick(BRANCH_NAMES).replace('{feature}', feature)
        const timestamp = randomDateInRange(rng, weekStart, weekEnd)
        const prNumber = rng.randomInt(1, 999)

        webhooks.push({
          delivery_id: `evt-${String(++deliveryCounter).padStart(8, '0')}`,
          event_type: 'pull_request',
          occurred_at: timestamp.toISOString(),
          payload: {
            action: rng.pick(['opened', 'closed']),
            number: prNumber,
            pull_request: {
              number: prNumber,
              title,
              state: 'open',
              user: { login: author.github_username },
              created_at: timestamp.toISOString(),
              updated_at: timestamp.toISOString(),
              additions: rng.randomInt(10, 500),
              deletions: rng.randomInt(0, 100),
              changed_files: rng.randomInt(1, 20),
              merged: false,
              base: { ref: 'main' },
              head: { ref: branch },
            },
            repository: { full_name: `bionova/${repo}` },
            sender: { login: author.github_username },
          },
        })

        // Generate a review for some PRs
        if (rng.random() > 0.4) {
          const reviewer = rng.pick(members.filter(m => m.name !== author.name) || [author])
          const reviewTimestamp = new Date(timestamp.getTime() + rng.randomInt(1, 48) * 3600000)

          webhooks.push({
            delivery_id: `evt-${String(++deliveryCounter).padStart(8, '0')}`,
            event_type: 'pull_request_review',
            occurred_at: reviewTimestamp.toISOString(),
            payload: {
              action: 'submitted',
              review: {
                id: rng.randomInt(10000, 99999),
                user: { login: reviewer.github_username },
                state: rng.pick(['approved', 'changes_requested', 'commented']),
                body: rng.pick([
                  'LGTM', 'Looks good to me!', 'Nice work.',
                  'A few minor comments.', 'Please address the feedback.',
                  'Approved with minor suggestions.',
                ]),
                submitted_at: reviewTimestamp.toISOString(),
              },
              pull_request: { number: prNumber },
              repository: { full_name: `bionova/${repo}` },
              sender: { login: reviewer.github_username },
            },
          })
        }
      }
    }

    weekStart = weekEnd
  }

  return webhooks
}

/**
 * Generate evidence records for scenario-affected teams.
 */
function generateEvidence(ast, rng, people, teams) {
  const evidence = []
  const proficiencyOrder = ['awareness', 'foundational', 'working', 'practitioner', 'expert']

  for (const scenario of ast.scenarios) {
    const sStart = new Date(scenario.timerange_start + '-01')
    const sEnd = new Date(scenario.timerange_end + '-28')

    for (const affect of scenario.affects) {
      const team = teams.find(t => t.id === affect.team_id)
      if (!team) continue

      const teamPeople = people.filter(p => p.team_id === team.id)
      const floorIdx = proficiencyOrder.indexOf(affect.evidence_floor)

      for (const person of teamPeople) {
        for (const skillId of (affect.evidence_skills || [])) {
          // Proficiency at or above the floor
          const profIdx = Math.min(
            proficiencyOrder.length - 1,
            Math.max(floorIdx, floorIdx + rng.randomInt(0, 1))
          )

          evidence.push({
            person_email: person.email,
            person_name: person.name,
            skill_id: skillId,
            proficiency: proficiencyOrder[profIdx],
            scenario_id: scenario.id,
            team_id: team.id,
            observed_at: randomDateInRange(rng, sStart, sEnd).toISOString(),
            source: 'synthetic',
          })
        }
      }
    }
  }

  return evidence
}

/**
 * Generate a random Date within a range.
 */
function randomDateInRange(rng, start, end) {
  const diff = end.getTime() - start.getTime()
  return new Date(start.getTime() + rng.random() * diff)
}

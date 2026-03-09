/**
 * YAML Renderer — generates framework YAML files for Map.
 *
 * Copies existing framework YAML structure and generates
 * self-assessment data aligned with universe entities.
 */

import YAML from 'yaml'

/**
 * Render YAML data files from entities.
 * @param {object} entities
 * @returns {Map<string,string>} path → YAML content
 */
export function renderYAML(entities) {
  const files = new Map()

  files.set('self-assessments.yaml', renderSelfAssessments(entities))
  files.set('roster.yaml', renderRoster(entities))
  files.set('teams.yaml', renderTeams(entities))

  return files
}

/**
 * Render self-assessments for universe people.
 * @param {object} entities
 * @returns {string}
 */
function renderSelfAssessments(entities) {
  const assessments = entities.people.map(person => {
    const skills = generateSkillAssessments(person)
    const behaviours = generateBehaviourAssessments(person)

    return {
      id: person.id,
      name: person.name,
      email: person.email,
      discipline: person.discipline,
      level: person.level,
      team: person.team_id,
      submitted: person.hire_date,
      skills,
      behaviours,
    }
  })

  return YAML.stringify({ assessments }, { lineWidth: 120 })
}

/**
 * Render roster YAML for GetDX integration.
 * @param {object} entities
 * @returns {string}
 */
function renderRoster(entities) {
  const roster = entities.people.map(person => ({
    id: person.id,
    name: person.name,
    email: person.email,
    github: person.github,
    team: person.team_id,
    department: person.department,
    discipline: person.discipline,
    level: person.level,
    hire_date: person.hire_date,
    is_manager: person.is_manager || false,
  }))

  return YAML.stringify({ roster }, { lineWidth: 120 })
}

/**
 * Render teams YAML.
 * @param {object} entities
 * @returns {string}
 */
function renderTeams(entities) {
  const teams = entities.teams.map(team => {
    const dept = entities.departments.find(d => d.id === team.department)
    const members = entities.people.filter(p => p.team_id === team.id)
    const manager = members.find(m => m.is_manager)

    return {
      id: team.id,
      name: team.name,
      department: team.department,
      department_name: dept?.name || '',
      manager: manager?.name || '',
      manager_email: manager?.email || '',
      size: team.size,
      members: members.map(m => ({ name: m.name, email: m.email, level: m.level })),
    }
  })

  return YAML.stringify({ teams }, { lineWidth: 120 })
}

// ─── Helpers ─────────────────────────────────────

const PROFICIENCY_IDX = {
  L1: 0, L2: 1, L3: 2, L4: 3, L5: 4,
}

const PROFICIENCY_LEVELS = [
  'awareness', 'foundational', 'working', 'practitioner', 'expert',
]

const MATURITY_LEVELS = [
  'emerging', 'developing', 'practicing', 'role_modeling', 'exemplifying',
]

/**
 * Generate skill proficiency ratings based on person level.
 * @param {object} person
 * @returns {object[]}
 */
function generateSkillAssessments(person) {
  const baseIdx = PROFICIENCY_IDX[person.level] || 0
  const skillNames = [
    'version_control', 'code_review', 'testing', 'deployment',
    'monitoring', 'documentation', 'architecture', 'security',
  ]

  return skillNames.map(skill => {
    // Core skills at level, supporting skills one below
    const idx = Math.max(0, Math.min(4, baseIdx + (Math.random() > 0.5 ? 0 : -1)))
    return { skill, proficiency: PROFICIENCY_LEVELS[idx] }
  })
}

/**
 * Generate behaviour maturity ratings based on person level.
 * @param {object} person
 * @returns {object[]}
 */
function generateBehaviourAssessments(person) {
  const baseIdx = PROFICIENCY_IDX[person.level] || 0
  const behaviourNames = [
    'collaboration', 'communication', 'leadership', 'ownership',
  ]

  return behaviourNames.map(behaviour => {
    const idx = Math.max(0, Math.min(4, baseIdx + (Math.random() > 0.5 ? 0 : -1)))
    return { behaviour, maturity: MATURITY_LEVELS[idx] }
  })
}

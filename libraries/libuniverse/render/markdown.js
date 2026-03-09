/**
 * Markdown Renderer — generates personal knowledge-base content
 * for Basecamp personas.
 *
 * Each persona gets briefing notes, meeting notes, and skill reflections.
 */

/**
 * Render Markdown files for Basecamp personas.
 * @param {object} entities
 * @param {Map<string,string>} prose
 * @returns {Map<string,string>} path → Markdown content
 */
export function renderMarkdown(entities, prose) {
  const files = new Map()
  const basecampContent = entities.content.find(c => c.id === 'basecamp_markdown')
  if (!basecampContent) return files

  const personaCount = basecampContent.personas || 0
  const personaLevels = basecampContent.persona_levels || ['L2', 'L3', 'L4']

  // Select personas: pick people matching persona_levels, up to count
  const candidates = entities.people.filter(p => personaLevels.includes(p.level))
  const personas = candidates.slice(0, personaCount)

  for (const person of personas) {

    const team = entities.teams.find(t => t.id === person.team_id)
    const dept = entities.departments.find(d => d.id === person.department)
    const prefix = `personas/${person.id}`

    // Daily briefing
    const briefing = prose.get(`briefing_${person.id}`) ||
      `Morning briefing for ${person.name}, ${person.discipline} ${person.level} on ${team?.name || 'their team'}.`
    files.set(`${prefix}/daily-briefing.md`, renderBriefing(person, team, dept, briefing))

    // Weekly notes
    const weeklyNote = prose.get(`weekly_${person.id}`) ||
      `Weekly reflection for ${person.name}.`
    files.set(`${prefix}/weekly-notes.md`, renderWeeklyNotes(person, team, weeklyNote))

    // Skill reflections
    files.set(`${prefix}/skill-reflections.md`, renderSkillReflections(person, entities))

    // Project notes — for projects this person is involved in
    const personProjects = entities.projects.filter(proj => {
      const projectTeams = proj.teams || []
      return projectTeams.includes(person.team_id)
    })
    for (const proj of personProjects) {
      const projNote = prose.get(`project_note_${person.id}_${proj.id}`) ||
        `Notes on ${proj.name} from ${person.name}'s perspective.`
      files.set(`${prefix}/project-${proj.id}.md`, renderProjectNote(person, proj, projNote))
    }
  }

  return files
}

// ─── Internal renderers ──────────────────────────

/**
 * @param {object} person
 * @param {object} team
 * @param {object} dept
 * @param {string} briefing
 * @returns {string}
 */
function renderBriefing(person, team, dept, briefing) {
  return `---
type: briefing
person: ${person.id}
date: ${new Date().toISOString().split('T')[0]}
---

# Daily Briefing — ${person.name}

**Role:** ${person.discipline} ${person.level}
**Team:** ${team?.name || 'Unknown'} (${dept?.name || 'Unknown'})
**Email:** ${person.email}

## Today's Focus

${briefing}

## Quick Stats

- Team size: ${team?.size || '?'}
- Level: ${person.level}
- Manager: ${person.is_manager ? 'Yes' : 'No'}
`
}

/**
 * @param {object} person
 * @param {object} team
 * @param {string} weeklyNote
 * @returns {string}
 */
function renderWeeklyNotes(person, team, weeklyNote) {
  return `---
type: weekly
person: ${person.id}
---

# Weekly Notes — ${person.name}

**Week of:** ${new Date().toISOString().split('T')[0]}
**Team:** ${team?.name || 'Unknown'}

## Reflections

${weeklyNote}

## Action Items

- [ ] Review team priorities
- [ ] Update skill assessments
- [ ] Check project milestones
`
}

/**
 * @param {object} person
 * @param {object} entities
 * @returns {string}
 */
function renderSkillReflections(person, entities) {
  const lines = [
    '---',
    `type: skill-reflection`,
    `person: ${person.id}`,
    '---',
    '',
    `# Skill Reflections — ${person.name}`,
    '',
    `**Discipline:** ${person.discipline}`,
    `**Level:** ${person.level}`,
    '',
    '## Current Proficiency Areas',
    '',
  ]

  const skillNames = [
    'version_control', 'code_review', 'testing', 'deployment',
    'monitoring', 'documentation', 'architecture', 'security',
  ]

  const levelToIdx = { L1: 0, L2: 1, L3: 2, L4: 3, L5: 4 }
  const proficiencies = [
    'awareness', 'foundational', 'working', 'practitioner', 'expert',
  ]
  const baseIdx = levelToIdx[person.level] || 0

  for (const skill of skillNames) {
    const idx = Math.min(4, baseIdx)
    const label = skill.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    lines.push(`- **${label}:** ${proficiencies[idx]}`)
  }

  lines.push('')
  lines.push('## Growth Areas')
  lines.push('')

  if (baseIdx < 4) {
    lines.push(`Target: Move from ${proficiencies[baseIdx]} to ${proficiencies[baseIdx + 1]} in key areas.`)
  } else {
    lines.push('Currently at expert level. Focus on mentoring and knowledge sharing.')
  }

  return lines.join('\n')
}

/**
 * @param {object} person
 * @param {object} project
 * @param {string} note
 * @returns {string}
 */
function renderProjectNote(person, project, note) {
  return `---
type: project-note
person: ${person.id}
project: ${project.id}
---

# ${project.name} — Notes

**Author:** ${person.name}
**Project Type:** ${project.type}
**Timeline:** ${project.timeline_start} to ${project.timeline_end}

## Notes

${note}

## Key Dates

- Start: ${project.timeline_start}
- End: ${project.timeline_end}
`
}

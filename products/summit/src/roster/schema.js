/**
 * Validate a roster against loaded Map standard data.
 *
 * Checks each person's `job.discipline`, `job.level`, and optional
 * `job.track` against the loaded standard definitions. Returns a
 * structured result without throwing — callers decide whether to fail
 * or warn based on command context (the `validate` command exits
 * non-zero; analytical commands warn and proceed).
 */

/**
 * @typedef {object} Issue
 * @property {string} code
 * @property {string} message
 * @property {object} [context]
 */

/**
 * @typedef {object} ValidationResult
 * @property {Issue[]} errors
 * @property {Issue[]} warnings
 */

/**
 * Validate a roster.
 *
 * @param {import("./yaml.js").Roster} roster
 * @param {object} data - Map data object from `createDataLoader().loadAllData()`.
 * @returns {ValidationResult}
 */
export function validateRosterAgainstStandard(roster, data) {
  const errors = [];

  const disciplines = new Set((data.disciplines ?? []).map((d) => d.id));
  const levels = new Set((data.levels ?? []).map((l) => l.id));
  const tracks = new Set((data.tracks ?? []).map((t) => t.id));

  for (const team of roster.teams.values()) {
    validateTeamMembers(team, "teams", { disciplines, levels, tracks }, errors);
  }

  for (const team of roster.projects.values()) {
    validateTeamMembers(
      team,
      "projects",
      { disciplines, levels, tracks },
      errors,
    );
  }

  const warnings = runWarningDetectors(roster, data);

  return { errors, warnings };
}

function validateTeamMembers(team, section, known, errors) {
  for (const member of team.members) {
    const pointer = `${section}.${team.id}[${member.name ?? member.email}]`;

    if (!known.disciplines.has(member.job.discipline)) {
      errors.push({
        code: "UNKNOWN_DISCIPLINE",
        message: `${pointer} job.discipline: "${member.job.discipline}" is not defined in disciplines.`,
        context: {
          team: team.id,
          member: member.email,
          field: "discipline",
          value: member.job.discipline,
        },
      });
    }
    if (!known.levels.has(member.job.level)) {
      errors.push({
        code: "UNKNOWN_LEVEL",
        message: `${pointer} job.level: "${member.job.level}" is not defined in levels.yaml.`,
        context: {
          team: team.id,
          member: member.email,
          field: "level",
          value: member.job.level,
        },
      });
    }
    if (member.job.track && !known.tracks.has(member.job.track)) {
      errors.push({
        code: "UNKNOWN_TRACK",
        message: `${pointer} job.track: "${member.job.track}" is not defined in tracks.`,
        context: {
          team: team.id,
          member: member.email,
          field: "track",
          value: member.job.track,
        },
      });
    }
  }
}

// Lowest ordinalRank in data.levels; null when levels are empty/missing.
function resolveEntryLevelId(data) {
  const levels = data.levels ?? [];
  if (levels.length === 0) return null;
  let entry = levels[0];
  for (const level of levels) {
    if ((level.ordinalRank ?? Infinity) < (entry.ordinalRank ?? Infinity)) {
      entry = level;
    }
  }
  return entry.id;
}

function detectNoSeniorMember(team, entryLevelId) {
  if (!entryLevelId || team.members.length === 0) return [];
  const allEntry = team.members.every((m) => m.job.level === entryLevelId);
  if (!allEntry) return [];
  return [
    {
      code: "NO_SENIOR_MEMBER",
      message: `teams.${team.id}: every member is at entry level "${entryLevelId}". Consider adding a more senior member to mentor and review.`,
      context: { team: team.id, level: entryLevelId },
    },
  ];
}

function detectTracklessAtEntryLevel(team, entryLevelId) {
  if (!entryLevelId) return [];
  const issues = [];
  for (const member of team.members) {
    if (member.job.level !== entryLevelId) continue;
    if (member.job.track) continue;
    issues.push({
      code: "TRACKLESS_AT_ENTRY_LEVEL",
      message: `teams.${team.id}[${member.email}]: entry-level member has no track set. Confirm whether the omission is intentional.`,
      context: { team: team.id, member: member.email, level: entryLevelId },
    });
  }
  return issues;
}

function detectLowAllocationProject(project) {
  if (project.members.length === 0) return [];
  const threshold = 0.5;
  // `parseRosterYaml` substitutes 1.0 for omitted allocation, so every
  // member has a numeric `allocation` here.
  const belowThresholdCount = project.members.filter(
    (m) => m.allocation < threshold,
  ).length;
  if (belowThresholdCount !== project.members.length) return [];
  return [
    {
      code: "LOW_ALLOCATION_PROJECT",
      message: `projects.${project.id}: every member is below ${threshold} allocation. No one is primarily focused on the project.`,
      context: { project: project.id, threshold, belowThresholdCount },
    },
  ];
}

function runWarningDetectors(roster, data) {
  const entryLevelId = resolveEntryLevelId(data);
  const warnings = [];
  for (const team of roster.teams.values()) {
    warnings.push(...detectNoSeniorMember(team, entryLevelId));
    warnings.push(...detectTracklessAtEntryLevel(team, entryLevelId));
  }
  for (const project of roster.projects.values()) {
    warnings.push(...detectLowAllocationProject(project));
  }
  return warnings;
}

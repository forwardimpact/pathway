/**
 * Stable error classes for Summit aggregation.
 *
 * CLI handlers branch on `error.code` rather than string matching —
 * this avoids coupling the handler layer to the human-readable message.
 */

export class TeamNotFoundError extends Error {
  constructor(teamId) {
    super(
      `Team "${teamId}" not found. Run \`fit-summit roster\` to list teams.`,
    );
    this.code = "SUMMIT_TEAM_NOT_FOUND";
    this.teamId = teamId;
  }
}

export class EmptyTeamError extends Error {
  constructor(teamId) {
    super(
      `Team "${teamId}" has no members. Add members to the roster or check the manager email hierarchy.`,
    );
    this.code = "SUMMIT_EMPTY_TEAM";
    this.teamId = teamId;
  }
}

export class UnknownJobFieldError extends Error {
  constructor(field, value) {
    super(
      `Invalid job profile: ${field} "${value}" is not defined in Map data.`,
    );
    this.code = "SUMMIT_UNKNOWN_JOB_FIELD";
    this.field = field;
    this.value = value;
  }
}

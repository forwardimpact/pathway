/**
 * Unified Profile Derivation
 *
 * Shared functions for deriving skill and behaviour profiles for both
 * human jobs and AI agents.
 *
 * - prepareBaseProfile() - full derivation with configurable options
 * - prepareAgentProfile() - convenience wrapper with agent-specific filtering
 *
 * @see policies/predicates.js - Entry-level predicate functions
 * @see policies/filters.js - Matrix-level filter functions
 * @see policies/orderings.js - Comparator functions
 * @see policies/composed.js - Composed policies
 */

import {
  deriveSkillMatrix,
  deriveBehaviourProfile,
  deriveResponsibilities,
} from "./derivation.js";

import {
  isAgentEligible,
  filterHighestLevel,
  compareByLevelDesc,
  compareByMaturityDesc,
} from "./policies/index.js";

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Build set of capabilities with positive track modifiers
 * @param {Object} track - Track definition
 * @returns {Set<string>} Set of capability IDs with positive modifiers
 */
export function getPositiveTrackCapabilities(track) {
  return new Set(
    Object.entries(track.skillModifiers || {})
      .filter(([_, modifier]) => modifier > 0)
      .map(([capability]) => capability),
  );
}

// =============================================================================
// Profile Derivation
// =============================================================================

/**
 * @typedef {Object} ProfileOptions
 * @property {boolean} [excludeHumanOnly=false] - Filter out human-only skills
 * @property {boolean} [keepHighestLevelOnly=false] - Keep only skills at the highest derived level
 * @property {boolean} [sortByLevel=false] - Sort skills by level descending
 * @property {boolean} [sortByMaturity=false] - Sort behaviours by maturity descending
 */

/**
 * @typedef {Object} BaseProfile
 * @property {Array} skillMatrix - Derived skill matrix
 * @property {Array} behaviourProfile - Derived behaviour profile
 * @property {Array} derivedResponsibilities - Derived responsibilities (if capabilities provided)
 * @property {Object} discipline - The discipline
 * @property {Object} track - The track
 * @property {Object} grade - The grade
 */

/**
 * Prepare a base profile shared by jobs and agents
 *
 * This is the unified entry point for profile derivation. Both human jobs
 * and AI agents use this function, with different options:
 *
 * - Human jobs: No filtering, default sorting by type
 * - AI agents: Use prepareAgentProfile() for agent-specific filtering
 *
 * @param {Object} params
 * @param {Object} params.discipline - The discipline
 * @param {Object} params.track - The track
 * @param {Object} params.grade - The grade
 * @param {Array} params.skills - All available skills
 * @param {Array} params.behaviours - All available behaviours
 * @param {Array} [params.capabilities] - Optional capabilities for responsibility derivation
 * @param {ProfileOptions} [params.options={}] - Filtering and sorting options
 * @returns {BaseProfile} The prepared profile
 */
export function prepareBaseProfile({
  discipline,
  track,
  grade,
  skills,
  behaviours,
  capabilities,
  options = {},
}) {
  const {
    excludeHumanOnly = false,
    keepHighestLevelOnly = false,
    sortByLevel = false,
    sortByMaturity = false,
  } = options;

  // Core derivation
  let skillMatrix = deriveSkillMatrix({ discipline, grade, track, skills });
  let behaviourProfile = deriveBehaviourProfile({
    discipline,
    grade,
    track,
    behaviours,
  });

  // Apply skill filters using policy functions
  if (excludeHumanOnly) {
    skillMatrix = skillMatrix.filter(isAgentEligible);
  }
  if (keepHighestLevelOnly) {
    skillMatrix = filterHighestLevel(skillMatrix);
  }

  // Apply sorting using policy comparators
  if (sortByLevel) {
    skillMatrix = [...skillMatrix].sort(compareByLevelDesc);
  }
  if (sortByMaturity) {
    behaviourProfile = [...behaviourProfile].sort(compareByMaturityDesc);
  }

  // Derive responsibilities if capabilities provided
  let derivedResponsibilities = [];
  if (capabilities && capabilities.length > 0) {
    derivedResponsibilities = deriveResponsibilities({
      skillMatrix,
      capabilities,
      track,
    });
  }

  return {
    skillMatrix,
    behaviourProfile,
    derivedResponsibilities,
    discipline,
    track,
    grade,
  };
}

/**
 * Prepare a profile optimized for agent generation
 *
 * Applies agent-specific filtering and sorting:
 * - Excludes human-only skills
 * - Keeps only skills at the highest derived level
 * - Sorts skills by level descending
 * - Sorts behaviours by maturity descending
 *
 * @param {Object} params - Same as prepareBaseProfile, without options
 * @returns {BaseProfile} The prepared profile
 */
export function prepareAgentProfile({
  discipline,
  track,
  grade,
  skills,
  behaviours,
  capabilities,
}) {
  return prepareBaseProfile({
    discipline,
    track,
    grade,
    skills,
    behaviours,
    capabilities,
    options: {
      excludeHumanOnly: true,
      keepHighestLevelOnly: true,
      sortByLevel: true,
      sortByMaturity: true,
    },
  });
}

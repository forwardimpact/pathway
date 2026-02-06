/**
 * Composed Policy Definitions
 *
 * Named policy compositions for specific use cases.
 * Each POLICY_* export defines a complete filtering/sorting strategy.
 *
 * These are the high-level policies used by consuming code.
 */

import { isAgentEligible } from "./predicates.js";
import { filterHighestLevel, composeFilters } from "./filters.js";
import {
  compareByLevelDesc,
  compareByMaturityDesc,
  compareByTypeAndName,
} from "./orderings.js";

// =============================================================================
// Agent Skill Policies
// =============================================================================

/**
 * Filter for agent-eligible skills at highest derived level
 *
 * Agents receive skills after:
 * 1. Excluding human-only skills (isAgentEligible)
 * 2. Keeping only skills at the highest derived level
 *
 * This ensures agents focus on their peak competencies and
 * respects track modifiers (a broad skill boosted to the same
 * level as primary skills will be included).
 */
export const filterAgentSkills = composeFilters(
  isAgentEligible,
  filterHighestLevel,
);

// =============================================================================
// Toolkit Extraction Policy
// =============================================================================

/**
 * Filter for toolkit extraction
 *
 * Tools are extracted only from highest-level skills,
 * keeping the toolkit focused on core competencies.
 */
export const filterToolkitSkills = composeFilters(filterHighestLevel);

// =============================================================================
// Sorting Policies
// =============================================================================

/**
 * Sort skills for agent profiles (level descending)
 * @param {Array} skills - Skill matrix entries
 * @returns {Array} Sorted skills (new array)
 */
export function sortAgentSkills(skills) {
  return [...skills].sort(compareByLevelDesc);
}

/**
 * Sort behaviours for agent profiles (maturity descending)
 * @param {Array} behaviours - Behaviour profile entries
 * @returns {Array} Sorted behaviours (new array)
 */
export function sortAgentBehaviours(behaviours) {
  return [...behaviours].sort(compareByMaturityDesc);
}

/**
 * Sort skills for job display (type ascending, then name)
 * @param {Array} skills - Skill matrix entries
 * @returns {Array} Sorted skills (new array)
 */
export function sortJobSkills(skills) {
  return [...skills].sort(compareByTypeAndName);
}

// =============================================================================
// Combined Filter + Sort Policies
// =============================================================================

/**
 * Prepare skills for agent profile generation
 *
 * Complete pipeline:
 * 1. Filter to agent-eligible skills
 * 2. Keep only highest-level skills
 * 3. Sort by level descending
 *
 * @param {Array} skillMatrix - Full skill matrix
 * @returns {Array} Filtered and sorted skills
 */
export function prepareAgentSkillMatrix(skillMatrix) {
  const filtered = filterAgentSkills(skillMatrix);
  return sortAgentSkills(filtered);
}

/**
 * Prepare behaviours for agent profile generation
 *
 * Sorts by maturity descending (highest first).
 *
 * @param {Array} behaviourProfile - Full behaviour profile
 * @returns {Array} Sorted behaviours
 */
export function prepareAgentBehaviourProfile(behaviourProfile) {
  return sortAgentBehaviours(behaviourProfile);
}

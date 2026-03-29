/**
 * Shared vocabulary constants for synthetic data generation.
 *
 * Single source of truth for proficiency levels, maturity levels,
 * and stage names used across libsyntheticgen, libsyntheticprose,
 * and libsyntheticrender.
 */

/** @type {string[]} */
export const PROFICIENCY_LEVELS = [
  "awareness",
  "foundational",
  "working",
  "practitioner",
  "expert",
];

/** @type {string[]} */
export const MATURITY_LEVELS = [
  "emerging",
  "developing",
  "practicing",
  "role_modeling",
  "exemplifying",
];

/** @type {string[]} */
export const STAGE_NAMES = [
  "specify",
  "plan",
  "scaffold",
  "code",
  "review",
  "deploy",
];

/** @type {Record<string, number>} */
const PROFICIENCY_INDEX = Object.fromEntries(
  PROFICIENCY_LEVELS.map((p, i) => [p, i]),
);

/** @type {Record<string, number>} */
const ARCHETYPE_OFFSET = {
  high_performer: 1,
  steady_contributor: 0,
  new_hire: -1,
  struggling: -2,
};

/**
 * Adjust a proficiency level based on a person's archetype.
 * @param {string} expected - Base proficiency level
 * @param {string} archetype - Person archetype
 * @returns {string} Adjusted proficiency level
 */
export function adjustProficiency(expected, archetype) {
  const base = PROFICIENCY_INDEX[expected];
  if (base === undefined) return expected;
  const offset = ARCHETYPE_OFFSET[archetype] || 0;
  const clamped = Math.max(
    0,
    Math.min(PROFICIENCY_LEVELS.length - 1, base + offset),
  );
  return PROFICIENCY_LEVELS[clamped];
}

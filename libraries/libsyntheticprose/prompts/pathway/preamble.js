/**
 * Shared system preamble for all pathway prompt builders.
 *
 * Establishes consistent voice, terminology, and naming conventions
 * across all 8 entity prompt builders.
 */

import {
  PROFICIENCY_LEVELS,
  MATURITY_LEVELS,
} from "@forwardimpact/libsyntheticgen/vocabulary.js";

/**
 * Build a shared system preamble for pathway prompt builders.
 * @param {string} frameworkName - Name of the framework (or domain fallback)
 * @returns {string}
 */
export function buildPreamble(frameworkName) {
  return [
    `You are writing content for the "${frameworkName}" engineering career framework.`,
    `Use these exact proficiency level names: ${PROFICIENCY_LEVELS.join(", ")}.`,
    `Use these exact maturity level names: ${MATURITY_LEVELS.join(", ")}.`,
    `Write in professional, concise, third-person voice.`,
    `Use consistent terminology across all entities — prefer precise terms over synonyms.`,
  ].join("\n");
}

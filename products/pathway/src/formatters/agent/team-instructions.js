/**
 * Team Instructions Formatter
 *
 * Formats team instructions content into CLAUDE.md file content
 * using a Mustache template.
 */

import Mustache from "mustache";

import { trimValue } from "../shared.js";

/**
 * Format team instructions as CLAUDE.md file content using Mustache template
 * @param {string} teamInstructions - Already-interpolated team instructions content
 * @param {string} template - Mustache template string
 * @returns {string} Rendered CLAUDE.md content
 */
export function formatTeamInstructions(teamInstructions, template) {
  const data = { content: trimValue(teamInstructions) || "" };
  return Mustache.render(template, data);
}

/**
 * Text formatter for the `growth` command.
 */

import { Audience } from "../../lib/audience.js";

const SECTION_HEADERS = {
  critical: "High impact (addresses critical gaps)",
  "spof-reduction": "Medium impact (reduces single points of failure)",
  "coverage-strengthening": "Low impact (strengthens existing coverage)",
};

/**
 * @param {object} params
 * @param {string} params.teamId
 * @param {import("../../aggregation/growth.js").GrowthRecommendation[]} params.recommendations
 * @param {string} params.audience
 * @returns {string}
 */
export function growthToText({ teamId, recommendations, audience }) {
  const lines = [];
  lines.push(`  ${teamId} team — growth opportunities`);
  lines.push("");

  if (recommendations.length === 0) {
    lines.push("  (no growth recommendations — team is well-covered)");
    lines.push("");
    return lines.join("\n");
  }

  const groups = new Map();
  for (const rec of recommendations) {
    if (!groups.has(rec.impact)) groups.set(rec.impact, []);
    groups.get(rec.impact).push(rec);
  }

  for (const impact of Object.keys(SECTION_HEADERS)) {
    const items = groups.get(impact) ?? [];
    if (items.length === 0) continue;
    lines.push(`  ${SECTION_HEADERS[impact]}:`);
    for (const rec of items) {
      lines.push(`    ${rec.skill}`);
      if (rec.driverContext) {
        lines.push(
          `      driver: ${rec.driverContext.driverId} at ${rec.driverContext.percentile}th percentile`,
        );
      }
      lines.push(`      ${formatCandidates(rec, audience)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatCandidates(rec, audience) {
  if (rec.candidates.length === 0) {
    return "(no team members below working for this skill)";
  }
  if (audience === Audience.DIRECTOR) {
    return `${rec.candidates.length} team member(s) at or below ${rec.candidates[0].currentLevel} could develop this skill.`;
  }
  const names = rec.candidates
    .slice(0, 3)
    .map(
      (c) =>
        `${c.name ?? c.email ?? "someone"} (${c.currentLevel}, ${c.currentProficiency})`,
    )
    .join(" or ");
  return `${names} could develop this skill.`;
}

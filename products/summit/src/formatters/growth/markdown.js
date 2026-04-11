/**
 * Minimal markdown formatter for the `growth` command.
 */

import { Audience } from "../../lib/audience.js";

/**
 * @param {object} params
 * @param {string} params.teamId
 * @param {import("../../aggregation/growth.js").GrowthRecommendation[]} params.recommendations
 * @param {string} [params.audience]
 * @returns {string}
 */
export function growthToMarkdown({ teamId, recommendations, audience }) {
  const lines = [];
  lines.push(`# ${teamId} growth recommendations`);
  lines.push("");
  const director = audience === Audience.DIRECTOR;
  for (const rec of recommendations) {
    lines.push(`- **${rec.skill}** (${rec.impact})`);
    if (director) {
      lines.push(
        `  - ${rec.candidates.length} team member(s) could develop this skill`,
      );
    } else {
      for (const cand of rec.candidates) {
        const who = cand.name ?? cand.email ?? "someone";
        lines.push(
          `  - ${who} — ${cand.currentLevel} ${cand.currentProficiency}`,
        );
      }
    }
  }
  return lines.join("\n") + "\n";
}

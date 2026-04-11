/**
 * Minimal markdown formatter for the `growth` command.
 */

/**
 * @param {object} params
 * @param {string} params.teamId
 * @param {import("../../aggregation/growth.js").GrowthRecommendation[]} params.recommendations
 * @returns {string}
 */
export function growthToMarkdown({ teamId, recommendations }) {
  const lines = [];
  lines.push(`# ${teamId} growth recommendations`);
  lines.push("");
  for (const rec of recommendations) {
    lines.push(`- **${rec.skillId}** (${rec.impact})`);
    for (const cand of rec.candidates) {
      const who = cand.name ?? cand.email ?? "someone";
      lines.push(
        `  - ${who} — ${cand.currentLevel} ${cand.currentProficiency}`,
      );
    }
  }
  return lines.join("\n") + "\n";
}

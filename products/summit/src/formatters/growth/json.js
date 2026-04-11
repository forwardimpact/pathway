/**
 * JSON formatter for the `growth` command.
 */

import { Audience } from "../../lib/audience.js";

/**
 * @param {object} params
 * @param {string} params.teamId
 * @param {import("../../aggregation/growth.js").GrowthRecommendation[]} params.recommendations
 * @param {string} params.audience
 * @returns {object}
 */
export function growthToJson({ teamId, recommendations, audience }) {
  const directorMode = audience === Audience.DIRECTOR;
  return {
    team: teamId,
    recommendations: recommendations.map((rec) => ({
      skillId: rec.skillId,
      impact: rec.impact,
      driverContext: rec.driverContext ?? null,
      candidates: rec.candidates.map((c) =>
        directorMode
          ? {
              currentLevel: c.currentLevel,
              currentProficiency: c.currentProficiency,
              targetLevel: c.targetLevel,
            }
          : c,
      ),
    })),
  };
}

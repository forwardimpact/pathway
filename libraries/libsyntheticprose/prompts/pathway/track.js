import { buildPreamble } from "./preamble.js";

/**
 * Prompt template for a single track entity.
 *
 * @param {object} skeleton - Track skeleton { id, name }
 * @param {object} ctx - Universe context (includes capabilityIds, behaviourIds)
 * @param {object} schema - JSON schema for track
 * @returns {{ system: string, user: string }}
 */
export function buildTrackPrompt(skeleton, ctx, schema, priorOutput) {
  return {
    system:
      buildPreamble(ctx.frameworkName || ctx.domain) +
      "\n\n" +
      [
        "You are an expert career framework author.",
        "Output ONLY valid JSON. No markdown fences, no explanations.",
        `The organization domain is: ${ctx.domain}.`,
        `Industry: ${ctx.industry}.`,
      ].join(" "),

    user: [
      "Generate a track definition for a career framework.",
      "",
      "## JSON Schema (you MUST conform to this exactly)",
      "```json",
      JSON.stringify(schema, null, 2),
      "```",
      "",
      `## Skeleton`,
      `Track ID: ${skeleton.id}`,
      `Track name: ${skeleton.name}`,
      "",
      `## Available capability IDs: ${(ctx.capabilityIds || []).join(", ")}`,
      `## Available behaviour IDs: ${(ctx.behaviourIds || []).join(", ")}`,
      "",
      "## Instructions",
      "- name: Use the provided name exactly.",
      "- description: 2-3 sentences describing this track's focus.",
      "- roleContext: 1-2 sentences contextualizing the role for job listings.",
      "- skillModifiers: Object mapping capability IDs to integer modifiers.",
      "  Use values from -1 to 1. Include modifiers for capabilities most",
      "  affected by this track specialization.",
      "- behaviourModifiers: Object mapping behaviour IDs to integer modifiers.",
      "  Include 1-2 relevant modifiers.",
      "- assessmentWeights: { skillWeight, behaviourWeight } summing to 1.",
      "- agent.identity: 1 sentence identity override for the agent when working in this track.",
      "  May use {roleTitle} placeholder. Example: 'You specialize in platform infrastructure.'",
      "- agent.priority: 1 sentence stating the track-specific priority.",
      "- agent.constraints: 1-2 additional constraints specific to this track.",
      "",
      ...(priorOutput?.levels ||
      priorOutput?.behaviours ||
      priorOutput?.capabilities
        ? [
            "",
            "## Previously generated context",
            ...(priorOutput.levels && Array.isArray(priorOutput.levels)
              ? [
                  "Level titles:",
                  ...priorOutput.levels.map(
                    (l) => `- ${l.id}: ${l.professionalTitle || l.id}`,
                  ),
                ]
              : []),
            ...(priorOutput.behaviours && Array.isArray(priorOutput.behaviours)
              ? [
                  "Behaviour names:",
                  ...priorOutput.behaviours.map(
                    (b) => `- ${b._id || b.id}: ${b.name || b._id || b.id}`,
                  ),
                ]
              : []),
            ...(priorOutput.capabilities &&
            Array.isArray(priorOutput.capabilities)
              ? [
                  "Capability names and skill IDs:",
                  ...priorOutput.capabilities.map(
                    (c) =>
                      `- ${c._id || c.id}: ${c.name || c._id || c.id} (skills: ${(c.skills || []).map((s) => s.id || s).join(", ")})`,
                  ),
                ]
              : []),
          ]
        : []),
      "",
      "Output a single JSON object for this track.",
    ].join("\n"),
  };
}

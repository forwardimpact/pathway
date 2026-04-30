import { buildPreamble } from "./preamble.js";
import { buildPriorContextLines } from "./prior-context.js";

/**
 * Prompt template for a single track entity.
 *
 * @param {object} skeleton - Track skeleton { id, name }
 * @param {object} ctx - Terrain context (includes capabilityIds, behaviourIds)
 * @param {object} schema - JSON schema for track
 * @returns {{ system: string, user: string }}
 */
export function buildTrackPrompt(skeleton, ctx, schema, priorOutput) {
  return {
    system:
      buildPreamble(ctx.standardName || ctx.domain) +
      "\n\n" +
      [
        "You are an expert author of agent-aligned engineering standards.",
        "Output ONLY valid JSON. No markdown fences, no explanations.",
        `The organization domain is: ${ctx.domain}.`,
        `Industry: ${ctx.industry}.`,
      ].join(" "),

    user: [
      "Generate a track definition for an agent-aligned engineering standard.",
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
      "- behaviourModifiers: Object mapping behaviour IDs to integer modifiers (+1 or -1).",
      "  Include 1-2 modifiers that emphasize behaviours important for THIS track,",
      "  and that DIFFER from sibling tracks. For example: SRE should boost outcome",
      "  ownership; Platform should boost systems thinking; Security should boost",
      "  precise communication; ML Ops should boost relentless curiosity.",
      "  Track behaviour emphasis must be visible in the modifiers — homogeneous",
      "  modifiers across tracks defeat the purpose.",
      "- assessmentWeights: { skillWeight, behaviourWeight } summing to 1.",
      "- agent.identity: 1 sentence identity override for the agent when working in this track.",
      "  May use {roleTitle} placeholder. Example: 'You specialize in platform infrastructure.'",
      "- agent.priority: 1 sentence stating the track-specific priority.",
      "- agent.constraints: 1-2 additional constraints specific to this track.",
      "- agent.teamInstructions: 2-3 sentences of cross-cutting context for an",
      "  agent team specialized in this track. Describe coordination patterns the",
      "  team must follow, what to prioritize, what to avoid. May reference",
      "  {roleTitle} and {specialization} as placeholders — these are substituted",
      "  at generation time. This drives the team's CLAUDE.md file.",
      "",
      ...buildPriorContextLines(priorOutput),
      "",
      "Output a single JSON object for this track.",
    ].join("\n"),
  };
}

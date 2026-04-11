import { buildPreamble } from "./preamble.js";
import { MATURITY_LEVELS } from "@forwardimpact/libsyntheticgen/vocabulary.js";

/**
 * Prompt template for a single behaviour entity.
 *
 * @param {object} skeleton - Behaviour skeleton { id, name }
 * @param {object} ctx - Universe context
 * @param {object} schema - JSON schema for behaviour
 * @returns {{ system: string, user: string }}
 */
export function buildBehaviourPrompt(skeleton, ctx, schema, priorOutput) {
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
      "Generate a behaviour definition for a career framework.",
      "",
      "## JSON Schema (you MUST conform to this exactly)",
      "```json",
      JSON.stringify(schema, null, 2),
      "```",
      "",
      `## Behaviour: "${skeleton.name}" (ID: ${skeleton.id})`,
      "",
      "## Instructions",
      "- name: Use the provided name exactly.",
      "- human.description: 2-3 sentences describing this behaviour.",
      "- human.maturityDescriptions: One paragraph per maturity level",
      `  (${MATURITY_LEVELS.join(", ")}).`,
      '  Use second-person ("You..."). Each level must show clear',
      "  progression in depth, consistency, and influence.",
      "- agent.title: Short title (2-4 words) for how the agent applies this behaviour.",
      "- agent.workingStyle: 1-2 sentences describing how the AI agent should embody",
      "  this behaviour in its work style and communication.",
      "",
      ...(priorOutput?.levels
        ? [
            "",
            "## Previously generated context",
            "Level titles and proficiency baselines:",
            ...(Array.isArray(priorOutput.levels)
              ? priorOutput.levels.map(
                  (l) =>
                    `- ${l.id}: ${l.professionalTitle || l.id} (primary: ${l.baseSkillProficiencies?.primary || "N/A"})`,
                )
              : []),
          ]
        : []),
      "",
      "Output a single JSON object for this behaviour file.",
    ].join("\n"),
  };
}

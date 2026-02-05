/**
 * Toolkit Derivation Functions
 *
 * Derives a de-duplicated list of tools from a skill matrix by looking up
 * toolReferences from skill definitions.
 */

/**
 * @typedef {Object} ToolkitEntry
 * @property {string} name - Tool name
 * @property {string} description - Tool description
 * @property {string} [url] - Tool documentation URL
 * @property {string} [simpleIcon] - Simple Icons slug for the tool icon
 * @property {string[]} skillIds - IDs of skills that reference this tool
 */

/**
 * Derive a de-duplicated toolkit from a skill matrix
 *
 * Extracts all tools referenced by skills in the matrix, de-duplicates by name,
 * and collects which skills reference each tool.
 *
 * @param {Object} params
 * @param {Array<{skillId: string}>} params.skillMatrix - Skill matrix with skill IDs
 * @param {Array} params.skills - All skill definitions with toolReferences
 * @returns {ToolkitEntry[]} De-duplicated toolkit sorted by name
 */
export function deriveToolkit({ skillMatrix, skills }) {
  // Build skill lookup map for O(1) access
  const skillMap = new Map(skills.map((s) => [s.id, s]));

  // Tool map for de-duplication: name -> ToolkitEntry
  const toolMap = new Map();

  for (const entry of skillMatrix) {
    const skill = skillMap.get(entry.skillId);
    if (!skill?.toolReferences) continue;

    for (const tool of skill.toolReferences) {
      const existing = toolMap.get(tool.name);
      if (existing) {
        // Add skill ID if not already present
        if (!existing.skillIds.includes(skill.id)) {
          existing.skillIds.push(skill.id);
        }
        // Prefer first occurrence's metadata, but fill in missing values
        if (!existing.url && tool.url) {
          existing.url = tool.url;
        }
        if (!existing.simpleIcon && tool.simpleIcon) {
          existing.simpleIcon = tool.simpleIcon;
        }
      } else {
        toolMap.set(tool.name, {
          name: tool.name,
          description: tool.description,
          url: tool.url,
          simpleIcon: tool.simpleIcon,
          skillIds: [skill.id],
        });
      }
    }
  }

  // Sort by name and return
  return Array.from(toolMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

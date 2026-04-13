/**
 * Agent DOM Formatter
 *
 * Formats agent deployment data into DOM elements for browser display.
 * Includes copy and download functionality.
 */

import { div, h2, p, button, section } from "../../lib/render.js";
import { createCodeDisplay } from "../../components/code-display.js";
import { formatAgentProfile } from "./profile.js";
import { formatAgentSkill } from "./skill.js";

/**
 * Convert agent deployment to DOM elements
 * @param {Object} deployment - Generated deployment
 * @param {Object} deployment.profile - Agent profile
 * @param {Array} deployment.skills - Agent skills
 * @param {Array} [deployment.roleAgents] - Role variant agents (plan, review)
 * @param {Object} [deployment.claudeCodeSettings] - Claude Code settings to include in download
 * @param {string|null} [deployment.teamInstructions] - Team instructions content for CLAUDE.md
 * @returns {HTMLElement}
 */
export function agentDeploymentToDOM({
  profile,
  skills,
  roleAgents = [],
  claudeCodeSettings = {},
  teamInstructions = null,
}) {
  const profileContent = formatAgentProfile(profile);
  const agentName = profile.frontmatter.name;

  return div(
    { className: "agent-deployment" },

    // Download all button
    createDownloadButton(
      profile,
      skills,
      roleAgents,
      claudeCodeSettings,
      agentName,
      teamInstructions,
    ),

    // Profile section
    section(
      { className: "agent-section" },
      h2({}, "Agent Profile"),
      createCodeDisplay({
        content: profileContent,
        filename: profile.filename,
        maxHeight: 600,
      }),
    ),

    // Role Agents section
    roleAgents.length > 0
      ? section(
          { className: "agent-section" },
          h2({}, `Role Variants (${roleAgents.length})`),
          p(
            { className: "text-muted" },
            "Specialized agents for specific workflow phases. These can be used as subagents or standalone.",
          ),
          div(
            { className: "role-agents-list" },
            ...roleAgents.map((agent) => createRoleAgentCard(agent)),
          ),
        )
      : null,

    // Skills section
    section(
      { className: "agent-section" },
      h2({}, `Skills (${skills.length})`),
      skills.length > 0
        ? div(
            { className: "skills-list" },
            ...skills.map((skill) => createSkillCard(skill)),
          )
        : p(
            { className: "text-muted" },
            "No skills with agent sections found for this discipline.",
          ),
    ),
  );
}

/**
 * Create download all button
 * @param {Object} profile - Agent profile
 * @param {Array} skills - Agent skills
 * @param {Array} roleAgents - Role variant agents
 * @param {Object} claudeCodeSettings - Claude Code settings to include
 * @param {string} agentName - Agent name for zip filename
 * @param {string|null} teamInstructions - Team instructions content for CLAUDE.md
 * @returns {HTMLElement}
 */
function createDownloadButton(
  profile,
  skills,
  roleAgents,
  claudeCodeSettings,
  agentName,
  teamInstructions,
) {
  const btn = button(
    { className: "btn btn-primary download-all-btn" },
    "📦 Download All (.zip)",
  );

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Generating...";

    try {
      await downloadAllAsZip(
        profile,
        skills,
        roleAgents,
        claudeCodeSettings,
        agentName,
        teamInstructions,
      );
    } finally {
      btn.disabled = false;
      btn.textContent = "📦 Download All (.zip)";
    }
  });

  return btn;
}

/**
 * Create a skill card with content and copy button
 * @param {Object} skill - Skill with frontmatter and body
 * @returns {HTMLElement}
 */
function createSkillCard(skill) {
  const content = formatAgentSkill(skill);
  const filename = `${skill.dirname}/SKILL.md`;

  return div(
    { className: "skill-card" },
    createCodeDisplay({
      content,
      filename,
      maxHeight: 300,
    }),
  );
}

/**
 * Create a role agent card with collapsible content
 * @param {Object} agent - Role agent with frontmatter, body, filename
 * @returns {HTMLElement}
 */
function createRoleAgentCard(agent) {
  const content = formatAgentProfile(agent);

  return createCodeDisplay({
    content,
    filename: agent.filename,
    description: agent.frontmatter.description,
    maxHeight: 400,
  });
}

/**
 * Download all agent files as a ZIP
 * @param {Object} profile - Agent profile
 * @param {Array} skills - Agent skills
 * @param {Array} roleAgents - Role variant agents
 * @param {Object} claudeCodeSettings - Claude Code settings to include
 * @param {string} agentName - Agent name for zip filename
 * @param {string|null} teamInstructions - Team instructions content for CLAUDE.md
 */
async function downloadAllAsZip(
  profile,
  skills,
  roleAgents,
  claudeCodeSettings,
  agentName,
  teamInstructions,
) {
  // Dynamically import JSZip
  const JSZip = await importJSZip();
  const zip = new JSZip();

  // Add main profile to .claude/agents/ folder
  const profileContent = formatAgentProfile(profile);
  zip.file(`.claude/agents/${profile.filename}`, profileContent);

  // Add team instructions to .claude/CLAUDE.md
  if (teamInstructions) {
    zip.file(".claude/CLAUDE.md", teamInstructions.trim() + "\n");
  }

  // Add role agent profiles to .claude/agents/ folder
  for (const roleAgent of roleAgents) {
    const roleContent = formatAgentProfile(roleAgent);
    zip.file(`.claude/agents/${roleAgent.filename}`, roleContent);
  }

  // Add skills to .claude/skills/ folder
  for (const skill of skills) {
    const skillContent = formatAgentSkill(skill);
    zip.file(`.claude/skills/${skill.dirname}/SKILL.md`, skillContent);
  }

  // Add Claude Code settings
  if (Object.keys(claudeCodeSettings).length > 0) {
    zip.file(
      ".claude/settings.json",
      JSON.stringify(claudeCodeSettings, null, 2) + "\n",
    );
  }

  // Generate and download
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${agentName}-agent.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Dynamically import JSZip from CDN
 * @returns {Promise<typeof JSZip>}
 */
async function importJSZip() {
  // Use dynamic import from CDN
  const module = await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");
  return module.default;
}

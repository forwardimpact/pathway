/**
 * Download button component for agent builder page
 */

import { formatAgentProfile } from "../formatters/agent/profile.js";
import {
  formatAgentSkill,
  formatInstallScript,
  formatReference,
} from "../formatters/agent/skill.js";

/**
 * Dynamically import JSZip from CDN
 * @returns {Promise<typeof JSZip>}
 */
async function importJSZip() {
  const module = await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");
  return module.default;
}

/**
 * Add skill files to a zip archive
 * @param {Object} zip - JSZip instance
 * @param {Array} skillFiles - Skill file objects
 * @param {Object} templates - Templates object
 */
function addSkillsToZip(zip, skillFiles, templates) {
  for (const skill of skillFiles) {
    const content = formatAgentSkill(skill, templates.skill);
    zip.file(`.claude/skills/${skill.dirname}/SKILL.md`, content);

    if (skill.installScript) {
      const installContent = formatInstallScript(skill, templates.install);
      zip.file(
        `.claude/skills/${skill.dirname}/scripts/install.sh`,
        installContent,
        { unixPermissions: "755" },
      );
    }

    if (skill.implementationReference) {
      const refContent = formatReference(skill, templates.reference);
      zip.file(
        `.claude/skills/${skill.dirname}/references/REFERENCE.md`,
        refContent,
      );
    }
  }
}

/**
 * Add Claude Code settings to a zip archive
 * @param {Object} zip - JSZip instance
 * @param {Object} claudeCodeSettings
 */
function addSettingsToZip(zip, claudeCodeSettings, vscodeSettings) {
  if (Object.keys(claudeCodeSettings).length > 0) {
    zip.file(
      ".claude/settings.json",
      JSON.stringify(claudeCodeSettings, null, 2) + "\n",
    );
  }
  if (Object.keys(vscodeSettings).length > 0) {
    zip.file(
      ".vscode/settings.json",
      JSON.stringify(vscodeSettings, null, 2) + "\n",
    );
  }
}

/**
 * Trigger a browser download of a blob
 * @param {Blob} blob
 * @param {string} filename
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Create download button for agent profiles and skills
 * @param {Array} profiles - Agent profiles
 * @param {Array} skillFiles - Deduplicated skill files
 * @param {Object} claudeCodeSettings - Claude Code settings
 * @param {Object} vscodeSettings - VS Code settings
 * @param {{agent: string, skill: string}} templates - Mustache templates
 * @param {string|null} teamInstructionsContent - Rendered CLAUDE.md content
 * @returns {HTMLElement}
 */
export function createDownloadButton(
  profiles,
  skillFiles,
  claudeCodeSettings,
  vscodeSettings,
  templates,
  teamInstructionsContent,
) {
  const btn = document.createElement("button");
  btn.className = "btn btn-primary download-all-btn";
  btn.textContent = "📥 Download Agent (.zip)";

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Generating...";

    try {
      const JSZip = await importJSZip();
      const zip = new JSZip();

      for (const profile of profiles) {
        const content = formatAgentProfile(profile, templates.agent);
        zip.file(`.claude/agents/${profile.filename}`, content);
      }

      addSkillsToZip(zip, skillFiles, templates);
      addSettingsToZip(zip, claudeCodeSettings, vscodeSettings);

      if (teamInstructionsContent) {
        zip.file(".claude/CLAUDE.md", teamInstructionsContent);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const filename =
        profiles.length === 1
          ? `${profiles[0].frontmatter.name}-agent.zip`
          : "agent-team.zip";
      downloadBlob(blob, filename);
    } finally {
      btn.disabled = false;
      btn.textContent = "📥 Download Agent (.zip)";
    }
  });

  return btn;
}

/**
 * Agent builder install section
 *
 * Surfaces the ecosystem-tool install commands (direct download, Microsoft APM,
 * and `npx skills`) for the currently selected discipline/track pack. The packs
 * themselves are emitted by `fit-pathway build` when
 * `standard.distribution.siteUrl` is configured — see spec 520 and
 * `products/pathway/src/commands/build-packs.js`. The pack name derivation
 * here must stay in sync with that generator so the command points at an
 * archive that actually exists on the deployed site.
 */

import { code, div, h2, p, section } from "../lib/render.js";
import {
  getDisciplineAbbreviation,
  toKebabCase,
} from "@forwardimpact/libskill/agent";
import { createCommandPrompt } from "../components/command-prompt.js";

/** Stable id for the install section heading (for aria-labelledby). */
const INSTALL_HEADING_ID = "agent-builder-install-heading";

/**
 * Derive the pack archive name for a discipline/track combination.
 * Must match `build-packs.js` → `${abbrev}-${toKebabCase(track.id)}`.
 * @param {{id: string}} discipline
 * @param {{id: string}} track
 * @returns {string}
 */
export function getPackName(discipline, track) {
  return `${getDisciplineAbbreviation(discipline.id)}-${toKebabCase(track.id)}`;
}

/**
 * Normalize a site URL by stripping a trailing slash. Matches the
 * normalization applied by `generatePacks` so the displayed URL lines up
 * with the manifest entries.
 * @param {string} siteUrl
 * @returns {string}
 */
function normalizeSiteUrl(siteUrl) {
  return siteUrl.replace(/\/$/, "");
}

/**
 * Build the `curl | tar` command for direct raw pack extraction.
 * @param {string} siteUrl
 * @param {string} packName
 * @returns {string}
 */
export function getRawCommand(siteUrl, packName) {
  const url = `${normalizeSiteUrl(siteUrl)}/packs/${packName}.raw.tar.gz`;
  return `curl -sL ${url} | tar xz`;
}

/**
 * Build the `apm unpack` command for a specific APM pack bundle.
 * @param {string} siteUrl
 * @param {string} packName
 * @returns {string}
 */
export function getApmCommand(siteUrl, packName) {
  const url = `${normalizeSiteUrl(siteUrl)}/packs/${packName}.apm.tar.gz`;
  return `curl -sLO ${url} && apm unpack ${packName}.apm.tar.gz`;
}

/**
 * Build the `npx skills add` command that discovers the per-pack skill
 * repository at `<siteUrl>/packs/<packName>/.well-known/skills/index.json`.
 * @param {string} siteUrl
 * @param {string} packName
 * @returns {string}
 */
export function getSkillsCommand(siteUrl, packName) {
  return `npx skills add ${normalizeSiteUrl(siteUrl)}/packs/${packName}`;
}

/**
 * Render the install section for the selected agent combination. Returns
 * `null` when no site URL is configured (no packs have been published, so
 * there is nothing meaningful to install) so the caller can skip rendering.
 * @param {Object} params
 * @param {{id: string}} params.discipline - Selected human discipline
 * @param {{id: string}} params.track - Selected human track
 * @param {string|undefined} params.siteUrl - Standard distribution site URL
 * @returns {HTMLElement|null}
 */
export function createInstallSection({ discipline, track, siteUrl }) {
  if (!siteUrl) return null;

  const packName = getPackName(discipline, track);
  const rawCommand = getRawCommand(siteUrl, packName);
  const apmCommand = getApmCommand(siteUrl, packName);
  const skillsCommand = getSkillsCommand(siteUrl, packName);

  return section(
    {
      className: "agent-install-section",
      "aria-labelledby": INSTALL_HEADING_ID,
    },
    div(
      { className: "agent-install-header" },
      h2({ id: INSTALL_HEADING_ID }, "📦 Install This Agent Team"),
      p(
        { className: "text-muted agent-install-description" },
        "Install the pre-built pack for this discipline × track combination " +
          "directly through an ecosystem package manager. The pack contains " +
          "the same agent profile, skills, team instructions, and Claude Code " +
          "settings shown below — installed into your project's ",
        code({}, ".claude/"),
        " directory.",
      ),
    ),
    div(
      { className: "agent-install-commands" },
      div(
        { className: "agent-install-command" },
        p({ className: "agent-install-command-label" }, "Direct download"),
        createCommandPrompt(rawCommand),
        p(
          { className: "text-muted agent-install-note" },
          "Recommended. Installs everything: skills, agents, CLAUDE.md, and settings (Claude Code + VS Code).",
        ),
      ),
      div(
        { className: "agent-install-command" },
        p({ className: "agent-install-command-label" }, "Microsoft APM"),
        createCommandPrompt(apmCommand),
        p(
          { className: "text-muted agent-install-note" },
          "Installs skills, agents, and team instructions. Does not include settings.",
        ),
      ),
      div(
        { className: "agent-install-command" },
        p({ className: "agent-install-command-label" }, "npx skills"),
        createCommandPrompt(skillsCommand),
        p(
          { className: "text-muted agent-install-note" },
          "Installs skills only. Does not include agents or CLAUDE.md.",
        ),
      ),
    ),
  );
}

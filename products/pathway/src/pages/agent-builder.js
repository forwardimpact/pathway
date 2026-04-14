/**
 * Agent builder page
 *
 * Single scrollable view for generating AI coding agent team configurations.
 * Multi-select checkboxes for disciplines and tracks; generates one agent
 * per discipline x track combination.
 */

import { render, div, h1, h2, p, label } from "../lib/render.js";
import { getState } from "../lib/state.js";
import { loadAgentDataBrowser } from "../lib/yaml-loader.js";
import { deriveReferenceLevel } from "@forwardimpact/libskill/agent";
import {
  createMultiDisciplineSelect,
  createMultiTrackSelect,
} from "../lib/form-controls.js";
import { createReactive } from "../lib/reactive.js";
import {
  createAgentPreview,
  createHelpSection,
} from "./agent-builder-preview.js";
import { createInstallSection } from "./agent-builder-install.js";
import { createDownloadTeamButton } from "./agent-builder-download.js";

/** @type {Object|null} Cached agent data */
let agentDataCache = null;

/** @type {{agent: string, skill: string}|null} Cached templates */
let templateCache = null;

/**
 * Load agent data with caching
 * @param {string} dataDir - Data directory path
 * @returns {Promise<Object>}
 */
async function getAgentData(dataDir = "./data") {
  if (!agentDataCache) {
    agentDataCache = await loadAgentDataBrowser(dataDir);
  }
  return agentDataCache;
}

/**
 * Load templates with caching
 * @returns {Promise<{agent: string, skill: string, install: string, reference: string}>}
 */
async function getTemplates() {
  if (!templateCache) {
    const [agentRes, skillRes, installRes, referenceRes] = await Promise.all([
      fetch("./templates/agent.template.md"),
      fetch("./templates/skill.template.md"),
      fetch("./templates/skill-install.template.sh"),
      fetch("./templates/skill-reference.template.md"),
    ]);
    templateCache = {
      agent: await agentRes.text(),
      skill: await skillRes.text(),
      install: await installRes.text(),
      reference: await referenceRes.text(),
    };
  }
  return templateCache;
}

/**
 * Render agent builder page
 */
export async function renderAgentBuilder() {
  const { data } = getState();
  const siteUrl = data.framework?.distribution?.siteUrl;

  // Show loading state
  render(
    div(
      { className: "agent-builder-page wide" },
      div({ className: "loading" }, p({}, "Loading agent definitions...")),
    ),
  );

  // Load agent-specific data and templates
  const [agentData, templates] = await Promise.all([
    getAgentData(),
    getTemplates(),
  ]);

  // Filter to only disciplines/tracks that have agent definitions
  const agentDisciplineIds = new Set(agentData.disciplines.map((d) => d.id));
  const agentTrackIds = new Set(agentData.tracks.map((t) => t.id));

  const availableDisciplines = data.disciplines.filter((d) =>
    agentDisciplineIds.has(d.id),
  );
  const allAgentTracks = data.tracks.filter((t) => agentTrackIds.has(t.id));

  /**
   * Get tracks valid for a discipline that also have agent definitions
   * @param {string} disciplineId - Discipline ID
   * @returns {Array} - Valid tracks for the discipline
   */
  function getValidTracksForDiscipline(disciplineId) {
    const discipline = data.disciplines.find((d) => d.id === disciplineId);
    if (!discipline) return [];

    const validTracks = discipline.validTracks ?? [];
    const validTrackIds = validTracks.filter((t) => t !== null);

    return allAgentTracks.filter((t) => validTrackIds.includes(t.id));
  }

  /**
   * Get the union of valid tracks across multiple disciplines
   * @param {Set<string>} disciplineIds - Selected discipline IDs
   * @returns {Array} - Unique tracks valid for any selected discipline
   */
  function getUnionTracks(disciplineIds) {
    const seen = new Set();
    const result = [];
    for (const dId of disciplineIds) {
      for (const track of getValidTracksForDiscipline(dId)) {
        if (!seen.has(track.id)) {
          seen.add(track.id);
          result.push(track);
        }
      }
    }
    return result;
  }

  // Parse URL params for pre-selection
  // Supports: #/agent/d1,d2/t1,t2 (comma-separated)
  const hash = window.location.hash;
  const pathMatch = hash.match(
    // eslint-disable-next-line security/detect-unsafe-regex -- negated char classes prevent backtracking; parses internal URL hash
    /#\/agent\/([^/]+)(?:\/([^/?]+))?/,
  );
  const initialDisciplines = pathMatch
    ? new Set(pathMatch[1].split(",").filter(Boolean))
    : new Set();
  const initialTracks =
    pathMatch && pathMatch[2]
      ? new Set(pathMatch[2].split(",").filter(Boolean))
      : new Set();

  // Reactive selection state
  const selection = createReactive({
    disciplines: initialDisciplines,
    tracks: initialTracks,
  });

  // Track checkbox container — rebuilt when disciplines change
  const trackContainer = div({ className: "form-group" });

  /**
   * Rebuild the track checkbox group for the currently selected disciplines
   */
  function rebuildTrackCheckboxes() {
    const { disciplines, tracks } = selection.get();
    const unionTracks = getUnionTracks(disciplines);

    trackContainer.innerHTML = "";
    trackContainer.appendChild(label({ className: "form-label" }, "Tracks"));

    if (disciplines.size === 0) {
      trackContainer.appendChild(
        p({ className: "text-muted" }, "Select at least one discipline first."),
      );
      return;
    }

    if (unionTracks.length === 0) {
      trackContainer.appendChild(
        p(
          { className: "text-muted" },
          "No tracks available for selected disciplines.",
        ),
      );
      return;
    }

    // Prune tracks that are no longer valid
    const validIds = new Set(unionTracks.map((t) => t.id));
    for (const tId of tracks) {
      if (!validIds.has(tId)) tracks.delete(tId);
    }

    trackContainer.appendChild(
      createMultiTrackSelect({
        id: "agent-track-select",
        tracks: unionTracks,
        selected: tracks,
        onChange: (updated) => {
          selection.update((prev) => ({ ...prev, tracks: updated }));
        },
      }),
    );
  }

  // Preview container
  const previewContainer = div(
    { className: "agent-preview" },
    createEmptyState(availableDisciplines.length, allAgentTracks.length),
  );

  /**
   * Compute valid discipline x track combinations from current selection
   * @param {Set<string>} disciplines
   * @param {Set<string>} tracks
   * @returns {Array<{humanDiscipline, humanTrack, agentDiscipline, agentTrack}>}
   */
  function computeCombinations(disciplines, tracks) {
    const combos = [];
    for (const dId of disciplines) {
      const validTracks = getValidTracksForDiscipline(dId);
      for (const t of validTracks) {
        if (!tracks.has(t.id)) continue;
        const humanDiscipline = data.disciplines.find((d) => d.id === dId);
        const humanTrack = data.tracks.find((tr) => tr.id === t.id);
        const agentDiscipline = agentData.disciplines.find((d) => d.id === dId);
        const agentTrack = agentData.tracks.find((tr) => tr.id === t.id);
        if (humanDiscipline && humanTrack && agentDiscipline && agentTrack) {
          combos.push({
            humanDiscipline,
            humanTrack,
            agentDiscipline,
            agentTrack,
          });
        }
      }
    }
    return combos;
  }

  /**
   * Update the preview when selection changes
   * @param {Object} sel - Current selection
   */
  function updatePreview({ disciplines, tracks }) {
    // Update URL
    if (disciplines.size > 0) {
      const dPart = [...disciplines].join(",");
      const tPart = tracks.size > 0 ? `/${[...tracks].join(",")}` : "";
      const newHash = `#/agent/${dPart}${tPart}`;
      if (window.location.hash !== newHash) {
        history.replaceState(null, "", newHash);
      }
    }

    previewContainer.innerHTML = "";

    const combos = computeCombinations(disciplines, tracks);

    if (combos.length === 0) {
      previewContainer.appendChild(
        createEmptyState(availableDisciplines.length, allAgentTracks.length),
      );
      return;
    }

    const level = deriveReferenceLevel(data.levels);

    // Collect all profiles and skill files for team download
    const allProfiles = [];
    const allSkillFiles = [];
    const seenSkillDirs = new Set();

    for (const combo of combos) {
      const context = {
        ...combo,
        level,
        skills: data.skills,
        capabilities: data.capabilities,
        behaviours: data.behaviours,
        agentBehaviours: agentData.behaviours,
        claudeCodeSettings: agentData.claudeCodeSettings,
        templates,
      };

      // Install section per combo
      const installSection = createInstallSection({
        discipline: combo.humanDiscipline,
        track: combo.humanTrack,
        siteUrl,
      });
      if (installSection) {
        previewContainer.appendChild(installSection);
      }

      const { preview, profile, skillFiles } = createAgentPreview(context);
      previewContainer.appendChild(preview);

      allProfiles.push(profile);
      for (const sf of skillFiles) {
        if (!seenSkillDirs.has(sf.dirname)) {
          seenSkillDirs.add(sf.dirname);
          allSkillFiles.push(sf);
        }
      }
    }

    // Team download button at the top if multiple agents
    if (combos.length > 1) {
      previewContainer.prepend(
        createDownloadTeamButton(
          allProfiles,
          allSkillFiles,
          agentData.claudeCodeSettings,
          templates,
        ),
      );
    }
  }

  // Subscribe to selection changes
  selection.subscribe(updatePreview);

  // Build the page
  const page = div(
    { className: "agent-builder-page wide" },
    // Header
    div(
      { className: "page-header" },
      h1({ className: "page-title" }, "Agent Team Builder"),
      p(
        { className: "page-description" },
        "Generate coding agent teams from discipline x track combinations. " +
          "Select multiple disciplines and tracks to build a full team. " +
          "Export complete agent profiles and skill files for Claude Code.",
      ),
    ),

    // Form section
    div(
      { className: "agent-builder-form" },
      h2({}, "Select Components"),
      div(
        { className: "auto-grid-sm gap-lg" },
        // Discipline multi-select
        div(
          { className: "form-group" },
          label({ className: "form-label" }, "Disciplines"),
          availableDisciplines.length > 0
            ? createMultiDisciplineSelect({
                id: "agent-discipline-select",
                disciplines: availableDisciplines,
                selected: selection.get().disciplines,
                onChange: (updated) => {
                  selection.update((prev) => ({
                    ...prev,
                    disciplines: updated,
                  }));
                  rebuildTrackCheckboxes();
                },
                getDisplayName: (d) => d.specialization || d.name,
              })
            : p(
                { className: "text-muted" },
                "No disciplines have agent definitions.",
              ),
        ),
        // Track multi-select (dynamically rebuilt)
        trackContainer,
      ),
    ),

    // Preview section
    previewContainer,

    // Help section
    createHelpSection(),
  );

  render(page);

  // Initialize track checkboxes and trigger preview if pre-selected
  rebuildTrackCheckboxes();
  if (initialDisciplines.size > 0 && initialTracks.size > 0) {
    updatePreview(selection.get());
  }
}

/**
 * Create empty state message
 * @param {number} disciplineCount - Number of available disciplines
 * @param {number} trackCount - Number of available tracks
 * @returns {HTMLElement}
 */
function createEmptyState(disciplineCount, trackCount) {
  if (disciplineCount === 0 || trackCount === 0) {
    return div(
      { className: "empty-state" },
      p(
        { className: "text-muted" },
        "No agent definitions found. Add agent.yaml files to disciplines and tracks.",
      ),
    );
  }

  return div(
    { className: "empty-state" },
    p(
      { className: "text-muted" },
      "Select disciplines and tracks to generate an agent team.",
    ),
  );
}

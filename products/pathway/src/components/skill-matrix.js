/**
 * Skill matrix display component
 */

/** @typedef {import('../types.js').SkillMatrixItem} SkillMatrixItem */

import {
  div,
  span,
  table,
  thead,
  tbody,
  tr,
  th,
  td,
  a,
} from "../lib/render.js";
import { getSkillProficiencyIndex } from "../lib/render.js";
import { createLevelCell } from "./detail.js";
import { createBadge } from "./card.js";
import { SKILL_PROFICIENCY_ORDER } from "@forwardimpact/map/levels";
import { truncate } from "../formatters/shared.js";

/**
 * Sort skills by level descending (expert first), then alphabetically
 * @param {SkillMatrixItem[]} skills
 * @returns {SkillMatrixItem[]}
 */
function sortByLevelDescending(skills) {
  return [...skills].sort((a, b) => {
    const levelA = SKILL_PROFICIENCY_ORDER.indexOf(a.level);
    const levelB = SKILL_PROFICIENCY_ORDER.indexOf(b.level);
    if (levelB !== levelA) {
      return levelB - levelA;
    }
    return a.skillName.localeCompare(b.skillName);
  });
}

/**
 * Create a skill matrix table
 * @param {SkillMatrixItem[]} skillMatrix - Skill matrix entries
 * @returns {HTMLElement}
 */
export function createSkillMatrix(skillMatrix) {
  if (!skillMatrix || skillMatrix.length === 0) {
    return div({ className: "empty-state" }, "No skills in matrix");
  }

  const sortedSkills = sortByLevelDescending(skillMatrix);

  const rows = sortedSkills.map((skill) => {
    const levelIndex = getSkillProficiencyIndex(skill.proficiency);

    return tr(
      { className: skill.isHumanOnly ? "human-only-row" : "" },
      td(
        {},
        a({ href: `#/skill/${skill.skillId}` }, skill.skillName),
        skill.isHumanOnly
          ? span(
              {
                className: "human-only-indicator",
                title:
                  "Human-Only — Requires interpersonal skills; excluded from agents",
              },
              " 🤲",
            )
          : null,
      ),
      td({}, createBadge(skill.capability, skill.capability)),
      createLevelCell(levelIndex, 5, skill.proficiency),
      td(
        { className: "skill-description" },
        truncate(skill.proficiencyDescription, 80),
      ),
    );
  });

  return div(
    { className: "table-container" },
    table(
      { className: "table matrix-table skill-matrix" },
      thead(
        {},
        tr(
          {},
          th({}, "Skill"),
          th({}, "Capability"),
          th({}, "Level"),
          th({}, "Description"),
        ),
      ),
      tbody({}, ...rows),
    ),
  );
}

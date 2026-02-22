/**
 * Level presentation helpers
 *
 * Shared utilities for formatting level data across DOM and markdown outputs.
 */

/**
 * Get level display name (shows both professional and management titles)
 * @param {Object} level
 * @returns {string}
 */
export function getLevelDisplayName(level) {
  if (level.professionalTitle && level.managementTitle) {
    if (level.professionalTitle === level.managementTitle) {
      return level.professionalTitle;
    }
    return `${level.professionalTitle} / ${level.managementTitle}`;
  }
  return level.professionalTitle || level.managementTitle || level.id;
}

/**
 * @typedef {Object} LevelListItem
 * @property {string} id
 * @property {string} displayName
 * @property {number} ordinalRank
 * @property {string|null} typicalExperienceRange
 * @property {Object} baseSkillProficiencies
 * @property {string|null} impactScope
 */

/**
 * Transform levels for list view
 * @param {Array} levels - Raw level entities
 * @returns {{ items: LevelListItem[] }}
 */
export function prepareLevelsList(levels) {
  const sortedLevels = [...levels].sort(
    (a, b) => a.ordinalRank - b.ordinalRank,
  );

  const items = sortedLevels.map((level) => ({
    id: level.id,
    displayName: getLevelDisplayName(level),
    ordinalRank: level.ordinalRank,
    typicalExperienceRange: level.typicalExperienceRange || null,
    baseSkillProficiencies: level.baseSkillProficiencies || {},
    impactScope: level.expectations?.impactScope || null,
  }));

  return { items };
}

/**
 * @typedef {Object} LevelDetailView
 * @property {string} id
 * @property {string} displayName
 * @property {string} professionalTitle
 * @property {string} managementTitle
 * @property {number} ordinalRank
 * @property {string|null} typicalExperienceRange
 * @property {Object} baseSkillProficiencies
 * @property {Object} baseBehaviourMaturity
 * @property {Object} expectations
 */

/**
 * Transform level for detail view
 * @param {Object} level - Raw level entity
 * @returns {LevelDetailView|null}
 */
export function prepareLevelDetail(level) {
  if (!level) return null;

  return {
    id: level.id,
    displayName: getLevelDisplayName(level),
    professionalTitle: level.professionalTitle || null,
    managementTitle: level.managementTitle || null,
    ordinalRank: level.ordinalRank,
    typicalExperienceRange: level.typicalExperienceRange || null,
    baseSkillProficiencies: level.baseSkillProficiencies || {},
    baseBehaviourMaturity: level.baseBehaviourMaturity || {},
    expectations: level.expectations || {},
  };
}

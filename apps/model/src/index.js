/**
 * @forwardimpact/model
 *
 * Pure business logic for Engineering Pathway framework.
 */

// Core derivation
export {
  buildSkillTypeMap,
  getSkillTypeForDiscipline,
  findMaxBaseSkillLevel,
  deriveSkillLevel,
  deriveBehaviourMaturity,
  deriveSkillMatrix,
  deriveBehaviourProfile,
  isValidJobCombination,
  generateJobTitle,
  deriveResponsibilities,
  deriveJob,
  calculateDriverCoverage,
  getDisciplineSkillIds,
  getGradeLevel,
  isSeniorGrade,
  generateAllJobs,
} from "./derivation.js";

// Job operations
export {
  prepareJobDetail,
  prepareJobSummary,
  prepareJobBuilderPreview,
} from "./job.js";

// Job caching
export {
  makeJobKey,
  getOrCreateJob,
  clearJobCache,
  invalidateJob,
  getCacheSize,
} from "./job-cache.js";

// Modifiers
export {
  isCapability,
  getSkillsByCapability,
  buildCapabilityToSkillsMap,
  expandSkillModifiers,
  extractCapabilityModifiers,
  extractIndividualModifiers,
  resolveSkillModifier,
} from "./modifiers.js";

// Matching
export {
  MatchTier,
  MATCH_TIER_CONFIG,
  classifyMatchTier,
  GAP_SCORES,
  calculateGapScore,
  calculateJobMatch,
  findMatchingJobs,
  estimateBestFitGrade,
  findRealisticMatches,
  deriveDevelopmentPath,
  findNextStepJob,
  analyzeCandidate,
} from "./matching.js";

// Progression
export {
  calculateSkillChanges,
  calculateBehaviourChanges,
  analyzeProgression,
  analyzeGradeProgression,
  analyzeTrackComparison,
  getValidTracksForComparison,
  getNextGrade,
  getPreviousGrade,
  analyzeCustomProgression,
  getValidGradeTrackCombinations,
} from "./progression.js";

// Interview
export {
  deriveInterviewQuestions,
  deriveShortInterview,
  deriveBehaviourQuestions,
  deriveFocusedInterview,
} from "./interview.js";

// Agent generation
export {
  deriveReferenceGrade,
  getDisciplineAbbreviation,
  toKebabCase,
  deriveAgentSkills,
  deriveAgentBehaviours,
  generateSkillMd,
  validateAgentProfile,
  validateAgentSkill,
  deriveHandoffs,
  deriveStageAgent,
  generateStageAgentProfile,
  buildAgentIndex,
} from "./agent.js";

// Checklists
export { deriveChecklist, formatChecklistMarkdown } from "./checklist.js";

// Toolkit
export { deriveToolkit } from "./toolkit.js";

// Profile derivation
export {
  getPositiveTrackCapabilities,
  prepareBaseProfile,
  prepareAgentProfile,
} from "./profile.js";

// Policies - re-export key items for convenience
export {
  // Thresholds
  THRESHOLD_MATCH_STRONG,
  THRESHOLD_MATCH_GOOD,
  THRESHOLD_MATCH_STRETCH,
  THRESHOLD_MATCH_ASPIRATIONAL,
  SCORE_GAP,
  WEIGHT_SKILL_TYPE,
  WEIGHT_CAPABILITY_BOOST,
  // Predicates
  isHumanOnly,
  isAgentEligible,
  isPrimary,
  isSecondary,
  isBroad,
  isTrack,
  isCore,
  isSupporting,
  hasMinLevel,
  allOf,
  anyOf,
  not,
  // Filters
  filterHighestLevel,
  filterAboveAwareness,
  applyFilters,
  composeFilters,
  // Orderings
  ORDER_SKILL_TYPE,
  ORDER_STAGE,
  ORDER_AGENT_STAGE,
  compareByLevelDesc,
  compareByType,
  compareBySkillPriority,
  compareByMaturityDesc,
  compareByBehaviourPriority,
  // Composed policies
  filterAgentSkills,
  filterToolkitSkills,
  sortAgentSkills,
  sortAgentBehaviours,
  prepareAgentSkillMatrix,
  prepareAgentBehaviourProfile,
} from "./policies/index.js";

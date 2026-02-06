/**
 * Policy Thresholds, Scores, and Weights
 *
 * Named constants for filter thresholds, scoring, and priority weights.
 * Grep for THRESHOLD_, SCORE_, WEIGHT_ to find all policy values.
 */

// =============================================================================
// Match Tier Thresholds
// =============================================================================

/**
 * Match tier score thresholds
 *
 * These thresholds determine how candidate match scores are classified.
 * Adjust these to change how lenient/strict match tiers are.
 *
 * @see matching.js:classifyMatchTier
 */
export const THRESHOLD_MATCH_STRONG = 0.85;
export const THRESHOLD_MATCH_GOOD = 0.7;
export const THRESHOLD_MATCH_STRETCH = 0.55;
export const THRESHOLD_MATCH_ASPIRATIONAL = 0;

// =============================================================================
// Gap Score Decay
// =============================================================================

/**
 * Gap score decay values
 *
 * When a candidate has a gap between their level and the job requirement,
 * these scores penalize larger gaps more heavily.
 *
 * @see matching.js:calculateGapScore
 */
export const SCORE_GAP_MEETS = 1.0;
export const SCORE_GAP_MINOR = 0.7;
export const SCORE_GAP_SIGNIFICANT = 0.4;
export const SCORE_GAP_MAJOR = 0.15;
export const SCORE_GAP_ASPIRATIONAL = 0.05;

/** Gap scores indexed by gap size (0-4+) */
export const SCORE_GAP = {
  0: SCORE_GAP_MEETS,
  1: SCORE_GAP_MINOR,
  2: SCORE_GAP_SIGNIFICANT,
  3: SCORE_GAP_MAJOR,
  4: SCORE_GAP_ASPIRATIONAL,
};

// =============================================================================
// Skill Priority Weights
// =============================================================================

/**
 * Skill priority weights by type
 *
 * Primary skills are core competencies and get highest priority.
 * Used for interview question selection and development prioritization.
 *
 * @see interview.js:calculateSkillPriority
 */
export const WEIGHT_SKILL_TYPE_PRIMARY = 30;
export const WEIGHT_SKILL_TYPE_SECONDARY = 20;
export const WEIGHT_SKILL_TYPE_BROAD = 10;
export const WEIGHT_SKILL_TYPE_TRACK = 5;

/** Skill type weights as object for lookup */
export const WEIGHT_SKILL_TYPE = {
  primary: WEIGHT_SKILL_TYPE_PRIMARY,
  secondary: WEIGHT_SKILL_TYPE_SECONDARY,
  broad: WEIGHT_SKILL_TYPE_BROAD,
  track: WEIGHT_SKILL_TYPE_TRACK,
};

// =============================================================================
// Capability Priority Boosts
// =============================================================================

/**
 * Capability priority boosts
 *
 * Certain capabilities get additional priority in the AI-era engineering model.
 *
 * @see interview.js:calculateSkillPriority
 */
export const WEIGHT_CAPABILITY_AI = 15;
export const WEIGHT_CAPABILITY_DELIVERY = 5;

/** Capability boosts as object for lookup */
export const WEIGHT_CAPABILITY_BOOST = {
  ai: WEIGHT_CAPABILITY_AI,
  delivery: WEIGHT_CAPABILITY_DELIVERY,
};

// =============================================================================
// Behaviour Priority Weights
// =============================================================================

/**
 * Base behaviour priority weight
 *
 * @see interview.js:calculateBehaviourPriority
 */
export const WEIGHT_BEHAVIOUR_BASE = 15;

/**
 * Behaviour maturity multiplier
 *
 * Each maturity level adds this amount to the priority.
 */
export const WEIGHT_BEHAVIOUR_MATURITY = 3;

// =============================================================================
// Interview Ratios
// =============================================================================

/**
 * Default ratio of interview time allocated to skills vs behaviours
 *
 * 0.6 = 60% skills, 40% behaviours
 */
export const RATIO_SKILL_BEHAVIOUR = 0.6;

// =============================================================================
// Skill Level Multipliers
// =============================================================================

/**
 * Skill level multiplier for priority calculation
 *
 * Higher skill levels get proportionally more priority.
 */
export const WEIGHT_SKILL_LEVEL = 2;

/**
 * Priority penalty for below-level questions
 */
export const WEIGHT_BELOW_LEVEL_PENALTY = -5;

// =============================================================================
// Development Path Weights
// =============================================================================

/**
 * Type multipliers for development path prioritization
 *
 * Primary skills are more critical to develop first.
 */
export const WEIGHT_DEV_TYPE_PRIMARY = 3;
export const WEIGHT_DEV_TYPE_SECONDARY = 2;
export const WEIGHT_DEV_TYPE_BROAD = 1;

/**
 * AI capability boost for development paths
 *
 * AI skills get extra emphasis in development planning.
 */
export const WEIGHT_DEV_AI_BOOST = 1.5;

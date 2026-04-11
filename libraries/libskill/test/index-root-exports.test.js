/**
 * Regression test for the root package import.
 *
 * The root `src/index.js` re-exports a curated surface from several
 * submodules. Re-exporting a name from the wrong submodule produces an
 * ESM `SyntaxError: export 'X' not found in './module.js'` at link time —
 * which no existing test catches because every other test imports
 * directly from its submodule under test. This test imports the root,
 * which exercises the full re-export graph and fails loudly if any
 * re-export is misrouted.
 *
 * History: `getSkillTypeForDiscipline` was re-exported from `./modifiers.js`
 * but defined in `./derivation.js`, silently breaking the root import.
 * The bug was only discovered when a new consumer (outside the monorepo's
 * own import conventions) tried to import from the package root.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import * as libskill from "@forwardimpact/libskill";

test("root import resolves without ESM link errors", () => {
  // If any re-export in src/index.js points at the wrong submodule,
  // the import above throws at module-graph link time and this test
  // never even runs. Arrival here already means the root links cleanly.
  assert.ok(libskill, "root import returned a module namespace");
});

test("every documented export is callable from the root", () => {
  // Keep this list aligned with src/index.js. Any function that the
  // root re-exports should appear here so misrouted re-exports break
  // immediately.
  const expected = [
    // Core derivation
    "deriveSkillMatrix",
    "deriveBehaviourProfile",
    "generateJobTitle",
    "generateJobId",
    "deriveJob",
    "getDisciplineSkillIds",
    "getSkillTypeForDiscipline",
    "generateAllJobs",
    "isValidJobCombination",
    "deriveResponsibilities",
    // Job operations
    "prepareJobDetail",
    "prepareJobSummary",
    "prepareJobBuilderPreview",
    // Job caching
    "buildJobKey",
    "createJobCache",
    // Modifiers
    "isCapability",
    "getSkillsByCapability",
    "buildCapabilityToSkillsMap",
    "expandModifiersToSkills",
    "extractCapabilityModifiers",
    "extractSkillModifiers",
    "resolveSkillModifier",
    // Matching
    "calculateJobMatch",
    "findMatchingJobs",
    "estimateBestFitLevel",
    "findRealisticMatches",
    // Development path
    "deriveDevelopmentPath",
    "findNextStepJob",
    "analyzeCandidate",
    // Progression
    "analyzeProgression",
    "analyzeLevelProgression",
    "analyzeTrackComparison",
    "getValidTracksForComparison",
    "getNextLevel",
    "getPreviousLevel",
    "analyzeCustomProgression",
    "getValidLevelTrackCombinations",
  ];

  for (const name of expected) {
    assert.equal(
      typeof libskill[name],
      "function",
      `libskill.${name} should be a function at the root`,
    );
  }
});

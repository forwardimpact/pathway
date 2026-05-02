---
title: libskill Internals
description: "Derivation engine — job derivation, agent profiles, interview questions, career progression, job matching, and the policies module."
---

Pure business logic for deriving jobs, agent profiles, skill matrices, and
career progression from agent-aligned engineering standard data. All functions
are stateless and side-effect-free — libskill is intentionally exempt from
OO+DI. Do not add classes or constructor injection.

## Module Index

| Module                          | Purpose                                                 |
| ------------------------------- | ------------------------------------------------------- |
| `src/derivation.js`             | Core derivation functions (skills, behaviours, drivers) |
| `src/derivation-responsibilities.js` | Responsibility derivation from capabilities        |
| `src/derivation-validation.js`  | Derivation input validation                             |
| `src/agent.js`                  | Agent profile and skill file generation                 |
| `src/agent-validation.js`       | Agent derivation input validation                       |
| `src/job.js`                    | Job preparation for display                             |
| `src/job-cache.js`              | Job caching for performance                             |
| `src/interview.js`              | Interview question selection                            |
| `src/interview-helpers.js`      | Interview question utilities                            |
| `src/interview-selection.js`    | Interview question filtering and selection              |
| `src/interview-specialized.js`  | Specialized interview question generation               |
| `src/progression.js`            | Career path analysis and gap identification             |
| `src/checklist.js`              | Skill checklist formatting as markdown                  |
| `src/toolkit.js`                | Tool derivation from skill references                   |
| `src/profile.js`                | Profile filtering (human + agent)                       |
| `src/modifiers.js`              | Capability and skill modifier resolution                |
| `src/matching.js`               | Job matching and gap analysis                           |
| `src/matching-development.js`   | Development plan generation from gap analysis           |
| `src/policies/`                 | Ordering, sorting, filtering, and threshold policies    |

---

## Job Derivation

Jobs are derived from `Discipline × Level × Track?`. Every skill goes through a
four-step pipeline.

### Step 1: Determine Skill Type

Each discipline classifies every skill into one of three tiers:

| Tier             | Constant     | Purpose                        |
| ---------------- | ------------ | ------------------------------ |
| coreSkills       | `CORE`       | Deepest expertise for the role |
| supportingSkills | `SUPPORTING` | Supporting capability          |
| broadSkills      | `BROAD`      | General awareness              |

A lookup map is built once per discipline via `buildSkillTypeMap()` for O(1)
access during derivation. Individual lookups use `getSkillTypeForDiscipline()`.

### Step 2: Get Base Proficiency from Level

Each level defines `baseSkillProficiencies` mapping the skill tier (core,
supporting, broad) to a starting proficiency.

### Step 3: Apply Track Modifier

Tracks define capability-based skill modifiers. The modifier for a skill's
capability is added to the base proficiency:

```
derivedIndex = baseLevelIndex + trackModifier
```

Modifiers are resolved via `resolveSkillModifier()` in `modifiers.js`. Tracks
can specify modifiers at capability level (applied to all skills in that
capability) or at individual skill level. Skill-level modifiers take precedence.
Helper functions:

- `expandModifiersToSkills()` — expand capability modifiers to individual skills
- `extractCapabilityModifiers()` / `extractSkillModifiers()` — partition modifier entries

### Step 4: Clamp to Valid Range

Two constraints are applied:

1. **Positive modifier cap** — positive modifiers cannot push the result above
   the level's maximum base proficiency.
2. **Range clamp** — the final result must fall between `awareness` (0) and
   `expert` (4).

The full matrix is assembled by `deriveSkillMatrix()`, which runs the pipeline
for every skill in the discipline.

### Behaviour Derivation

`deriveBehaviourProfile()` uses a simpler formula:

```
Level Base + Discipline Modifier + Track Modifier
```

The result is clamped to a valid maturity range.

### Full Job Assembly

`deriveJob()` composes the full pipeline: skill matrix, behaviour profile,
responsibilities, driver coverage, and job metadata (title, ID). It accepts raw
entities loaded from `data/pathway/` YAML:

```javascript
import { deriveJob } from "@forwardimpact/libskill/derivation";

const job = deriveJob({
  discipline, level, track,
  capabilities, behaviours, skills, drivers,
});
```

`generateAllJobs()` iterates over every valid discipline × level × track
combination and returns the complete job set.

---

## Job Preparation

`job.js` transforms raw derived jobs into view models for display.

| Function                  | Purpose                                     |
| ------------------------- | ------------------------------------------- |
| `prepareJobDetail()`      | Full view model for the job detail page      |
| `prepareJobSummary()`     | Condensed view model for listing pages       |
| `prepareJobBuilderPreview()` | Preview for the interactive job builder    |

`prepareJobDetail` produces these key fields:

- `skillMatrix` — raw skill matrix from derivation
- `behaviourProfile` — raw behaviour profile from derivation
- `derivedResponsibilities` — responsibilities sorted by proficiency desc, skill
  count desc, ordinal rank (used by job description formatter)
- `capabilityOrder` — `string[]` of capability IDs in display order, derived
  from `derivedResponsibilities`. Use this when ordering skills by capability
  instead of extracting order from `derivedResponsibilities` directly.
- `toolkit` — de-duplicated tools from skill references
- `checklists` — stage handoff checklists

`job-cache.js` provides `createJobCache()` and `buildJobKey()` for caching
prepared jobs across page renders.

---

## Agent Profiles

Agent profiles use the same derivation as jobs, filtered for AI-applicable
capabilities:

```
Agent Profile = Discipline × Track × Stage
```

- Uses practitioner-level reference level (`deriveReferenceLevel()`)
- Excludes `isHumanOnly` skills
- Constrained by stage tools and permissions

| Function                      | Purpose                                       |
| ----------------------------- | --------------------------------------------- |
| `deriveAgentSkills()`         | Derive skills for an agent at a given stage    |
| `deriveAgentBehaviours()`     | Derive behaviours for an agent                 |
| `generateAgentProfile()`      | Full YAML agent profile generation             |
| `generateSkillMarkdown()`     | Render skill data as markdown skill files       |
| `buildAgentIndex()`           | Build index of all agent profiles              |
| `interpolateTeamInstructions()` | Fill team instruction templates              |

`profile.js` provides post-processing for both human and agent profiles:

- `prepareAgentProfile()` — excludes `isHumanOnly` skills, keeps only highest
  proficiency per skill, sorts by proficiency descending
- `prepareBaseProfile()` — base filtering for display
- `getPositiveTrackCapabilities()` — capabilities where the track has a positive
  modifier

```javascript
import { generateAgentProfile, deriveAgentSkills } from "@forwardimpact/libskill/agent";
import { prepareAgentProfile } from "@forwardimpact/libskill/profile";
```

---

## Interview Questions

Question selection based on role requirements and time budgets.

| Function                        | Module                    | Purpose                          |
| ------------------------------- | ------------------------- | -------------------------------- |
| `deriveInterviewQuestions()`    | `interview.js`            | Full interview derivation        |
| `deriveShortInterview()`        | `interview.js`            | Time-constrained interview       |
| `deriveBehaviourQuestions()`    | `interview.js`            | Behaviour-only question set      |
| `deriveFocusedInterview()`      | `interview.js`            | Capability-focused interview     |
| `deriveMissionFitInterview()`   | `interview-specialized.js` | Mission/values alignment        |
| `deriveDecompositionInterview()`| `interview-specialized.js` | Problem decomposition skills    |
| `deriveStakeholderInterview()`  | `interview-specialized.js` | Stakeholder management skills   |

Selection helpers in `interview-helpers.js` and `interview-selection.js`:

- `generateSkillCandidates()` / `generateBehaviourCandidates()` — build
  candidate question pools
- `calculateSkillPriority()` / `calculateBehaviourPriority()` — priority scoring
- `selectWithinBudget()` — fit questions to a time budget
- `selectQuestion()` — pick from a pool (random or deterministic)

---

## Career Progression

Analyse differences between any two jobs to identify growth areas.

| Function                      | Purpose                                          |
| ----------------------------- | ------------------------------------------------ |
| `analyzeProgression()`        | Compare two arbitrary jobs                       |
| `analyzeLevelProgression()`   | Compare adjacent levels within same discipline   |
| `analyzeTrackComparison()`    | Compare two tracks at the same level             |
| `analyzeCustomProgression()`  | Compare any two discipline × level × track combos |
| `getNextLevel()` / `getPreviousLevel()` | Navigate level ordering               |
| `getValidTracksForComparison()` | Tracks available for comparison                |
| `getValidLevelTrackCombinations()` | All valid combos for a discipline            |

Internal helpers `calculateSkillChanges()` and `calculateBehaviourChanges()`
diff the skill matrices and behaviour profiles respectively.

```javascript
import { analyzeProgression } from "@forwardimpact/libskill/progression";

const analysis = analyzeProgression(currentJob, targetJob);
```

---

## Job Matching

Score a candidate's self-assessment against derived jobs.

| Function                | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `calculateJobMatch()`   | Score one self-assessment against one job       |
| `findMatchingJobs()`    | Score against all jobs, return ranked list      |
| `estimateBestFitLevel()`| Estimate the best-fit level for a candidate    |
| `classifyMatch()`       | Classify a match score into a tier             |
| `findRealisticMatches()`| Filter matches to realistic level range        |

Match tiers (from `MatchTier`):

| Tier          | Threshold | Meaning                     |
| ------------- | --------- | --------------------------- |
| `STRONG`      | ≥ 85      | Ready now                   |
| `GOOD`        | ≥ 70      | Minor gaps                  |
| `STRETCH`     | ≥ 55      | Significant development     |
| `ASPIRATIONAL`| ≥ 40      | Long-term goal              |
| `EXPLORING`   | < 40      | Major capability gap        |

Development planning in `matching-development.js`:

- `deriveDevelopmentPath()` — ordered growth actions from self-assessment to
  target job
- `findNextStepJob()` — find the best intermediate job on the path
- `analyzeCandidate()` — full candidate analysis (match + development plan)
- `findRealisticMatches()` — filter to achievable jobs within a level range

```javascript
import { calculateJobMatch, findMatchingJobs } from "@forwardimpact/libskill/matching";
import { analyzeCandidate } from "@forwardimpact/libskill/matching";
```

---

## Checklist Formatting

`formatChecklistMarkdown()` in `checklist.js` renders skill checklists as
markdown. Input is an array of `{ skill, capability, items }` entries; output is
a markdown string with capability emoji headers and checkbox lists.

---

## Policies Module

`src/policies/` centralises all tuneable constants, predicates, filters, and
orderings. Import from `@forwardimpact/libskill/policies`.

### Thresholds and Weights

Named constants for match tiers, gap scores, skill tier weights, capability
boosts, behaviour weights, interview ratios, agent profile limits, and driver
coverage thresholds. All derivation and matching logic references these
constants — never use magic numbers.

### Predicates

Composable boolean functions for filtering skills and behaviours:

- Identity: `isAny`, `isNone`
- Agent eligibility: `isHumanOnly`, `isAgentEligible`
- Skill tiers: `isCore`, `isSupporting`, `isBroad`, `isTrack`, `isDeep`, `isBreadth`
- Proficiency: `hasMinLevel`, `hasLevel`, `hasBelowLevel`
- Capabilities: `isInCapability`, `isInAnyCapability`
- Combinators: `allOf`, `anyOf`, `not`

### Filters

Matrix-level filtering operations:

- `matrixFilter()` — filter a skill matrix by predicate
- `filterHighestLevel` / `filterAboveAwareness` — common prebuilt filters
- `filterBy()` / `applyFilters()` / `composeFilters()` — filter composition

### Orderings

Comparator functions for sorting:

- Skill: `compareByLevelDesc`, `compareByType`, `compareBySkillPriority`, etc.
- Capability: `compareByCapability`, `sortSkillsByCapability`
- Behaviour: `compareByMaturityDesc`, `compareByBehaviourPriority`
- Change: `compareBySkillChange`, `compareByBehaviourChange`
- Generic: `compareByOrder`, `chainComparators`

### Composed Policies

Pre-built filter+sort pipelines:

- `filterAgentSkills()` / `filterToolkitSkills()` — agent-specific filtering
- `focusAgentSkills()` — narrow to focus areas
- `sortAgentSkills()` / `sortAgentBehaviours()` / `sortJobSkills()`
- `prepareAgentSkillMatrix()` / `prepareAgentBehaviourProfile()` — combined
  filter and sort

---

## Composition with Other Packages

### With Map (upstream data)

Map provides the YAML schema data that libskill consumes. Derivation functions
accept raw entities loaded from `data/pathway/`:

```javascript
import { deriveJob } from "@forwardimpact/libskill/derivation";

const job = deriveJob({ discipline, level, track, capabilities, behaviours, skills, drivers });
```

### With Pathway (downstream presentation)

Pathway formatters consume libskill's derived output for display. Never
transform data in views — always derive through libskill first:

```javascript
import { deriveSkillMatrix } from "@forwardimpact/libskill/derivation";
import { prepareAgentProfile } from "@forwardimpact/libskill/profile";

const matrix = deriveSkillMatrix({ discipline, level, capabilities, skills });
const agentProfile = prepareAgentProfile({ skillMatrix: matrix });
```

### With Outpost (agent generation)

Outpost uses libskill to generate agent profiles and skill files:

```javascript
import { deriveAgentSkills, generateAgentProfile } from "@forwardimpact/libskill/agent";

const skills = deriveAgentSkills({ discipline, track, stage, capabilities });
const profile = generateAgentProfile({ discipline, track, stage });
```

---

## Programmatic Access

```javascript
// Core derivation
import {
  deriveSkillMatrix, deriveBehaviourProfile,
  deriveJob, generateAllJobs,
  deriveResponsibilities, calculateDriverCoverage,
} from "@forwardimpact/libskill/derivation";

// Modifiers
import { resolveSkillModifier, expandModifiersToSkills } from "@forwardimpact/libskill/modifiers";

// Job preparation
import { prepareJobDetail, prepareJobSummary } from "@forwardimpact/libskill/job";
import { createJobCache } from "@forwardimpact/libskill/job-cache";

// Agent profiles
import { deriveAgentSkills, generateAgentProfile } from "@forwardimpact/libskill/agent";
import { prepareAgentProfile } from "@forwardimpact/libskill/profile";

// Interview questions
import { deriveInterviewQuestions } from "@forwardimpact/libskill/interview";
import { deriveMissionFitInterview } from "@forwardimpact/libskill/interview-specialized";

// Career progression
import { analyzeProgression, analyzeLevelProgression } from "@forwardimpact/libskill/progression";

// Job matching
import { calculateJobMatch, findMatchingJobs } from "@forwardimpact/libskill/matching";
import { analyzeCandidate, deriveDevelopmentPath } from "@forwardimpact/libskill/matching";

// Policies
import { isAgentEligible, filterAgentSkills, compareByLevelDesc } from "@forwardimpact/libskill/policies";

// Checklists
import { formatChecklistMarkdown } from "@forwardimpact/libskill/checklist";

// Toolkit
import { deriveToolkit } from "@forwardimpact/libskill/toolkit";
```

---

## Related Documentation

- [Pathway Internals](/docs/internals/pathway/) — presentation layer that
  consumes derived data
- [Model Reference](/docs/reference/model/) — entity overview and derivation
  formula

---
title: libskill Internals
description: "Derivation engine — key functions, module index, imports, and technical details of skill, behaviour, and responsibility derivation."
---

## Module Index

| Module                               | Purpose                                                 |
| ------------------------------------ | ------------------------------------------------------- |
| `src/derivation.js`                  | Core derivation functions (skills, behaviours, drivers) |
| `src/derivation-responsibilities.js` | Responsibility derivation from capabilities             |
| `src/derivation-validation.js`       | Derivation input validation                             |
| `src/agent.js`                       | Agent profile generation                                |
| `src/agent-validation.js`            | Agent derivation input validation                       |
| `src/job.js`                         | Job preparation for display                             |
| `src/job-cache.js`                   | Job caching for performance                             |
| `src/interview.js`                   | Interview question selection                            |
| `src/interview-helpers.js`           | Interview question utilities                            |
| `src/interview-selection.js`         | Interview question filtering and selection              |
| `src/interview-specialized.js`       | Specialized interview question generation               |
| `src/progression.js`                 | Career path analysis and gap identification             |
| `src/checklist.js`                   | Skill checklist formatting as markdown                  |
| `src/toolkit.js`                     | Tool derivation from skill references                   |
| `src/profile.js`                     | Profile filtering (human + agent)                       |
| `src/modifiers.js`                   | Capability and skill modifier resolution                |
| `src/matching.js`                    | Job matching and gap analysis                           |
| `src/matching-development.js`        | Development plan generation from gap analysis           |
| `src/policies/`                      | Ordering, sorting, filtering, and threshold policies    |

libskill is pure-function by design and intentionally exempt from OO+DI. All
functions are stateless and side-effect-free.

---

## Skill Derivation Technical Details

Every skill goes through a four-step derivation pipeline.

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

### Step 4: Clamp to Valid Range

Two constraints are applied:

1. **Positive modifier cap** -- Positive modifiers cannot push the result above
   the level's maximum base proficiency.
2. **Range clamp** -- The final result must fall between `awareness` (0) and
   `expert` (4).

The full matrix is assembled by `deriveSkillMatrix()`, which runs the pipeline
for every skill in the discipline. Behaviours are derived by
`deriveBehaviourProfile()` using a simpler formula:
`Level Base + Discipline Modifier + Track Modifier`, clamped to valid range.

---

## Key Functions

| Function                      | Module        | Purpose                                        |
| ----------------------------- | ------------- | ---------------------------------------------- |
| `buildSkillTypeMap()`         | derivation.js | Build O(1) skill type lookup for a discipline  |
| `getSkillTypeForDiscipline()` | derivation.js | Determine skill tier (core/supporting/broad)   |
| `deriveSkillProficiency()`    | derivation.js | Full skill derivation pipeline for one skill   |
| `deriveSkillMatrix()`         | derivation.js | Derive all skills for a job                    |
| `deriveBehaviourProfile()`    | derivation.js | Derive all behaviours for a job                |
| `deriveResponsibilities()`    | derivation.js | Derive role responsibilities from capabilities |
| `calculateDriverCoverage()`   | derivation.js | Check driver coverage against thresholds       |
| `resolveSkillModifier()`      | modifiers.js  | Resolve track modifier for a skill             |

---

## Checklist Formatting

`formatChecklistMarkdown()` in `checklist.js` renders skill checklists as
markdown. Input is an array of `{ skill, capability, items }` entries; output is
a markdown string with capability emoji headers and checkbox lists.

---

## Programmatic Access

```javascript
// Core derivation
import {
  deriveSkillMatrix,
  deriveBehaviourProfile,
  deriveResponsibilities,
  calculateDriverCoverage,
} from "@forwardimpact/libskill/derivation";

// Profile preparation (human + agent)
import { prepareAgentProfile } from "@forwardimpact/libskill/profile";

// Agent derivation
import { deriveReferenceLevel, deriveAgentSkills } from "@forwardimpact/libskill/agent";

// Checklist formatting
import { formatChecklistMarkdown } from "@forwardimpact/libskill/checklist";

// Career progression
import { analyzeProgression } from "@forwardimpact/libskill/progression";

// Job matching
import { calculateJobMatch, findMatchingJobs } from "@forwardimpact/libskill/matching";
```

---

## Related Documentation

- [Pathway Internals](/docs/internals/pathway/) -- Presentation layer that
  consumes derived data
- [Model Reference](/docs/reference/model/) -- Entity overview and derivation
  formula

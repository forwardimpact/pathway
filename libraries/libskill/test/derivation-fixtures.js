/**
 * Thin wrappers around @forwardimpact/libharness pathway atoms that preserve
 * libskill-specific defaults (e.g. the `specialization` field on disciplines,
 * the populated `expectations` shape on levels, and the capability/skill ids
 * that libskill derivation tests reason about).
 *
 * New tests should prefer calling the libharness atoms directly; these
 * `make*` names exist for backward compat with the existing libskill suite.
 */
import {
  createTestDiscipline,
  createTestLevel,
  createTestTrack,
  createTestSkill,
  createTestBehaviour,
  createTestCapability,
  createTestDriver,
} from "@forwardimpact/libharness";

const DEFAULT_LEVEL_EXPECTATIONS = {
  impactScope: "team",
  autonomyExpectation: "independently",
  influenceScope: "team",
  complexityHandled: "moderate",
};

export function makeDiscipline(overrides = {}) {
  return createTestDiscipline({
    specialization: "Software Engineering",
    supportingSkills: ["ci_cd", "monitoring"],
    broadSkills: ["documentation"],
    ...overrides,
  });
}

export function makeManagementDiscipline(overrides = {}) {
  return makeDiscipline({
    id: "engineering_management",
    roleTitle: "Engineering",
    specialization: "Engineering Management",
    isManagement: true,
    isProfessional: false,
    coreSkills: ["people_management", "delivery_mgmt"],
    supportingSkills: ["process_design"],
    broadSkills: ["coding"],
    behaviourModifiers: { collaboration: 1 },
    validTracks: [null, "platform"],
    ...overrides,
  });
}

export function makeLevel(overrides = {}) {
  return createTestLevel({
    id: "level_3",
    expectations: { ...DEFAULT_LEVEL_EXPECTATIONS },
    ...overrides,
  });
}

export function makeSeniorLevel(overrides = {}) {
  return makeLevel({
    id: "level_5",
    professionalTitle: "Staff",
    managementTitle: "Director",
    ordinalRank: 5,
    baseSkillProficiencies: {
      primary: "practitioner",
      secondary: "working",
      broad: "foundational",
    },
    baseBehaviourMaturity: "practicing",
    ...overrides,
  });
}

export function makeJuniorLevel(overrides = {}) {
  return makeLevel({
    id: "level_1",
    professionalTitle: "Level I",
    managementTitle: "Associate",
    ordinalRank: 1,
    baseSkillProficiencies: {
      primary: "foundational",
      secondary: "awareness",
      broad: "awareness",
    },
    baseBehaviourMaturity: "emerging",
    ...overrides,
  });
}

export function makeTrack(overrides = {}) {
  return createTestTrack({
    description: "Platform engineering track",
    skillModifiers: { scale: 1 },
    behaviourModifiers: { collaboration: 1 },
    ...overrides,
  });
}

export function makeSkills() {
  return [
    createTestSkill({
      id: "coding",
      name: "Coding",
      capability: "delivery",
      proficiencyDescriptions: {
        awareness: "Understands basic coding",
        foundational: "Writes simple code",
        working: "Writes production code",
        practitioner: "Designs systems",
        expert: "Defines coding standards",
      },
    }),
    createTestSkill({ id: "testing", name: "Testing", capability: "delivery" }),
    createTestSkill({ id: "ci_cd", name: "CI/CD", capability: "delivery" }),
    createTestSkill({
      id: "monitoring",
      name: "Monitoring",
      capability: "reliability",
    }),
    createTestSkill({
      id: "documentation",
      name: "Documentation",
      capability: "documentation",
      proficiencyDescriptions: {
        awareness: "Reads docs",
        foundational: "Writes basic docs",
        working: "Maintains documentation",
      },
    }),
    createTestSkill({
      id: "capacity_planning",
      name: "Capacity Planning",
      capability: "scale",
    }),
    createTestSkill({
      id: "load_balancing",
      name: "Load Balancing",
      capability: "scale",
    }),
    createTestSkill({
      id: "people_management",
      name: "People Management",
      capability: "people",
      isHumanOnly: true,
      proficiencyDescriptions: {},
    }),
    createTestSkill({
      id: "delivery_mgmt",
      name: "Delivery Management",
      capability: "process",
      proficiencyDescriptions: {},
    }),
    createTestSkill({
      id: "process_design",
      name: "Process Design",
      capability: "process",
      proficiencyDescriptions: {},
    }),
  ];
}

export function makeBehaviours() {
  return [
    createTestBehaviour({
      id: "collaboration",
      name: "Collaboration",
      maturityDescriptions: {
        emerging: "Works with others",
        developing: "Contributes to team",
        practicing: "Facilitates collaboration",
        role_modeling: "Models collaboration",
        exemplifying: "Shapes collaborative culture",
      },
    }),
    createTestBehaviour({
      id: "ownership",
      name: "Ownership",
      maturityDescriptions: {
        emerging: "Takes responsibility",
        developing: "Owns deliverables",
        practicing: "Owns outcomes",
        role_modeling: "Models ownership",
        exemplifying: "Shapes ownership culture",
      },
    }),
  ];
}

export function makeCapabilities() {
  return [
    createTestCapability({
      id: "delivery",
      name: "Delivery",
      ordinalRank: 1,
      professionalResponsibilities: {
        foundational: "Delivers assigned tasks",
        working: "Delivers features independently",
        practitioner: "Leads delivery across teams",
        expert: "Defines delivery strategy",
      },
      managementResponsibilities: {
        foundational: "Supports delivery",
        working: "Manages delivery",
        practitioner: "Leads delivery org-wide",
        expert: "Defines delivery culture",
      },
    }),
    createTestCapability({
      id: "scale",
      name: "Scale",
      emojiIcon: "\u{1F4C8}",
      ordinalRank: 2,
      professionalResponsibilities: {
        foundational: "Understands scale concerns",
        working: "Designs for scale",
        practitioner: "Leads scale initiatives",
        expert: "Defines scale strategy",
      },
      managementResponsibilities: {},
    }),
    createTestCapability({
      id: "reliability",
      name: "Reliability",
      emojiIcon: "\u{1F6E1}️",
      ordinalRank: 3,
      professionalResponsibilities: {
        foundational: "Follows reliability practices",
        working: "Implements reliability",
        practitioner: "Leads reliability",
        expert: "Defines reliability strategy",
      },
      managementResponsibilities: {},
    }),
    createTestCapability({
      id: "documentation",
      name: "Documentation",
      emojiIcon: "\u{1F4DD}",
      ordinalRank: 4,
      professionalResponsibilities: {
        foundational: "Writes basic docs",
        working: "Maintains documentation",
        practitioner: "Leads documentation practice",
        expert: "Defines documentation strategy",
      },
      managementResponsibilities: {},
    }),
  ];
}

export function makeDrivers() {
  return [
    createTestDriver({
      id: "velocity",
      contributingSkills: ["coding", "testing", "ci_cd"],
      contributingBehaviours: ["ownership"],
    }),
    createTestDriver({
      id: "stability",
      name: "Stability",
      contributingSkills: ["monitoring", "capacity_planning"],
      contributingBehaviours: ["collaboration", "ownership"],
    }),
  ];
}

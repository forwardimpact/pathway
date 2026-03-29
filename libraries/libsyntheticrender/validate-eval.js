/**
 * Eval Scenario Reference Validator.
 *
 * Validates that entity names and IRIs referenced in eval scenarios
 * exist in the generated data. Reports missing references.
 *
 * @module libuniverse/validate-eval
 */

/**
 * Validate eval scenario references against generated data.
 * @param {object[]} evalScenarios - Parsed eval scenario definitions
 * @param {object} generatedData - Full entity graph
 * @returns {{ passed: boolean, errors: string[] }}
 */
export function validateEvalReferences(evalScenarios, generatedData) {
  const errors = [];

  // Build lookup sets from generated data
  const allIris = new Set();
  const allNames = new Set();

  const entitySources = [
    generatedData.orgs,
    generatedData.departments,
    generatedData.teams,
    generatedData.people,
    generatedData.projects,
  ];

  for (const source of entitySources) {
    if (!Array.isArray(source)) continue;
    for (const entity of source) {
      if (entity.iri) allIris.add(entity.iri);
      if (entity.name) allNames.add(entity.name);
      if (entity.id) allNames.add(entity.id);
    }
  }

  // Check each eval scenario
  for (const scenario of evalScenarios) {
    if (!scenario.evaluations) continue;
    for (const evaluation of scenario.evaluations) {
      const data = evaluation.data;
      if (!data) continue;

      // Check for IRI references
      const iriMatches = data.match(/https?:\/\/[^\s"']+\/id\/[^\s"',)]+/g);
      if (iriMatches) {
        for (const iri of iriMatches) {
          if (!allIris.has(iri)) {
            errors.push(
              `Scenario "${scenario.name}": IRI "${iri}" not found in generated data`,
            );
          }
        }
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

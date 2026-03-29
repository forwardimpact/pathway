import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validateEvalReferences } from "../validate-eval.js";

describe("validateEvalReferences", () => {
  const generatedData = {
    orgs: [
      {
        iri: "https://test.example/id/org/testorg",
        name: "TestOrg",
        id: "testorg",
      },
    ],
    departments: [
      {
        iri: "https://test.example/id/department/eng",
        name: "Engineering",
        id: "eng",
      },
    ],
    teams: [
      {
        iri: "https://test.example/id/team/alpha",
        name: "Alpha Team",
        id: "alpha",
      },
    ],
    people: [
      {
        iri: "https://test.example/id/person/alice",
        name: "Alice",
        id: "alice",
      },
    ],
    projects: [
      {
        iri: "https://test.example/id/project/proj1",
        name: "Project One",
        id: "proj1",
      },
    ],
  };

  test("passes when all IRI references exist", () => {
    const scenarios = [
      {
        name: "valid_scenario",
        evaluations: [
          { data: "https://test.example/id/org/testorg" },
          { data: "https://test.example/id/project/proj1" },
        ],
      },
    ];
    const result = validateEvalReferences(scenarios, generatedData);
    assert.ok(result.passed);
    assert.strictEqual(result.errors.length, 0);
  });

  test("reports missing IRI references", () => {
    const scenarios = [
      {
        name: "broken_scenario",
        evaluations: [{ data: "https://test.example/id/project/nonexistent" }],
      },
    ];
    const result = validateEvalReferences(scenarios, generatedData);
    assert.ok(!result.passed);
    assert.strictEqual(result.errors.length, 1);
    assert.ok(result.errors[0].includes("nonexistent"));
  });

  test("handles scenarios without evaluations", () => {
    const scenarios = [{ name: "no_evals" }];
    const result = validateEvalReferences(scenarios, generatedData);
    assert.ok(result.passed);
    assert.strictEqual(result.errors.length, 0);
  });

  test("handles evaluations without data", () => {
    const scenarios = [
      {
        name: "no_data",
        evaluations: [{ label: "something" }],
      },
    ];
    const result = validateEvalReferences(scenarios, generatedData);
    assert.ok(result.passed);
  });

  test("handles empty scenarios array", () => {
    const result = validateEvalReferences([], generatedData);
    assert.ok(result.passed);
    assert.strictEqual(result.errors.length, 0);
  });
});

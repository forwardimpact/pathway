import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createDslParser,
  createEntityGenerator,
} from "@forwardimpact/libsyntheticgen";
import { validateCrossContent } from "@forwardimpact/libsyntheticrender";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, "fixtures", "minimal.dsl");

function makeLogger() {
  return {
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: () => {},
  };
}

describe("Pipeline integration", () => {
  test("parses minimal DSL fixture", () => {
    const source = readFileSync(FIXTURE_PATH, "utf-8");
    const parser = createDslParser();
    const ast = parser.parse(source);

    assert.strictEqual(ast.domain, "test.example");
    assert.strictEqual(ast.industry, "technology");
    assert.ok(ast.people);
    assert.ok(ast.teams.length > 0);
    assert.ok(ast.projects.length > 0);
  });

  test("generates entities from minimal DSL", () => {
    const source = readFileSync(FIXTURE_PATH, "utf-8");
    const parser = createDslParser();
    const ast = parser.parse(source);
    const generator = createEntityGenerator(makeLogger());
    const entities = generator.generate(ast);

    assert.ok(entities.orgs.length > 0);
    assert.ok(entities.departments.length > 0);
    assert.ok(entities.teams.length > 0);
    assert.ok(entities.people.length > 0);
    assert.ok(entities.projects.length > 0);
    assert.ok(entities.domain);
  });

  test("entity IRIs use consistent /id/ namespace", () => {
    const source = readFileSync(FIXTURE_PATH, "utf-8");
    const parser = createDslParser();
    const ast = parser.parse(source);
    const generator = createEntityGenerator(makeLogger());
    const entities = generator.generate(ast);

    for (const org of entities.orgs) {
      assert.ok(org.iri.includes("/id/org/"), `Bad org IRI: ${org.iri}`);
    }
    for (const dept of entities.departments) {
      assert.ok(
        dept.iri.includes("/id/department/"),
        `Bad dept IRI: ${dept.iri}`,
      );
    }
    for (const team of entities.teams) {
      assert.ok(team.iri.includes("/id/team/"), `Bad team IRI: ${team.iri}`);
    }
    for (const person of entities.people) {
      assert.ok(
        person.iri.includes("/id/person/"),
        `Bad person IRI: ${person.iri}`,
      );
    }
    for (const proj of entities.projects) {
      assert.ok(
        proj.iri.includes("/id/project/"),
        `Bad project IRI: ${proj.iri}`,
      );
    }
  });

  test("cross-content validation passes on generated entities", () => {
    const source = readFileSync(FIXTURE_PATH, "utf-8");
    const parser = createDslParser();
    const ast = parser.parse(source);
    const generator = createEntityGenerator(makeLogger());
    const entities = generator.generate(ast);
    const result = validateCrossContent(entities);

    // Minimal fixture has no snapshots block, so snapshot checks are expected to fail
    const snapshotChecks = new Set([
      "getdx_snapshots_list_response",
      "getdx_snapshots_info_responses",
    ]);
    const failures = result.checks.filter(
      (c) => !c.passed && !snapshotChecks.has(c.name),
    );
    if (failures.length > 0) {
      const names = failures.map((f) => f.name).join(", ");
      assert.fail(`Validation failures: ${names}`);
    }
  });
});

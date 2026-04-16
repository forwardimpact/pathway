import { describe, test } from "node:test";
import assert from "node:assert";
import { renderRawDocuments } from "@forwardimpact/libsyntheticrender/render/raw";

/**
 * Regression: renderPeopleYAML used to write individual person profiles under
 * the `people/` storage prefix. This collided with roster uploads that
 * `transformPeople` reads from the same prefix, causing `activity seed` to
 * pick a profile instead of the roster and import zero people.
 *
 * Fix: person profiles now use the `profiles/` prefix; `people/` is reserved
 * for roster uploads consumed by the transform pipeline.
 */

const MINIMAL_ENTITIES = {
  people: [
    {
      id: "person_1",
      name: "A",
      email: "a@x",
      github: "a",
      iri: "urn:a",
      discipline: "se",
      level: "J040",
      team_id: "team_1",
      department: "dept_1",
      hire_date: "2025-01-01",
      is_manager: false,
    },
  ],
  teams: [{ id: "team_1", name: "Alpha", department: "dept_1" }],
  departments: [{ id: "dept_1", name: "Eng" }],
  activity: {},
};

describe("raw renderer people prefix", () => {
  test("person profiles use profiles/ prefix, not people/", () => {
    const files = renderRawDocuments(MINIMAL_ENTITIES);
    const peoplePaths = [...files.keys()].filter((k) =>
      k.startsWith("people/"),
    );
    const profilePaths = [...files.keys()].filter((k) =>
      k.startsWith("profiles/"),
    );

    assert.strictEqual(
      peoplePaths.length,
      0,
      `expected no files under people/ but found: ${peoplePaths.join(", ")}`,
    );
    assert.ok(
      profilePaths.length > 0,
      "expected at least one file under profiles/",
    );
    assert.ok(
      profilePaths.some((p) => p === "profiles/person_1.yaml"),
      "expected profiles/person_1.yaml",
    );
    assert.ok(
      profilePaths.some((p) => p === "profiles/index.json"),
      "expected profiles/index.json",
    );
  });
});

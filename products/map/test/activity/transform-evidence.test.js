import { test, describe } from "node:test";
import assert from "node:assert";
import { transformEvidence } from "@forwardimpact/map/activity/transform/evidence";

function createFakeClient({
  evidenceJson = null,
  artifacts = [],
  throwOnDownload = false,
  insertError = null,
} = {}) {
  const deleteCalls = [];
  const insertCalls = [];

  return {
    deleteCalls,
    insertCalls,
    from(table) {
      if (table === "evidence") {
        return {
          delete() {
            return {
              async eq(col, val) {
                deleteCalls.push({ table, col, val });
                return { error: null };
              },
            };
          },
          async insert(rows) {
            insertCalls.push({ table, rows });
            return { error: insertError };
          },
        };
      }
      if (table === "github_artifacts") {
        return {
          select() {
            return {
              not() {
                return {
                  data: artifacts,
                  error: null,
                };
              },
            };
          },
        };
      }
      return {};
    },
    storage: {
      from() {
        return {
          async download() {
            if (throwOnDownload) {
              return { data: null, error: { message: "not found" } };
            }
            return {
              data: {
                text: async () => JSON.stringify(evidenceJson),
              },
              error: null,
            };
          },
        };
      },
    },
  };
}

describe("activity/transform/evidence", () => {
  test("happy path: inserts evidence with round-robin artifact distribution", async () => {
    const fake = createFakeClient({
      evidenceJson: {
        evidence: [
          {
            person_email: "ada@example.com",
            skill_id: "testing",
            proficiency: "working",
            observed_at: "2026-01-01T00:00:00Z",
          },
          {
            person_email: "ada@example.com",
            skill_id: "code-review",
            proficiency: "practitioner",
            observed_at: "2026-01-02T00:00:00Z",
          },
          {
            person_email: "bob@example.com",
            skill_id: "testing",
            proficiency: "foundational",
            observed_at: "2026-01-03T00:00:00Z",
          },
          {
            person_email: "unknown@example.com",
            skill_id: "testing",
            proficiency: "awareness",
            observed_at: "2026-01-04T00:00:00Z",
          },
        ],
      },
      artifacts: [
        {
          artifact_id: "a1",
          email: "ada@example.com",
          artifact_type: "pull_request",
          metadata: { title: "Fix auth" },
        },
        {
          artifact_id: "a2",
          email: "ada@example.com",
          artifact_type: "commit",
          metadata: { message: "feat: add tests" },
        },
        {
          artifact_id: "b1",
          email: "bob@example.com",
          artifact_type: "review",
          metadata: {},
        },
      ],
    });

    const result = await transformEvidence(fake);

    assert.strictEqual(result.inserted, 3);
    assert.strictEqual(result.skipped, 1);
    assert.strictEqual(result.errors.length, 0);

    assert.strictEqual(fake.deleteCalls.length, 1);
    assert.strictEqual(fake.deleteCalls[0].val, "synthetic");

    const rows = fake.insertCalls[0].rows;
    assert.strictEqual(rows.length, 3);

    assert.strictEqual(rows[0].artifact_id, "a1");
    assert.strictEqual(rows[0].marker_text, "Fix auth");
    assert.strictEqual(rows[0].level_id, "working");

    assert.strictEqual(rows[1].artifact_id, "a2");
    assert.strictEqual(rows[1].marker_text, "feat: add tests");

    assert.strictEqual(rows[2].artifact_id, "b1");
    assert.strictEqual(rows[2].marker_text, "testing evidence");

    for (const row of rows) {
      assert.strictEqual(row.matched, true);
      assert.strictEqual(row.rationale, "synthetic");
    }
  });

  test("idempotency: delete runs before insert on each call", async () => {
    const fake = createFakeClient({
      evidenceJson: {
        evidence: [
          {
            person_email: "ada@example.com",
            skill_id: "testing",
            proficiency: "working",
            observed_at: "2026-01-01T00:00:00Z",
          },
        ],
      },
      artifacts: [
        {
          artifact_id: "a1",
          email: "ada@example.com",
          artifact_type: "pull_request",
          metadata: { title: "PR" },
        },
      ],
    });

    await transformEvidence(fake);
    await transformEvidence(fake);

    assert.strictEqual(fake.deleteCalls.length, 2);
    assert.strictEqual(fake.insertCalls.length, 2);

    const firstRows = fake.insertCalls[0].rows;
    const secondRows = fake.insertCalls[1].rows;
    assert.deepStrictEqual(secondRows, firstRows);
  });

  test("missing evidence file returns zeros gracefully", async () => {
    const fake = createFakeClient({ throwOnDownload: true });

    const result = await transformEvidence(fake);

    assert.strictEqual(result.inserted, 0);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(fake.deleteCalls.length, 0);
    assert.strictEqual(fake.insertCalls.length, 0);
  });

  test("marker_text fallback chain: title > message > skill_id evidence", async () => {
    const fake = createFakeClient({
      evidenceJson: {
        evidence: [
          {
            person_email: "a@x.com",
            skill_id: "s1",
            proficiency: "working",
            observed_at: "2026-01-01T00:00:00Z",
          },
          {
            person_email: "b@x.com",
            skill_id: "s2",
            proficiency: "working",
            observed_at: "2026-01-01T00:00:00Z",
          },
          {
            person_email: "c@x.com",
            skill_id: "s3",
            proficiency: "working",
            observed_at: "2026-01-01T00:00:00Z",
          },
        ],
      },
      artifacts: [
        {
          artifact_id: "a1",
          email: "a@x.com",
          artifact_type: "pull_request",
          metadata: { title: "Has title", message: "Has message" },
        },
        {
          artifact_id: "b1",
          email: "b@x.com",
          artifact_type: "commit",
          metadata: { message: "Only message" },
        },
        {
          artifact_id: "c1",
          email: "c@x.com",
          artifact_type: "review",
          metadata: {},
        },
      ],
    });

    await transformEvidence(fake);
    const rows = fake.insertCalls[0].rows;

    assert.strictEqual(rows[0].marker_text, "Has title");
    assert.strictEqual(rows[1].marker_text, "Only message");
    assert.strictEqual(rows[2].marker_text, "s3 evidence");
  });

  test("insert error returns zero inserted and reports the error", async () => {
    const fake = createFakeClient({
      evidenceJson: {
        evidence: [
          {
            person_email: "ada@example.com",
            skill_id: "testing",
            proficiency: "working",
            observed_at: "2026-01-01T00:00:00Z",
          },
        ],
      },
      artifacts: [
        {
          artifact_id: "a1",
          email: "ada@example.com",
          artifact_type: "pull_request",
          metadata: { title: "PR" },
        },
      ],
      insertError: { message: "permission denied" },
    });

    const result = await transformEvidence(fake);

    assert.strictEqual(result.inserted, 0);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.errors.length, 1);
    assert.strictEqual(result.errors[0], "permission denied");
  });

  test("empty evidence array: deletes and returns zeros", async () => {
    const fake = createFakeClient({
      evidenceJson: { evidence: [] },
      artifacts: [
        {
          artifact_id: "a1",
          email: "ada@example.com",
          artifact_type: "pull_request",
          metadata: { title: "PR" },
        },
      ],
    });

    const result = await transformEvidence(fake);

    assert.strictEqual(result.inserted, 0);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(fake.deleteCalls.length, 1);
    assert.strictEqual(fake.insertCalls.length, 0);
  });
});

import { describe, test } from "node:test";
import assert from "node:assert";
import { SyntheaTool } from "../src/tools/synthea.js";
import {
  assertRejectsMessage,
  assertThrowsMessage,
} from "@forwardimpact/libharness";

const logger = { info() {}, error() {} };

describe("SyntheaTool", () => {
  test("requires all dependencies", () => {
    assertThrowsMessage(() => new SyntheaTool({}), /requires logger/);
    assertThrowsMessage(
      () => new SyntheaTool({ logger }),
      /requires syntheaJar/,
    );
    assertThrowsMessage(
      () => new SyntheaTool({ logger, syntheaJar: "/path.jar" }),
      /requires execFileFn/,
    );
    assertThrowsMessage(
      () =>
        new SyntheaTool({
          logger,
          syntheaJar: "/path.jar",
          execFileFn: async () => {},
        }),
      /requires fsFns/,
    );
  });

  test("checkAvailability throws when java missing", async () => {
    const tool = new SyntheaTool({
      logger,
      syntheaJar: "/missing.jar",
      execFileFn: async () => {
        throw new Error("not found");
      },
      fsFns: { readFile: async () => Buffer.from("") },
    });
    await assertRejectsMessage(
      () => tool.checkAvailability(),
      /Synthea requires Java/,
    );
  });

  test("checkAvailability error message references 'just synthea-install'", async () => {
    const tool = new SyntheaTool({
      logger,
      syntheaJar: "/missing.jar",
      execFileFn: async () => {
        throw new Error("not found");
      },
      fsFns: { readFile: async () => Buffer.from("") },
    });
    await assertRejectsMessage(
      () => tool.checkAvailability(),
      /just synthea-install/,
    );
  });

  test("passes correct args to java", async () => {
    let capturedArgs;
    const fhirBundle = {
      entry: [
        { resource: { resourceType: "Patient", id: "p1", name: "Alice" } },
        { resource: { resourceType: "Condition", id: "c1", code: "diabetes" } },
      ],
    };

    const tool = new SyntheaTool({
      logger,
      syntheaJar: "/synthea.jar",
      execFileFn: async (cmd, args) => {
        capturedArgs = { cmd, args };
        return { stdout: "" };
      },
      fsFns: {
        readFile: async (path, _enc) => {
          if (path === "/synthea.jar") return Buffer.from("");
          return JSON.stringify(fhirBundle);
        },
        readdir: async () => ["patient1.json"],
        mkdtemp: async () => "/tmp/synthea-abc",
        rm: async () => {},
      },
    });

    const datasets = await tool.generate({
      name: "test",
      population: 50,
      modules: ["diabetes"],
      seed: 42,
    });

    assert.strictEqual(capturedArgs.cmd, "java");
    assert.ok(capturedArgs.args.includes("-jar"));
    assert.ok(capturedArgs.args.includes("/synthea.jar"));
    assert.ok(capturedArgs.args.includes("-p"));
    assert.ok(capturedArgs.args.includes("50"));
    assert.ok(capturedArgs.args.includes("-s"));
    assert.ok(capturedArgs.args.includes("42"));
    assert.ok(capturedArgs.args.includes("-m"));
    assert.ok(capturedArgs.args.includes("diabetes"));

    // Verify dataset flattening by resource type
    assert.strictEqual(datasets.length, 2);
    const names = datasets.map((d) => d.name).sort();
    assert.deepStrictEqual(names, ["test_condition", "test_patient"]);

    const patientDs = datasets.find((d) => d.name === "test_patient");
    assert.strictEqual(patientDs.records.length, 1);
    assert.strictEqual(patientDs.metadata.tool, "synthea");
    assert.strictEqual(patientDs.metadata.resourceType, "Patient");
  });

  test("filterByConditions keeps only patients with matching FHIR Condition codes", async () => {
    // 5 patients, 3 with diabetes — output should contain those 3 only.
    const bundles = makeFhirBundles([
      { patient: "p1", conditions: [{ display: "Diabetes" }] },
      { patient: "p2", conditions: [{ display: "Hypertension" }] },
      { patient: "p3", conditions: [{ display: "Diabetes" }] },
      { patient: "p4", conditions: [{ display: "Diabetes" }] },
      { patient: "p5", conditions: [{ display: "Migraine" }] },
    ]);

    const tool = makeToolWithBundles(bundles, "/synthea.jar");
    const datasets = await tool.generate({
      name: "trial_patients",
      population: 5,
      conditions: ["diabetes"],
      seed: 1,
    });

    const patientDs = datasets.find((d) => d.name === "trial_patients_patient");
    assert.strictEqual(patientDs.records.length, 3);
    const ids = patientDs.records.map((r) => r.id).sort();
    assert.deepStrictEqual(ids, ["p1", "p3", "p4"]);
  });

  test("filterByConditions matches by FHIR code over display text", async () => {
    const bundles = makeFhirBundles([
      { patient: "p1", conditions: [{ code: "E11", display: "Type 2" }] },
      { patient: "p2", conditions: [{ code: "I10", display: "Hypertension" }] },
    ]);
    const tool = makeToolWithBundles(bundles, "/synthea.jar");
    const datasets = await tool.generate({
      name: "trial_patients",
      population: 2,
      conditions: ["E11"],
      seed: 1,
    });
    const patientDs = datasets.find((d) => d.name === "trial_patients_patient");
    assert.strictEqual(patientDs.records.length, 1);
    assert.strictEqual(patientDs.records[0].id, "p1");
  });

  test("no conditions field — no filtering applied", async () => {
    const bundles = makeFhirBundles([
      { patient: "p1", conditions: [{ display: "Diabetes" }] },
      { patient: "p2", conditions: [{ display: "Hypertension" }] },
    ]);
    const tool = makeToolWithBundles(bundles, "/synthea.jar");
    const datasets = await tool.generate({
      name: "patients",
      population: 2,
      seed: 1,
    });
    const patientDs = datasets.find((d) => d.name === "patients_patient");
    assert.strictEqual(patientDs.records.length, 2);
  });

  test("filterByConditions handles empty Condition list — no patient drop", async () => {
    const bundles = [
      {
        entry: [
          { resource: { resourceType: "Patient", id: "p1" } },
          { resource: { resourceType: "Patient", id: "p2" } },
        ],
      },
    ];
    const tool = makeToolWithBundles(bundles, "/synthea.jar");
    const datasets = await tool.generate({
      name: "patients",
      population: 2,
      conditions: ["diabetes"],
      seed: 1,
    });
    // No Condition resources → no patient gets a match, but the no-match
    // branch leaves data untouched rather than wiping it.
    const patientDs = datasets.find((d) => d.name === "patients_patient");
    assert.strictEqual(patientDs.records.length, 2);
  });

  test("empty FHIR output — generate returns no datasets without error", async () => {
    const tool = makeToolWithBundles([], "/synthea.jar");
    const datasets = await tool.generate({
      name: "patients",
      population: 0,
      seed: 1,
    });
    assert.strictEqual(datasets.length, 0);
  });
});

/**
 * Build FHIR bundles where each patient has a set of Condition resources
 * referencing them. `conditions[].code` and `.display` are optional fields
 * on the FHIR `code.coding` element.
 */
function makeFhirBundles(patientSpecs) {
  const bundles = [];
  for (const spec of patientSpecs) {
    const entry = [{ resource: { resourceType: "Patient", id: spec.patient } }];
    for (const c of spec.conditions) {
      entry.push({
        resource: {
          resourceType: "Condition",
          code: {
            coding: [{ code: c.code, display: c.display }],
          },
          subject: { reference: `urn:uuid:${spec.patient}` },
        },
      });
    }
    bundles.push({ entry });
  }
  return bundles;
}

function makeToolWithBundles(bundles, syntheaJar) {
  return new SyntheaTool({
    logger,
    syntheaJar,
    execFileFn: async () => ({ stdout: "" }),
    fsFns: {
      readFile: async (path) => {
        if (path === syntheaJar) return Buffer.from("");
        const idx = parseInt(path.split("/").pop().replace(/\D/g, ""), 10) - 1;
        return JSON.stringify(bundles[idx] || { entry: [] });
      },
      readdir: async () => bundles.map((_, i) => `bundle${i + 1}.json`),
      mkdtemp: async () => "/tmp/synthea-test",
      rm: async () => {},
    },
  });
}

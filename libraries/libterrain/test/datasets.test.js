import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildNodes } from "../src/nodes.js";

function makeLogger() {
  return { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} };
}

/**
 * Build a fake tool that records the config it was invoked with and produces
 * an empty result set. Lets tests assert on the `modules` that nodes.js
 * resolved before calling the tool.
 */
function makeRecordingFactory() {
  const calls = [];
  function factory() {
    return {
      checkAvailability: async () => true,
      generate: async (config) => {
        calls.push(config);
        return [];
      },
    };
  }
  return { factory, calls };
}

function runDatasetsNode(parse, { clinical, factory }) {
  const nodes = buildNodes({
    dslParser: null,
    entityGenerator: null,
    proseGenerator: null,
    pathwayGenerator: null,
    renderer: null,
    validator: null,
    proseCacheSink: { flush: () => {} },
    toolFactory: factory,
    logger: makeLogger(),
    options: {},
  });
  return nodes.datasets.run({ parse: { ...parse, clinical } });
}

describe("datasets node — condition resolution", () => {
  test("resolves clinical conditions to Synthea modules", async () => {
    const { factory, calls } = makeRecordingFactory();
    const parse = {
      datasets: [
        {
          id: "trial_patients",
          tool: "synthea",
          config: { conditions: ["diabetes_t2", "lung_cancer"] },
        },
      ],
      outputs: [],
      seed: 42,
    };
    const clinical = {
      conditions: [
        { id: "diabetes_t2", synthea_module: "diabetes" },
        { id: "lung_cancer", synthea_module: "lung_cancer" },
      ],
    };

    await runDatasetsNode(parse, { clinical, factory });

    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(calls[0].modules, ["diabetes", "lung_cancer"]);
  });

  test("silently skips unknown condition refs", async () => {
    const { factory, calls } = makeRecordingFactory();
    const parse = {
      datasets: [
        {
          id: "trial_patients",
          tool: "synthea",
          config: { conditions: ["diabetes_t2", "unknown_condition"] },
        },
      ],
      outputs: [],
      seed: 42,
    };
    const clinical = {
      conditions: [{ id: "diabetes_t2", synthea_module: "diabetes" }],
    };

    await runDatasetsNode(parse, { clinical, factory });

    assert.deepStrictEqual(calls[0].modules, ["diabetes"]);
  });

  test("ignores conditions when no clinical block, leaves modules untouched", async () => {
    const { factory, calls } = makeRecordingFactory();
    const parse = {
      datasets: [
        {
          id: "trial_patients",
          tool: "synthea",
          config: {
            modules: ["hypertension"],
            conditions: ["lung_cancer"],
          },
        },
      ],
      outputs: [],
      seed: 42,
    };

    await runDatasetsNode(parse, { clinical: null, factory });

    assert.deepStrictEqual(calls[0].modules, ["hypertension"]);
    assert.deepStrictEqual(calls[0].conditions, ["lung_cancer"]);
  });

  test("leaves config.modules untouched when dataset has no conditions field", async () => {
    const { factory, calls } = makeRecordingFactory();
    const parse = {
      datasets: [
        {
          id: "trial_patients",
          tool: "synthea",
          config: { modules: ["diabetes"] },
        },
      ],
      outputs: [],
      seed: 42,
    };
    const clinical = {
      conditions: [{ id: "diabetes_t2", synthea_module: "diabetes" }],
    };

    await runDatasetsNode(parse, { clinical, factory });

    assert.deepStrictEqual(calls[0].modules, ["diabetes"]);
  });
});

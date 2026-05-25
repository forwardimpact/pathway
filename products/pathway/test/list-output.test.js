import { test, describe } from "node:test";
import assert from "node:assert";

import { runLevelCommand } from "../src/commands/level.js";
import { runDisciplineCommand } from "../src/commands/discipline.js";
import { runTrackCommand } from "../src/commands/track.js";
import { runBehaviourCommand } from "../src/commands/behaviour.js";
import { runDriverCommand } from "../src/commands/driver.js";
import { runSkillCommand } from "../src/commands/skill.js";

/**
 * Capture process.stdout.write during an async function and return the joined output.
 * @param {() => unknown} fn - Function to run; may be sync or return a promise.
 * @returns {Promise<string>} The captured stdout as a string.
 */
function captureStdout(fn) {
  const original = process.stdout.write.bind(process.stdout);
  const chunks = [];
  process.stdout.write = (chunk) => {
    chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    return true;
  };
  return Promise.resolve(fn())
    .finally(() => {
      process.stdout.write = original;
    })
    .then(() => chunks.join(""));
}

const fixture = {
  levels: [{ id: "J040" }, { id: "J060" }],
  disciplines: [{ id: "software_engineering" }, { id: "data_engineering" }],
  // track.js configures `sortItems: sortTracksByName`, which sorts before the
  // --list short-circuit and reads `.name.localeCompare` — so `name` is
  // required on each track fixture entry even though `--list` does not print it.
  tracks: [
    { id: "platform", name: "Platform Engineering" },
    { id: "sre", name: "Site Reliability Engineering" },
  ],
  behaviours: [{ id: "collaboration" }, { id: "ownership" }],
  drivers: [{ id: "shipping_velocity" }],
  skills: [{ id: "testing", capability: "delivery" }],
  capabilities: [{ id: "delivery" }],
  standard: null,
};

describe("entity --list outputs id-only", () => {
  for (const [name, runner, plural] of [
    ["level", runLevelCommand, "levels"],
    ["discipline", runDisciplineCommand, "disciplines"],
    ["track", runTrackCommand, "tracks"],
    ["behaviour", runBehaviourCommand, "behaviours"],
    ["driver", runDriverCommand, "drivers"],
    ["skill", runSkillCommand, "skills"],
  ]) {
    test(`${name} --list emits one id per line, no commas, no header`, async () => {
      const out = await captureStdout(() =>
        runner({ data: fixture, args: [], options: { list: true } }),
      );
      assert.ok(!out.includes(","), "no commas");
      const lines = out.split("\n").filter((l) => l.length > 0);
      const expected = fixture[plural].map((i) => i.id);
      if (plural === "tracks") {
        expected.sort((a, b) => {
          const aName = fixture.tracks.find((t) => t.id === a).name;
          const bName = fixture.tracks.find((t) => t.id === b).name;
          return aName.localeCompare(bName);
        });
      }
      assert.deepStrictEqual(lines, expected);
      for (const line of lines) {
        assert.strictEqual(line, line.trim(), "no trailing whitespace");
      }
    });
  }
});

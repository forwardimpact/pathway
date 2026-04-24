import { describe, test } from "node:test";
import assert from "node:assert";

import {
  FACILITATOR_SYSTEM_PROMPT,
  FACILITATED_AGENT_SYSTEM_PROMPT,
  SUPERVISOR_SYSTEM_PROMPT,
  AGENT_SYSTEM_PROMPT,
} from "@forwardimpact/libeval";

const FACILITATED_PROMPTS = [
  ["FACILITATOR_SYSTEM_PROMPT", FACILITATOR_SYSTEM_PROMPT],
  ["FACILITATED_AGENT_SYSTEM_PROMPT", FACILITATED_AGENT_SYSTEM_PROMPT],
];
const SUPERVISE_PROMPTS = [
  ["SUPERVISOR_SYSTEM_PROMPT", SUPERVISOR_SYSTEM_PROMPT],
  ["AGENT_SYSTEM_PROMPT", AGENT_SYSTEM_PROMPT],
];
const ALL_PROMPTS = [...FACILITATED_PROMPTS, ...SUPERVISE_PROMPTS];

describe("SC 4 — prompts name Ask / Answer / Announce", () => {
  test("facilitator names Ask + Announce", () => {
    assert.ok(FACILITATOR_SYSTEM_PROMPT.includes("Ask"));
    assert.ok(FACILITATOR_SYSTEM_PROMPT.includes("Announce"));
  });
  test("facilitated agent names Ask + Answer + Announce", () => {
    assert.ok(FACILITATED_AGENT_SYSTEM_PROMPT.includes("Ask"));
    assert.ok(FACILITATED_AGENT_SYSTEM_PROMPT.includes("Answer"));
    assert.ok(FACILITATED_AGENT_SYSTEM_PROMPT.includes("Announce"));
  });
  test("supervisor + agent name Ask + Answer + Announce", () => {
    for (const [, prompt] of SUPERVISE_PROMPTS) {
      assert.ok(prompt.includes("Ask"));
      assert.ok(prompt.includes("Answer"));
      assert.ok(prompt.includes("Announce"));
    }
  });
});

describe("SC 4 — prompts carry no enforcement phrasing", () => {
  const forbidden = [
    "then Answer",
    "then Share",
    "respond via",
    "stop making",
    "must Answer",
    "before your turn",
  ];
  for (const [name, prompt] of ALL_PROMPTS) {
    test(`${name} free of enforcement phrases`, () => {
      for (const phrase of forbidden) {
        assert.ok(!prompt.includes(phrase), `${name} contains "${phrase}"`);
      }
    });
  }
});

describe("SC 4 — prompts are domain-agnostic", () => {
  const forbidden = ["kata-", "storyboard", "coaching", "Toyota", "meeting"];
  for (const [name, prompt] of ALL_PROMPTS) {
    test(`${name} free of domain vocabulary`, () => {
      for (const word of forbidden) {
        assert.ok(!prompt.includes(word), `${name} contains "${word}"`);
      }
    });
  }
});

describe("SC 1 — prompts do not reference the removed Tell / Share tools", () => {
  for (const [name, prompt] of ALL_PROMPTS) {
    test(`${name} free of Tell / Share references`, () => {
      assert.ok(!prompt.includes("Tell"), `${name} contains "Tell"`);
      assert.ok(!prompt.includes("Share"), `${name} contains "Share"`);
    });
  }
});

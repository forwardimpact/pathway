import { test, describe } from "node:test";
import assert from "node:assert";

import { defineRoute } from "../src/route-descriptor.js";

describe("defineRoute", () => {
  test("returns a frozen descriptor with pattern and page", () => {
    const page = () => {};
    const desc = defineRoute({ pattern: "/skill/:id", page });
    assert.strictEqual(desc.pattern, "/skill/:id");
    assert.strictEqual(desc.page, page);
    assert.strictEqual(Object.isFrozen(desc), true);
  });

  test("cli and graph are optional", () => {
    const desc = defineRoute({ pattern: "/", page: () => {} });
    assert.strictEqual(desc.cli, undefined);
    assert.strictEqual(desc.graph, undefined);
  });

  test("carries cli and graph when provided", () => {
    const cli = (ctx) => `npx fit-pathway skill ${ctx.args.id}`;
    const graph = (ctx, base) => `${base}Skill/${ctx.args.id}`;
    const desc = defineRoute({
      pattern: "/skill/:id",
      page: () => {},
      cli,
      graph,
    });
    assert.strictEqual(desc.cli, cli);
    assert.strictEqual(desc.graph, graph);
  });

  test("throws TypeError when pattern is missing", () => {
    assert.throws(() => defineRoute({ page: () => {} }), {
      name: "TypeError",
      message: "pattern: string",
    });
  });

  test("throws TypeError when page is missing", () => {
    assert.throws(() => defineRoute({ pattern: "/" }), {
      name: "TypeError",
      message: "page: function",
    });
  });
});

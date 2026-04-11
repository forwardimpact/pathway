import { describe, test } from "node:test";
import assert from "node:assert";
import { tokenize } from "../src/dsl/tokenizer.js";
import { parse } from "../src/dsl/parser.js";

function parseDsl(source) {
  return parse(tokenize(source));
}

describe("dataset and output parsing", () => {
  test("parses empty universe with no datasets", () => {
    const ast = parseDsl("universe test {}");
    assert.deepStrictEqual(ast.datasets, []);
    assert.deepStrictEqual(ast.outputs, []);
  });

  test("parses faker dataset block", () => {
    const ast = parseDsl(`universe test {
      dataset researchers {
        tool faker
        rows 100
        fields {
          name "person.fullName"
          email "internet.email"
        }
      }
    }`);
    assert.strictEqual(ast.datasets.length, 1);
    const ds = ast.datasets[0];
    assert.strictEqual(ds.id, "researchers");
    assert.strictEqual(ds.tool, "faker");
    assert.strictEqual(ds.config.rows, 100);
    assert.deepStrictEqual(ds.config.fields, {
      name: "person.fullName",
      email: "internet.email",
    });
  });

  test("parses synthea dataset block", () => {
    const ast = parseDsl(`universe test {
      dataset patients {
        tool synthea
        population 200
        modules [diabetes, cardiovascular]
      }
    }`);
    const ds = ast.datasets[0];
    assert.strictEqual(ds.tool, "synthea");
    assert.strictEqual(ds.config.population, 200);
    assert.deepStrictEqual(ds.config.modules, ["diabetes", "cardiovascular"]);
  });

  test("parses sdv dataset block", () => {
    const ast = parseDsl(`universe test {
      dataset claims {
        tool sdv
        metadata "schemas/meta.json"
        data {
          claims "data/sample.csv"
        }
        rows 5000
      }
    }`);
    const ds = ast.datasets[0];
    assert.strictEqual(ds.tool, "sdv");
    assert.strictEqual(ds.config.metadata, "schemas/meta.json");
    assert.deepStrictEqual(ds.config.data, { claims: "data/sample.csv" });
    assert.strictEqual(ds.config.rows, 5000);
  });

  test("parses output blocks", () => {
    const ast = parseDsl(`universe test {
      output patients json { path "out/patients.json" }
      output claims sql { path "out/claims.sql" table "my_claims" }
    }`);
    assert.strictEqual(ast.outputs.length, 2);
    assert.strictEqual(ast.outputs[0].dataset, "patients");
    assert.strictEqual(ast.outputs[0].format, "json");
    assert.strictEqual(ast.outputs[0].config.path, "out/patients.json");
    assert.strictEqual(ast.outputs[1].format, "sql");
    assert.strictEqual(ast.outputs[1].config.table, "my_claims");
  });

  test("parses all six output formats", () => {
    const formats = ["json", "yaml", "csv", "markdown", "parquet", "sql"];
    for (const fmt of formats) {
      const ast = parseDsl(
        `universe test { output ds ${fmt} { path "out/file" } }`,
      );
      assert.strictEqual(ast.outputs[0].format, fmt);
    }
  });

  test("throws on unknown output format", () => {
    assert.throws(
      () => parseDsl(`universe test { output ds xlsx { path "out/file" } }`),
      /Unknown output format 'xlsx'/,
    );
  });

  test("throws on unknown keyword in dataset", () => {
    assert.throws(
      () => parseDsl(`universe test { dataset x { tool faker bogus 5 } }`),
      /Unexpected 'bogus' in dataset/,
    );
  });

  test("throws on unknown keyword in output", () => {
    assert.throws(
      () => parseDsl(`universe test { output ds json { path "x" bogus "y" } }`),
      /Unexpected 'bogus' in output/,
    );
  });

  test("parses mixed org and dataset blocks", () => {
    const ast = parseDsl(`universe test {
      domain "example.com"
      seed 42
      org hq { name "HQ" location "NYC" }
      dataset researchers {
        tool faker
        rows 10
        fields { name "person.fullName" }
      }
      output researchers json { path "out/r.json" }
    }`);
    assert.strictEqual(ast.orgs.length, 1);
    assert.strictEqual(ast.datasets.length, 1);
    assert.strictEqual(ast.outputs.length, 1);
    assert.strictEqual(ast.domain, "example.com");
  });

  test("parses multiple dataset blocks", () => {
    const ast = parseDsl(`universe test {
      dataset a { tool faker rows 5 fields { x "string.uuid" } }
      dataset b { tool faker rows 10 fields { y "person.firstName" } }
    }`);
    assert.strictEqual(ast.datasets.length, 2);
    assert.strictEqual(ast.datasets[0].id, "a");
    assert.strictEqual(ast.datasets[1].id, "b");
  });
});

import { z } from "zod";

const SYSTEM_FIELDS = new Set(["llm_token", "filter", "resource_id"]);

const ZOD_FACTORIES = {
  string: () => z.string(),
  int32: () => z.number(),
  int64: () => z.number(),
  uint32: () => z.number(),
  uint64: () => z.number(),
  float: () => z.number(),
  double: () => z.number(),
  bool: () => z.boolean(),
  sint32: () => z.number(),
  sint64: () => z.number(),
  fixed32: () => z.number(),
  fixed64: () => z.number(),
  sfixed32: () => z.number(),
  sfixed64: () => z.number(),
};

/**
 * Build a Zod schema object from codegen field metadata.
 * Excludes system fields and nested message types.
 * @param {object} fields - Field metadata from codegen
 * @returns {object} Zod schema object for MCP server.tool()
 */
export function buildZodSchema(fields) {
  const schema = {};
  for (const [name, field] of Object.entries(fields)) {
    if (SYSTEM_FIELDS.has(name)) continue;
    if (field.type === "message") continue;
    const factory = ZOD_FACTORIES[field.type] || (() => z.string());
    const base = field.repeated
      ? z.union([factory(), z.array(factory())])
      : factory();
    schema[name] = base
      .optional()
      .describe(field.description || name.replace(/_/g, " "));
  }
  return schema;
}

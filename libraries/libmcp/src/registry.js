import * as types from "@forwardimpact/libtype";
import { metadata } from "@forwardimpact/libtype";
import { buildZodSchema } from "./schema.js";

/**
 * Register MCP tools from config endpoints using codegen metadata.
 *
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server
 * @param {object} config - Config instance with .tools (from createServiceConfig("mcp"))
 * @param {object} clients - gRPC clients keyed by package name (e.g. { graph, vector, pathway })
 */
export function registerToolsFromConfig(server, config, clients) {
  const tools = config.tools;
  if (!tools || Object.keys(tools).length === 0) return;

  let count = 0;
  for (const [toolName, endpoint] of Object.entries(tools)) {
    const [packageName, serviceName, methodName] = endpoint.method.split(".");
    const serviceKey = `${packageName}.${serviceName}`;
    const methodMeta = metadata[serviceKey]?.[methodName];

    if (!methodMeta) {
      throw new Error(
        `registerToolsFromConfig: no metadata for ${endpoint.method}`,
      );
    }

    // Resolve the request type class from libtype
    const [reqPkg, reqTypeName] = methodMeta.requestType.split(".");
    const RequestClass = types[reqPkg]?.[reqTypeName];
    if (!RequestClass?.fromObject) {
      throw new Error(
        `registerToolsFromConfig: no libtype class for ${methodMeta.requestType}`,
      );
    }

    const client = clients[packageName];
    if (!client) {
      throw new Error(
        `registerToolsFromConfig: no client for package "${packageName}"`,
      );
    }

    const schema = buildZodSchema(methodMeta.fields);

    server.tool(toolName, endpoint.description, schema, async (params) => {
      const normalized = {};
      for (const [k, v] of Object.entries(params)) {
        const field = methodMeta.fields[k];
        if (field?.repeated) {
          normalized[k] = Array.isArray(v) ? v : v ? [v] : [];
        } else {
          normalized[k] = v || "";
        }
      }
      const req = RequestClass.fromObject(normalized);
      const result = await client[methodName](req);
      return {
        content: [
          {
            type: "text",
            text: result.identifiers?.length
              ? JSON.stringify(result.identifiers)
              : result.content || "",
          },
        ],
      };
    });
    count++;
  }
}

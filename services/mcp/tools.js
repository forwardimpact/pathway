import { z } from "zod";
import { common, graph, vector, pathway } from "@forwardimpact/libtype";

/**
 * Registers all 10 retained Guide tools on the MCP server.
 * Each tool creates a proto request, calls the appropriate gRPC backend,
 * and returns the response as an MCP text content block.
 *
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server
 * @param {{ graphClient: object, vectorClient: object, pathwayClient: object }} clients
 */
export function registerTools(
  server,
  { graphClient, vectorClient, pathwayClient },
) {
  server.tool(
    "get_ontology",
    "Returns all entity types and relationship predicates in the knowledge graph.",
    {},
    async () => {
      const result = await graphClient.GetOntology(common.Empty.fromObject({}));
      return {
        content: [{ type: "text", text: result.content || "" }],
      };
    },
  );

  server.tool(
    "get_subjects",
    "Lists entity URIs in the graph, optionally filtered by type.",
    { type: z.string().optional().describe("Entity type URI to filter by") },
    async ({ type }) => {
      const result = await graphClient.GetSubjects(
        graph.SubjectsQuery.fromObject({ type: type || "" }),
      );
      return {
        content: [{ type: "text", text: result.content || "" }],
      };
    },
  );

  server.tool(
    "query_by_pattern",
    "Retrieves structured data by traversing graph relationships using triple patterns.",
    {
      subject: z.string().optional().describe("Subject URI or '?' wildcard"),
      predicate: z
        .string()
        .optional()
        .describe("Predicate URI or '?' wildcard"),
      object: z
        .string()
        .optional()
        .describe("Object URI/literal or '?' wildcard"),
    },
    async ({ subject, predicate, object }) => {
      const result = await graphClient.QueryByPattern(
        graph.PatternQuery.fromObject({
          subject: subject || "",
          predicate: predicate || "",
          object: object || "",
        }),
      );
      return {
        content: [
          {
            type: "text",
            text: result.identifiers
              ? JSON.stringify(result.identifiers)
              : result.content || "",
          },
        ],
      };
    },
  );

  server.tool(
    "search_content",
    "Find detailed content using semantic similarity search.",
    { input: z.string().describe("Text query to search for") },
    async ({ input }) => {
      const result = await vectorClient.SearchContent(
        vector.TextQuery.fromObject({ input: [input] }),
      );
      return {
        content: [
          {
            type: "text",
            text: result.identifiers
              ? JSON.stringify(result.identifiers)
              : result.content || "",
          },
        ],
      };
    },
  );

  server.tool(
    "pathway_list_jobs",
    "List jobs (discipline x level x track) defined in the pathway framework.",
    {
      discipline: z.string().optional().describe("Optional discipline id"),
    },
    async ({ discipline }) => {
      const result = await pathwayClient.ListJobs(
        pathway.ListJobsRequest.fromObject({ discipline: discipline || "" }),
      );
      return {
        content: [{ type: "text", text: result.content || "" }],
      };
    },
  );

  server.tool(
    "pathway_describe_job",
    "Describe a job at (discipline, level, optional track) including skills, behaviours, and responsibilities.",
    {
      discipline: z.string().describe("Discipline id (e.g. 'fde')"),
      level: z.string().describe("Level id (e.g. 'l3')"),
      track: z.string().optional().describe("Optional track id"),
    },
    async ({ discipline, level, track }) => {
      const result = await pathwayClient.DescribeJob(
        pathway.DescribeJobRequest.fromObject({
          discipline,
          level,
          track: track || "",
        }),
      );
      return {
        content: [{ type: "text", text: result.content || "" }],
      };
    },
  );

  server.tool(
    "pathway_list_agent_profiles",
    "List static agent profile (discipline, track) combinations.",
    {
      discipline: z.string().optional().describe("Optional discipline id"),
    },
    async ({ discipline }) => {
      const result = await pathwayClient.ListAgentProfiles(
        pathway.ListAgentProfilesRequest.fromObject({
          discipline: discipline || "",
        }),
      );
      return {
        content: [{ type: "text", text: result.content || "" }],
      };
    },
  );

  server.tool(
    "pathway_describe_agent_profile",
    "Describe stage agent profiles for a (discipline, track).",
    {
      discipline: z.string().describe("Discipline id"),
      track: z.string().describe("Track id"),
    },
    async ({ discipline, track }) => {
      const result = await pathwayClient.DescribeAgentProfile(
        pathway.DescribeAgentProfileRequest.fromObject({ discipline, track }),
      );
      return {
        content: [{ type: "text", text: result.content || "" }],
      };
    },
  );

  server.tool(
    "pathway_describe_progression",
    "Compute the progression delta between two levels of the same discipline.",
    {
      discipline: z.string().describe("Discipline id"),
      from_level: z.string().describe("Starting level id"),
      to_level: z.string().describe("Target level id"),
      track: z.string().optional().describe("Optional track id"),
    },
    async ({ discipline, from_level, to_level, track }) => {
      const result = await pathwayClient.DescribeProgression(
        pathway.DescribeProgressionRequest.fromObject({
          discipline,
          from_level,
          to_level,
          track: track || "",
        }),
      );
      return {
        content: [{ type: "text", text: result.content || "" }],
      };
    },
  );

  server.tool(
    "pathway_list_job_software",
    "List the software toolkit derived for a job.",
    {
      discipline: z.string().describe("Discipline id"),
      level: z.string().describe("Level id"),
      track: z.string().optional().describe("Optional track id"),
    },
    async ({ discipline, level, track }) => {
      const result = await pathwayClient.ListJobSoftware(
        pathway.ListJobSoftwareRequest.fromObject({
          discipline,
          level,
          track: track || "",
        }),
      );
      return {
        content: [{ type: "text", text: result.content || "" }],
      };
    },
  );
}

import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  collection_id: z
    .string()
    .describe(
      "The collection id without the 'cloudglue://collections/' prefix (e.g., for 'cloudglue://collections/abc123', use 'abc123')",
    ),
  limit: z
    .number()
    .min(1)
    .max(10)
    .describe("The maximum number of entities to return")
    .default(20),
  offset: z
    .number()
    .min(0)
    .describe("The offset to start from")
    .default(0),
};

export function registerListCollectionEntities(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "list_collection_entities",
    "Retrieves a batch of entities in a collection with a single call, with pagination. Use the offset parameter to paginate through the results.",
    schema,
    async ({ collection_id, limit, offset }) => {
      const entities = await cgClient.collections.listEntities(
        collection_id,
        { limit: limit, offset: offset }
      );
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(entities),
          },
        ],
      };
    },
  );
} 
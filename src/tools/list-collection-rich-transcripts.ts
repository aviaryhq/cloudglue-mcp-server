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
    .max(100)
    .describe("The maximum number of transcripts to return")
    .default(10),
};

export function registerListCollectionRichTranscripts(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "list_collection_rich_transcripts",
    "Batch retrieves all rich transcripts in a collection with a single call.",
    schema,
    async ({ collection_id, limit }) => {
      const transcripts = await cgClient.collections.listRichTranscripts(
        collection_id,
        { limit }
      );
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(transcripts),
          },
        ],
      };
    },
  );
} 
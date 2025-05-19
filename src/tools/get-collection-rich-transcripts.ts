import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  collection_id: z
    .string()
    .describe(
      "The collection id without the 'cloudglue://collections/' prefix (e.g., for 'cloudglue://collections/abc123', use 'abc123')",
    ),
  file_id: z
    .string()
    .describe(
      "The file id without the 'cloudglue://files/' prefix (e.g., for 'cloudglue://files/abc123', use 'abc123')",
    ),
};

export function registerGetCollectionRichTranscripts(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "get_collection_rich_transcripts",
    "Returns rich transcripts of a video in a given collection. Requires both collection_id and file_id parameters without their URI prefixes",
    schema,
    async ({ collection_id, file_id }) => {
      const transcripts = await cgClient.collections.getTranscripts(
        collection_id, file_id, undefined, undefined, 'markdown'
      );
      return {
        content: [
          {
            type: "text",
            text: transcripts.content ?? "No transcripts found",
          },
        ],
      };
    },
  );
}

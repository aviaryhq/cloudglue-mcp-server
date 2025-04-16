import { z } from "zod";
import { CloudGlue } from "cloudglue-js";
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

export function registerGetCollectionVideoDescription(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "get_collection_video_description",
    "Returns detailed description of a video in a given collection. Requires both collection_id and file_id parameters without their URI prefixes",
    schema,
    async ({ collection_id, file_id }) => {
      const description = await cgClient.collections.getDescription(
        collection_id,
        file_id,
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(description),
          },
        ],
      };
    },
  );
}

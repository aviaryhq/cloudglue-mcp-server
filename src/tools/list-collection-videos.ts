import { z } from "zod";
import { CloudGlue } from "cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  collection_id: z
    .string()
    .describe(
      "The collection id of the videos to return, e.g. cloudglue://collections/<collection_id>",
    ),
  limit: z
    .number()
    .min(1)
    .max(100)
    .describe("The maximum number of videos to return")
    .default(10),
};

export function registerListCollectionVideos(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "list_collection_videos",
    "Returns metadata about videos in a given collection",
    schema,
    async ({ collection_id, limit }) => {
      const files = await cgClient.collections.listVideos(collection_id, {
        limit: limit,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(files),
          },
        ],
      };
    },
  );
}

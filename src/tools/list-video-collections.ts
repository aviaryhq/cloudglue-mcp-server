import { z } from "zod";
import { CloudGlue } from "cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  limit: z
    .number()
    .min(1)
    .max(100)
    .describe("The maximum number of collections to return")
    .default(10),
};

export function registerListVideoCollections(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "list_video_collections",
    "Returns metadata about video collections that the user has access to. Lists all available collections with their IDs and metadata.",
    schema,
    async ({ limit }) => {
      const collections = await cgClient.collections.listCollections({
        limit: limit,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(collections),
          },
        ],
      };
    },
  );
}

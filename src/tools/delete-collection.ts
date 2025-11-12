import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  collection_id: z
    .string()
    .describe(
      "Collection ID to delete. Use collection ID from list_collections. Note: This will delete the collection but not the video files themselves.",
    ),
};

export function registerDeleteCollection(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "delete_collection",
    "Delete a collection from your account. The collection and its configuration will be removed, but the video files themselves remain in your account and can be accessed individually or added to other collections.",
    schema,
    async ({ collection_id }) => {
      try {
        const result = await cgClient.collections.deleteCollection(
          collection_id,
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  collection_id: collection_id,
                  status: "deleted",
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  collection_id: collection_id,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Unknown error occurred",
                },
                null,
                2,
              ),
            },
          ],
        };
      }
    },
  );
}


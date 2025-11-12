import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  collection_id: z
    .string()
    .describe(
      "Collection ID where the video is located. Use collection ID from list_collections.",
    ),
  file_id: z
    .string()
    .describe(
      "Cloudglue file ID of the video to remove from the collection. Use file ID from list_videos.",
    ),
};

export function registerRemoveVideoFromCollection(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "remove_video_from_collection",
    "Remove a video from a collection using its Cloudglue file ID. The video file itself is not deleted from your account, only removed from this collection.",
    schema,
    async ({ collection_id, file_id }) => {
      try {
        const result = await cgClient.collections.deleteVideo(
          collection_id,
          file_id,
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  collection_id: collection_id,
                  file_id: file_id,
                  status: "removed",
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
                  file_id: file_id,
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


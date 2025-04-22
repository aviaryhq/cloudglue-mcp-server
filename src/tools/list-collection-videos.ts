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
    .describe("The maximum number of videos to return")
    .default(10),
};

export function registerListCollectionVideos(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "list_collection_videos",
    "Returns metadata about videos in a given collection using the collection ID.",
    schema,
    async ({ collection_id, limit }) => {
      const files = await cgClient.collections.listVideos(collection_id, {
        limit: limit,
      });

      // Process each file to get additional information
      const processedFiles = await Promise.all(
        files.data
          .filter(file => file.status === "completed")
          .map(async (file) => {
            const fileInfo = await cgClient.files.getFile(file.file_id);
            
            return {
              file_id: file.file_id,
              collection_id: file.collection_id,
              filename: fileInfo.filename,
              uri: fileInfo.uri,
              added_at: file.added_at,
              metadata: fileInfo.metadata,
              video_info: fileInfo.video_info ? {
                duration_seconds: fileInfo.video_info.duration_seconds,
                has_audio: fileInfo.video_info.has_audio
              } : null
            };
          })
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(processedFiles),
          },
        ],
      };
    },
  );
}

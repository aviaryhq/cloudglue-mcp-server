import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
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

      // Process each collection to get video counts and selective fields
      const processedCollections = await Promise.all(
        collections.data.map(async (collection) => {
          // Get all videos in the collection to count completed ones
          const videos = await cgClient.collections.listVideos(collection.id, {
            limit: 100, // TODO paginate
          });
          
          const completedVideoCount = videos.data.filter(
            video => video.status === "completed"
          ).length;

          return {
            id: collection.id,
            name: collection.name,
            created_at: collection.created_at,
            video_count: completedVideoCount,
            ...(collection.description && { description: collection.description }),
            ...(collection.extract_config && {
              extract_config: {
                ...(collection.extract_config.prompt && { prompt: collection.extract_config.prompt }),
                ...(collection.extract_config.schema && { schema: collection.extract_config.schema })
              }
            })
          };
        })
      );

      // Filter out collections with no completed videos
      const collectionsWithVideos = processedCollections.filter(
        collection => collection.video_count > 0
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(collectionsWithVideos),
          },
        ],
      };
    },
  );
}

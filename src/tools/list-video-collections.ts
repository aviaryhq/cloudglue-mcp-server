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
  collection_type: z
    .string()
    .describe("The type of collections to return; 'rich-transcripts' or 'entities'")
    .default("rich-transcripts"),
};

export function registerListVideoCollections(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "list_video_collections",
    "Returns metadata about video collections that the user has access to. Lists all available collections with their IDs and metadata.",
    schema,
    async ({ limit, collection_type }) => {
      const collections = await cgClient.collections.listCollections({
        limit: limit,
        collection_type: collection_type as "rich-transcripts" | "entities",
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
            collection_type: collection.collection_type ?? 'rich-transcripts',
            created_at: collection.created_at,
            video_count: completedVideoCount,
            description: collection.description ?? undefined,            
            transcribe_config: collection.transcribe_config ? {
              enable_summary: collection.transcribe_config.enable_summary ?? undefined,
              enable_speech: collection.transcribe_config.enable_speech ?? undefined,
              enable_scene_text: collection.transcribe_config.enable_scene_text ?? undefined,
              enable_visual_scene_description: collection.transcribe_config.enable_visual_scene_description ?? undefined
            } : undefined,
            extract_config: collection.extract_config ? {
              prompt: collection.extract_config.prompt ?? undefined,
              schema: collection.extract_config.schema ?? undefined
            } : undefined
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

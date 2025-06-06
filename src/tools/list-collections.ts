import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  limit: z
    .number()
    .min(1)
    .max(100)
    .describe("Maximum number of collections to return (1-100). Start with smaller numbers for initial exploration.")
    .default(10),
  collection_type: z
    .string()
    .describe("Filter by collection type: 'rich-transcripts' (for video transcripts/descriptions) or 'entities' (for structured data extraction). Leave empty to see all types.")
    .optional(),
};

export function registerListCollections(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "list_collections",
    "Discover available video collections and their basic metadata. Use this first to understand what video collections exist before using other collection-specific tools. Shows collection IDs needed for other tools, video counts, and collection types.",
    schema,
    async ({ limit, collection_type }) => {
      const collections = await cgClient.collections.listCollections({
        limit: limit,
        ...(collection_type && { collection_type: collection_type as "rich-transcripts" | "entities" }),
      });

      // Process each collection to get video counts and selective fields
      const processedCollections = await Promise.all(
        collections.data.map(async (collection) => {
          // Get all videos in the collection to count completed ones
          const videos = await cgClient.collections.listVideos(collection.id, {
            limit: 100, // TODO: paginate for very large collections
          });
          
          const completedVideoCount = videos.data.filter(
            video => video.status === "completed"
          ).length;

          return {
            id: collection.id,
            name: collection.name,
            collection_type: collection.collection_type ?? 'rich-transcripts',
            created_at: collection.created_at,
            completed_video_count: completedVideoCount,
            description: collection.description ?? undefined,            
          };
        })
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(processedCollections, null, 2),
          },
        ],
      };
    },
  );
} 
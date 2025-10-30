import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  limit: z
    .number()
    .min(1)
    .max(100)
    .describe(
      "Maximum number of collections to return (1-100). Start with smaller numbers for initial exploration.",
    )
    .default(10),
  offset: z
    .number()
    .min(0)
    .describe(
      "Number of collections to skip for pagination (e.g., offset=10, limit=10 gets collections 11-20). Use to page through large lists of collections.",
    )
    .default(0),
  collection_type: z
    .string()
    .describe(
      "Filter by collection type: 'rich-transcripts', 'media-descriptions', or 'entities'. Leave empty to see all types.",
    )
    .optional(),
};

export function registerListCollections(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "list_collections",
    "Discover available video collections and their basic metadata. Use this first to understand what video collections exist before using other collection-specific tools. Shows collection IDs needed for other tools, video counts, and collection types. For collections with type 'media-descriptions', use `describe_video` with the collection_id parameter to fetch previously extracted descriptions for a given Cloudglue file. For collections with type 'entities', use `extract_video_entities` with the collection_id parameter to fetch previously extracted entities for a given Cloudglue file. **Pagination guidance**: For comprehensive exploration, paginate through all collections (check `has_more` and increment `offset` by `limit`) to ensure you don't miss any collections. Use smaller limits (5-10) for quick overviews, larger limits (25-50) for thorough exploration.",
    schema,
    async ({ limit, offset, collection_type }) => {
      const collections = await cgClient.collections.listCollections({
        limit: limit,
        offset: offset,
        ...(collection_type && {
          collection_type: collection_type as
            | "rich-transcripts"
            | "media-descriptions"
            | "entities",
        }),
      });

      // Process each collection to get video counts and selective fields
      const processedCollections = await Promise.all(
        collections.data.map(async (collection) => {
          // Get all videos in the collection to count completed ones
          const videos = await cgClient.collections.listVideos(collection.id, {
            limit: 100, // TODO: paginate for very large collections
          });

          const completedVideoCount = videos.data.filter(
            (video) => video.status === "completed",
          ).length;

          return {
            id: collection.id,
            name: collection.name,
            collection_type: collection.collection_type ?? "rich-transcripts",
            created_at: collection.created_at,
            completed_video_count: completedVideoCount,
            description: collection.description ?? undefined,
          };
        }),
      );

      const result = {
        collections: processedCollections,
        pagination: {
          offset,
          limit,
          total: collections.total,
          has_more: processedCollections.length === limit,
        },
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}

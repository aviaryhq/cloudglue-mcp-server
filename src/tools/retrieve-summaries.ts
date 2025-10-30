import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  collection_id: z
    .string()
    .describe(
      "Collection ID from list_collections without the 'cloudglue://collections/' prefix (e.g., use 'abc123' not 'cloudglue://collections/abc123'). Works with both rich-transcripts and media-descriptions collections.",
    ),
  limit: z
    .number()
    .min(1)
    .max(50)
    .describe(
      "Maximum number of summaries to return per request (1-50) with pagination. Use smaller numbers for initial exploration, larger for comprehensive collection overview.",
    )
    .default(25),
  offset: z
    .number()
    .min(0)
    .describe(
      "Number of summaries to skip for pagination (e.g., offset=25, limit=25 gets summaries 26-50). Use to page through large collections.",
    )
    .default(0),
  created_after: z
    .string()
    .describe(
      "Only include summaries created after this date (YYYY-MM-DD format, e.g., '2024-01-15'). Useful for analyzing recent additions to a collection.",
    )
    .optional(),
  created_before: z
    .string()
    .describe(
      "Only include summaries created before this date (YYYY-MM-DD format, e.g., '2024-01-15'). Useful for analyzing historical content.",
    )
    .optional(),
};

export function registerRetrieveSummaries(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "retrieve_summaries",
    "Bulk retrieve video summaries and titles from a collection to quickly understand its content and themes. Works with both rich-transcripts and media-descriptions collections. Use this as your first step when analyzing a collection - it's more efficient than retrieving full descriptions and helps you determine if you need more detailed information. Perfect for getting a high-level overview of what's in a collection, identifying common topics, or determining if a collection contains relevant content for a specific query. Only proceed to retrieve_descriptions if you need the full multimodal context for specific videos identified through the summaries. For single videos, use describe_video instead. For targeted content discovery, consider using search_video_summaries (for relevant videos) or search_video_moments (for specific segments) instead of browsing through all summaries. **Pagination guidance**: For comprehensive collection analysis, paginate through all summaries (check `has_more` and increment `offset` by `limit`) to ensure complete coverage. Use larger limits (25-50) for efficient bulk analysis, smaller limits (5-10) for targeted exploration.",
    schema,
    async ({ collection_id, limit, offset, created_after, created_before }) => {
      // First get the collection to determine its type
      const collection =
        await cgClient.collections.getCollection(collection_id);

      if (!collection || !collection.collection_type) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: "Collection not found or invalid collection ID",
                  collection_id,
                  summaries: [],
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      if (
        collection.collection_type !== "rich-transcripts" &&
        collection.collection_type !== "media-descriptions"
      ) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: `Collection type '${collection.collection_type}' is not supported. This tool works with rich-transcripts and media-descriptions collections only.`,
                  collection_id,
                  collection_type: collection.collection_type,
                  summaries: [],
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Get all descriptions first to apply our own filtering
      // Note: The API may not support date filtering natively, so we'll get more and filter
      const fetchLimit = Math.min(limit + offset + 50, 100); // Get extra for filtering

      let descriptions;
      if (collection.collection_type === "rich-transcripts") {
        descriptions = await cgClient.collections.listRichTranscripts(
          collection_id,
          { limit: fetchLimit, offset: 0 },
        );
      } else {
        descriptions = await cgClient.collections.listMediaDescriptions(
          collection_id,
          { limit: fetchLimit, offset: 0 },
        );
      }

      let filteredDescriptions = descriptions.data || [];

      // Apply date filtering if requested
      if (created_after || created_before) {
        filteredDescriptions = filteredDescriptions.filter(
          (description: any) => {
            const descriptionDate = new Date(
              description.created_at || description.added_at || 0,
            );

            if (created_after) {
              const afterDate = new Date(created_after + "T00:00:00.000Z");
              if (descriptionDate <= afterDate) return false;
            }

            if (created_before) {
              const beforeDate = new Date(created_before + "T23:59:59.999Z");
              if (descriptionDate >= beforeDate) return false;
            }

            return true;
          },
        );
      }

      // Apply pagination
      const paginatedDescriptions = filteredDescriptions.slice(
        offset,
        offset + limit,
      );

      // Extract only title and summary information
      const summaries = paginatedDescriptions.map((description: any) => ({
        title:
          description.data.title || description.data.filename || "Untitled",
        summary: description.data.summary || "No summary available",
        file_id: description.file_id,
      }));

      const result = {
        summaries,
        collection_type: collection.collection_type,
        pagination: {
          offset,
          limit,
          total: descriptions.total,
          has_more: offset + limit < filteredDescriptions.length,
        },
        collection_id,
        ...(created_after && { filtered_after: created_after }),
        ...(created_before && { filtered_before: created_before }),
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

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
    .max(10)
    .describe("Maximum number of transcripts to return per request (1-10) with pagination. Use smaller numbers for initial exploration, larger for comprehensive analysis.")
    .default(2),
  offset: z
    .number()
    .min(0)
    .describe("Number of transcripts to skip for pagination (e.g., offset=10, limit=10 gets transcripts 11-20). Use to page through large collections.")
    .default(0),
  created_after: z
    .string()
    .describe("Only include transcripts created after this date (YYYY-MM-DD format, e.g., '2024-01-15'). Useful for analyzing recent additions to a collection.")
    .optional(),
  created_before: z
    .string()
    .describe("Only include transcripts created before this date (YYYY-MM-DD format, e.g., '2024-01-15'). Useful for analyzing historical content.")
    .optional(),
};

export function registerRetrieveDescriptions(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "retrieve_descriptions",
    "Bulk retrieve rich multimodal descriptions (text, audio, and visual) from a collection with advanced filtering. Works with both rich-transcripts and media-descriptions collections. Use this for comprehensive analysis of multiple videos in a collection, when you need to compare descriptions, or analyze patterns across content. For single videos, use describe_video instead. Use date filtering to focus on specific time periods. Note: This tool is limited to 10 descriptions per request so pagination is required to get more than 10 descriptions. For targeted content discovery, consider using search_video_moments (for specific segments) or search_video_summaries (for relevant videos) instead of parsing through dense full descriptions. **Pagination guidance**: Due to the 10-item limit, pagination is essential for comprehensive analysis. Always check `has_more` and paginate through all descriptions when user intent requires exhaustive coverage. Use date filtering first to narrow scope, then paginate within filtered results.",
    schema,
    async ({ collection_id, limit, offset, created_after, created_before }) => {
      // First get the collection to determine its type
      const collection = await cgClient.collections.getCollection(collection_id);
      
      if (!collection || !collection.collection_type) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Collection not found or invalid collection ID",
                collection_id,
                descriptions: []
              }, null, 2),
            },
          ],
        };
      }

      if (collection.collection_type !== "rich-transcripts" && collection.collection_type !== "media-descriptions") {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `Collection type '${collection.collection_type}' is not supported. This tool works with rich-transcripts and media-descriptions collections only.`,
                collection_id,
                collection_type: collection.collection_type,
                descriptions: []
              }, null, 2),
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
          { limit: fetchLimit, offset: 0 }
        );
      } else {
        descriptions = await cgClient.collections.listMediaDescriptions(
          collection_id,
          { limit: fetchLimit, offset: 0 }
        );
      }
      
      let filteredDescriptions = descriptions.data || [];

      // Apply date filtering if requested
      if (created_after || created_before) {
        filteredDescriptions = filteredDescriptions.filter((description: any) => {
          // Assume description has created_at or similar date field
          const descriptionDate = new Date(description.created_at || description.added_at || 0);
          
          if (created_after) {
            const afterDate = new Date(created_after + 'T00:00:00.000Z');
            if (descriptionDate <= afterDate) return false;
          }
          
          if (created_before) {
            const beforeDate = new Date(created_before + 'T23:59:59.999Z');
            if (descriptionDate >= beforeDate) return false;
          }
          
          return true;
        });
      }

      // Apply pagination
      const paginatedDescriptions = filteredDescriptions.slice(offset, offset + limit);
      
      const result = {
        descriptions: paginatedDescriptions,
        collection_type: collection.collection_type,
        pagination: {
          offset,
          limit,
          total: descriptions.total,
          has_more: offset + limit < filteredDescriptions.length
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
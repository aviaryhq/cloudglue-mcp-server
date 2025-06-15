import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  collection_id: z
    .string()
    .describe(
      "Collection ID from list_collections without the 'cloudglue://collections/' prefix (e.g., use 'abc123' not 'cloudglue://collections/abc123'). Must be an entities type collection.",
    ),
  limit: z
    .number()
    .min(1)
    .max(10)
    .describe("Maximum number of entity records to return per request (1-10) with pagination. Use smaller numbers for initial exploration, larger for comprehensive analysis.")
    .default(5),
  offset: z
    .number()
    .min(0)
    .describe("Number of entity records to skip for pagination (e.g., offset=20, limit=20 gets entities 21-40). Use to page through large collections.")
    .default(0),
  created_after: z
    .string()
    .describe("Only include entities extracted after this date (YYYY-MM-DD format, e.g., '2024-01-15'). Useful for analyzing recent additions to a collection.")
    .optional(),
  created_before: z
    .string()
    .describe("Only include entities extracted before this date (YYYY-MM-DD format, e.g., '2024-01-15'). Useful for analyzing historical extractions.")
    .optional(),
};

export function registerRetrieveCollectionEntities(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "retrieve_collection_entities",
    "Batch retrieve structured entity data from multiple videos in a collection. Entities can be user-defined based on what's important for your collection (people, objects, concepts, custom categories). Perfect for data mining, building datasets, or analyzing previously extracted entities at scale. Supports pagination and date-based filtering to manage large result sets. For individual video entities, use get_video_entity instead. Note: This tool is limited to 10 entities per request so pagination is required to get more than 10 entities.",
    schema,
    async ({ collection_id, limit, offset, created_after, created_before }) => {
      // Get all entities first to apply our own filtering
      // Note: The API may not support date filtering natively, so we'll get more and filter
      const fetchLimit = Math.min(limit + offset + 50, 100); // Get extra for filtering
      
      const entities = await cgClient.collections.listEntities(
        collection_id,
        { limit: fetchLimit, offset: 0 }
      );
      
      let filteredEntities = entities.data || [];

      // Apply date filtering if requested
      if (created_after || created_before) {
        filteredEntities = filteredEntities.filter((entity: any) => {
          // Assume entity has created_at or similar date field
          const entityDate = new Date(entity.created_at || entity.added_at || 0);
          
          if (created_after) {
            const afterDate = new Date(created_after + 'T00:00:00.000Z');
            if (entityDate <= afterDate) return false;
          }
          
          if (created_before) {
            const beforeDate = new Date(created_before + 'T23:59:59.999Z');
            if (entityDate >= beforeDate) return false;
          }
          
          return true;
        });
      }

      // Apply pagination
      const paginatedEntities = filteredEntities.slice(offset, offset + limit);
      
      const result = {
        entities: paginatedEntities,
        pagination: {
          offset,
          limit,
          total_returned: paginatedEntities.length,
          total_filtered: filteredEntities.length,
          has_more: offset + limit < filteredEntities.length
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
import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  collection_id: z
    .string()
    .describe(
      "Collection ID from list_collections without the 'cloudglue://collections/' prefix (e.g., use 'abc123' not 'cloudglue://collections/abc123'). Must be a rich-transcripts type collection.",
    ),
  limit: z
    .number()
    .min(1)
    .max(50)
    .describe("Maximum number of transcripts to return per request (1-50). Use smaller numbers for initial exploration, larger for comprehensive analysis.")
    .default(10),
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

export function registerRetrieveCollectionTranscripts(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "retrieve_collection_transcripts",
    "Bulk retrieve rich multimodal transcripts (text, audio, and visual) from a collection with advanced filtering. Use this for comprehensive analysis of multiple videos in a collection, when you need to compare transcripts, or analyze patterns across content. For single videos, use get_video_description instead. Use date filtering to focus on specific time periods.",
    schema,
    async ({ collection_id, limit, offset, created_after, created_before }) => {
      // Get all transcripts first to apply our own filtering
      // Note: The API may not support date filtering natively, so we'll get more and filter
      const fetchLimit = Math.min(limit + offset + 50, 100); // Get extra for filtering
      
      const transcripts = await cgClient.collections.listRichTranscripts(
        collection_id,
        { limit: fetchLimit, offset: 0 }
      );
      
      let filteredTranscripts = transcripts.data || [];

      // Apply date filtering if requested
      if (created_after || created_before) {
        filteredTranscripts = filteredTranscripts.filter((transcript: any) => {
          // Assume transcript has created_at or similar date field
          const transcriptDate = new Date(transcript.created_at || transcript.added_at || 0);
          
          if (created_after) {
            const afterDate = new Date(created_after + 'T00:00:00.000Z');
            if (transcriptDate <= afterDate) return false;
          }
          
          if (created_before) {
            const beforeDate = new Date(created_before + 'T23:59:59.999Z');
            if (transcriptDate >= beforeDate) return false;
          }
          
          return true;
        });
      }

      // Apply pagination
      const paginatedTranscripts = filteredTranscripts.slice(offset, offset + limit);
      
      const result = {
        transcripts: paginatedTranscripts,
        pagination: {
          offset,
          limit,
          total_returned: paginatedTranscripts.length,
          total_filtered: filteredTranscripts.length,
          has_more: offset + limit < filteredTranscripts.length
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
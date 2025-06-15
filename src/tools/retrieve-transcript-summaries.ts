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
    .describe("Maximum number of summaries to return per request (1-50) with pagination. Use smaller numbers for initial exploration, larger for comprehensive collection overview.")
    .default(25),
  offset: z
    .number()
    .min(0)
    .describe("Number of summaries to skip for pagination (e.g., offset=25, limit=25 gets summaries 26-50). Use to page through large collections.")
    .default(0),
  created_after: z
    .string()
    .describe("Only include summaries created after this date (YYYY-MM-DD format, e.g., '2024-01-15'). Useful for analyzing recent additions to a collection.")
    .optional(),
  created_before: z
    .string()
    .describe("Only include summaries created before this date (YYYY-MM-DD format, e.g., '2024-01-15'). Useful for analyzing historical content.")
    .optional(),
};

export function registerRetrieveTranscriptSummaries(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "retrieve_transcript_summaries",
    "Bulk retrieve video summaries and titles from a collection to quickly understand its content and themes. Use this as your first step when analyzing a collection - it's more efficient than retrieving full transcripts and helps you determine if you need more detailed information. Perfect for getting a high-level overview of what's in a collection, identifying common topics, or determining if a collection contains relevant content for a specific query. Only proceed to retrieve_collection_transcripts if you need the full multimodal context for specific videos identified through the summaries. For single videos, use get_video_description instead. Returns up to 50 summaries per request with pagination support.",
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
      
      // Extract only title and summary information
      const summaries = paginatedTranscripts.map((transcript: any) => ({
        title: transcript.data.title || transcript.data.filename || 'Untitled',
        summary: transcript.data.summary || 'No summary available',
        file_id: transcript.file_id
      }));
      
      const result = {
        summaries,
        pagination: {
          offset,
          limit,
          total_returned: summaries.length,
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
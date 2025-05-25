import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  collection_id: z
    .string()
    .describe(
      "Collection ID from list_collections without the 'cloudglue://collections/' prefix (e.g., use 'abc123' not 'cloudglue://collections/abc123'). Works with both rich-transcripts and entities collections.",
    ),
  query: z
    .string()
    .describe(
      "Natural language search query to find relevant video moments. Examples: 'Find discussions about pricing strategies', 'Show me customer complaint segments', 'Locate product demo portions', 'Find mentions of specific competitors'. Be specific about what you're looking for.",
    ),
  max_results: z
    .number()
    .min(1)
    .max(20)
    .describe("Maximum number of relevant video moments to return (1-20). Start with 5-10 for focused results, increase for comprehensive searches.")
    .default(5),
};

export function registerFindVideoCollectionMoments(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "find_video_collection_moments",
    "AI-powered semantic search to find specific moments, topics, or content within a video collection. Returns relevant segments with context, timestamps, and citations. Perfect for finding needle-in-haystack content, specific discussions, or thematic analysis across multiple videos. Much more targeted than bulk retrieval tools.",
    schema,
    async ({ collection_id, query, max_results }) => {
      try {
        // Enhance the query to specifically ask for video moments and context
        const enhancedPrompt = `Find and describe the most relevant video moments/segments related to: "${query}". 

For each relevant moment, provide:
1. The specific video file ID or name if available
2. Timestamp or time range if available  
3. Brief description of what happens in that moment
4. Direct quote or summary of the content
5. Why this moment is relevant to the query

Limit to the top ${max_results} most relevant moments.`;

        const response = await cgClient.chat.createCompletion({
          model: "nimbus-001",
          messages: [
            {
              role: "user",
              content: enhancedPrompt,
            },
          ],
          collections: [collection_id],
          force_search: true,
          include_citations: true,
          max_tokens: 8000,
        });

        if (response.choices?.[0]?.message?.content) {
          const content = response.choices[0].message.content;
          const citations = response.choices[0].citations || [];

          // Format the response with both content and structured citations
          const result = {
            query: query,
            collection_id: collection_id,
            moments_found: content,
            citations: citations.map((citation: any) => ({
              file_id: citation.file_id || null,
              snippet: citation.snippet || null,
              timestamp: citation.timestamp || null,
              relevance_score: citation.score || null,
              metadata: citation.metadata || null
            })),
            total_citations: citations.length
          };

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                query: query,
                collection_id: collection_id,
                error: "No relevant moments found or empty response from AI",
                moments_found: null,
                citations: []
              }, null, 2),
            },
          ],
        };

      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                query: query,
                collection_id: collection_id,
                error: `Failed to search collection: ${error instanceof Error ? error.message : 'Unknown error'}`,
                moments_found: null,
                citations: []
              }, null, 2),
            },
          ],
        };
      }
    },
  );
} 
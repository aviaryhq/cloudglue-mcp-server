import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  url: z
    .string()
    .describe("Video URL to extract entities from. Supports multiple formats:\n\n• **Cloudglue platform (default)**: `cloudglue://files/file-id` - Use file ID from list_videos\n• **YouTube URLs**: `https://www.youtube.com/watch?v=...` or `https://youtu.be/...`\n• **Public HTTP video URLs**: Direct links to MP4 files (e.g., `https://example.com/video.mp4`)\n• **Data connector URLs** (requires setup in Cloudglue account):\n  - **Dropbox**: Shareable links (`https://www.dropbox.com/scl/fo/...`) or `dropbox://<path>/<to>/<file>`\n  - **Google Drive**: `gdrive://file/<file_id>`\n  - **Zoom**: Meeting UUID (`zoom://uuid/QFwZYEreTl2e6MBFSslXjQ%3D%3D`) or Meeting ID (`zoom://id/81586198865`)\n\nSee https://docs.cloudglue.dev/data-connectors/overview for data connector setup."),
  prompt: z
    .string()
    .describe("Detailed extraction prompt that guides what entities to find. Examples: 'Extract speaker names, key topics, and action items', 'Find product names, prices, and features mentioned', 'Identify companies, people, and technologies discussed'. Be specific about the data structure you want."),
  collection_id: z
    .string()
    .describe("Optional collection ID to check for existing entity extractions first (saves time and cost). Use collection ID from list_collections without 'cloudglue://collections/' prefix. Only works with Cloudglue URLs.")
    .optional(),
};

// Helper function to extract file ID from Cloudglue URL
function extractFileIdFromUrl(url: string): string | null {
  const match = url.match(/cloudglue:\/\/files\/(.+)/);
  return match ? match[1] : null;
}

export function registerExtractVideoEntities(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "extract_video_entities",
    "Extract structured data and entities from videos using custom prompts with intelligent cost optimization. Automatically checks for existing extractions before creating new ones. Use this for individual video analysis - for analyzing multiple videos in a collection, use retrieve_collection_entities instead. Supports YouTube URLs, Cloudglue URLs, and direct HTTP video URLs. The quality of results depends heavily on your prompt specificity.",
    schema,
    async ({ url, prompt, collection_id }) => {
      const fileId = extractFileIdFromUrl(url);

      // Step 1: Check if we have a collection_id and file_id, get from collection
      if (collection_id && fileId) {
        try {
          const entities = await cgClient.collections.getEntities(
            collection_id,
            fileId,
          );
          if (entities && Object.keys(entities).length > 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `Found existing entities in collection:\n\n${JSON.stringify(entities, null, 2)}`,
                },
              ],
            };
          }
        } catch (error) {
          // Continue to next step if collection lookup fails
        }
      }

      // Step 2: Check for existing individual extracts for this URL with matching prompt
      try {
        const existingExtracts = await cgClient.extract.listExtracts({ 
          limit: 1, 
          status: 'completed', 
          url: url 
        });
        
        if (existingExtracts.data && existingExtracts.data.length > 0) {
          const extract = existingExtracts.data[0];
          // Only reuse if the prompt matches
          if (extract.extract_config?.prompt === prompt) {
            const extraction = await cgClient.extract.getExtract(extract.job_id);
            return {
              content: [
                {
                  type: "text",
                  text: `Found existing entity extraction:\n\n${JSON.stringify(extraction.data, null, 2)}`,
                },
              ],
            };
          }
          // If prompt doesn't match, continue to create new extraction
        }
      } catch (error) {
        // Continue to create new extraction if listing fails
      }

      // Step 3: Create new entity extraction
      try {
        const extractJob = await cgClient.extract.createExtract(url, {
          prompt: prompt,
          enable_segment_level_entities: true,
          enable_video_level_entities: false,
        });

        // Wait for completion using SDK's waitForReady method
        const completedJob = await cgClient.extract.waitForReady(extractJob.job_id);

        if (completedJob.status === "completed" && completedJob.data) {
          return {
            content: [
              {
                type: "text",
                text: `New entity extraction created:\n\n${JSON.stringify(completedJob.data, null, 2)}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: "Error: Failed to create entity extraction - job did not complete successfully",
            },
          ],
        };

      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating entity extraction: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    },
  );
} 
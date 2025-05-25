import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  url: z
    .string()
    .describe("Video URL to extract entities from. Supports YouTube URLs (https://www.youtube.com/watch?v=...) or Cloudglue URLs (cloudglue://files/file-id). For Cloudglue URLs, use the file ID from list_videos."),
  prompt: z
    .string()
    .describe("Detailed extraction prompt that guides what entities to find. Examples: 'Extract speaker names, key topics, and action items', 'Find product names, prices, and features mentioned', 'Identify companies, people, and technologies discussed'. Be specific about the data structure you want."),
  collection_id: z
    .string()
    .describe("Optional collection ID to check for existing entity extractions first (saves time and cost). Use collection ID from list_collections without 'cloudglue://collections/' prefix. Only works with Cloudglue URLs.")
    .optional(),
  force_new: z
    .boolean()
    .describe("Force creation of a new entity extraction even if one already exists. Use when you need different extraction criteria or fresh analysis.")
    .default(false),
};

// Helper function to extract file ID from Cloudglue URL
function extractFileIdFromUrl(url: string): string | null {
  const match = url.match(/cloudglue:\/\/files\/(.+)/);
  return match ? match[1] : null;
}

export function registerGetVideoEntities(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "get_video_entities",
    "Extract structured data and entities from videos using custom prompts with intelligent cost optimization. Automatically checks for existing extractions before creating new ones. For individual videos - use retrieve_collection_entities for bulk collection analysis. The quality of results depends heavily on your prompt specificity.",
    schema,
    async ({ url, prompt, collection_id, force_new }) => {
      const fileId = extractFileIdFromUrl(url);

      // Step 1: Check if we have a collection_id and file_id, get from collection
      if (collection_id && fileId && !force_new) {
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

      // Step 2: Check for existing individual extracts for this URL
      if (!force_new) {
        try {
          const existingExtracts = await cgClient.extract.listExtracts({ 
            limit: 1, 
            status: 'completed', 
            url: url 
          });
          
          if (existingExtracts.data && existingExtracts.data.length > 0) {
            const extract = existingExtracts.data[0];
            return {
              content: [
                {
                  type: "text",
                  text: `Found existing entity extraction:\n\n${JSON.stringify(extract.data, null, 2)}`,
                },
              ],
            };
          }
        } catch (error) {
          // Continue to create new extraction if listing fails
        }
      }

      // Step 3: Create new entity extraction
      try {
        const extractJob = await cgClient.extract.createExtract(url, {
          prompt: prompt,
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
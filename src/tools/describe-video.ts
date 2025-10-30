import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  url: z
    .string()
    .describe("Video URL to describe. Supports multiple formats:\n\n• **Cloudglue platform (default)**: `cloudglue://files/file-id` - Use file ID from list_videos\n• **YouTube URLs**: `https://www.youtube.com/watch?v=...` or `https://youtu.be/...`\n• **Public HTTP video URLs**: Direct links to MP4 files (e.g., `https://example.com/video.mp4`)\n• **Data connector URLs** (requires setup in Cloudglue account):\n  - **Dropbox**: Shareable links (`https://www.dropbox.com/scl/fo/...`) or `dropbox://<path>/<to>/<file>`\n  - **Google Drive**: `gdrive://file/<file_id>`\n  - **Zoom**: Meeting UUID (`zoom://uuid/QFwZYEreTl2e6MBFSslXjQ%3D%3D`) or Meeting ID (`zoom://id/81586198865`)\n\nSee https://docs.cloudglue.dev/data-connectors/overview for data connector setup."),
  collection_id: z
    .string()
    .describe("Optional collection ID to check for existing descriptions first (saves time and cost). Use collection ID from list_collections without 'cloudglue://collections/' prefix. Only works with Cloudglue URLs.")
    .optional()
};

// Helper function to extract file ID from Cloudglue URL
function extractFileIdFromUrl(url: string): string | null {
  const match = url.match(/cloudglue:\/\/files\/(.+)/);
  return match ? match[1] : null;
}

export function registerDescribeVideo(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "describe_video",
    "Gets comprehensive video descriptions with intelligent cost optimization. Automatically checks for existing descriptions before creating new ones. Use this for individual video analysis - for analyzing multiple videos in a collection, use retrieve_collection_descriptions instead. Supports YouTube URLs, Cloudglue URLs, and direct HTTP video URLs with different analysis levels.",
    schema,
    async ({ url, collection_id }) => {
      const fileId = extractFileIdFromUrl(url);

      // Step 1: Check if we have a collection_id and file_id, get from collection
      if (collection_id && fileId) {
        try {
          const descriptions = await cgClient.collections.getMediaDescriptions(
            collection_id, fileId, {response_format: 'markdown'}
          );
          if (descriptions.content) {
            return {
              content: [
                {
                  type: "text",
                  text: descriptions.content,
                },
              ],
            };
          }
        } catch (error) {
          // Continue to next step if collection lookup fails
        }
      }

      // Step 2: Check for existing individual descriptions for this URL
      try {
        const existingDescriptions = await cgClient.describe.listDescribes({ 
          limit: 1, 
          status: 'completed', 
          url: url,
        });
        
        if (existingDescriptions.data && existingDescriptions.data.length > 0) {
          const describeJobId = existingDescriptions.data[0].job_id;
          const description = await cgClient.describe.getDescribe(describeJobId, {response_format: 'markdown'});
          return {
            content: [
              {
                type: "text",
                text: description.data?.content || '',
              },
            ],
          };
        }
      } catch (error) {
        // Continue to create new description if listing fails
      }

      // Step 3: Create new description
      try {
        const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
        const isCloudGlue = url.startsWith('cloudglue://');

        const describeOptions = {
          enable_summary: isYouTube, // only for youtube
          enable_speech: true,
          enable_scene_text: isCloudGlue, // Only enable for Cloudglue videos
          enable_visual_scene_description: isCloudGlue, // Only enable for Cloudglue videos
        };

        const describeJob = await cgClient.describe.createDescribe(url, describeOptions);

        // Wait for completion using SDK's waitForReady method
        const completedJob = await cgClient.describe.waitForReady(
          describeJob.job_id,
          {
            response_format: "markdown",
          },
        );

        if (completedJob.status === "completed") {
          return {
            content: [
              {
                type: "text",
                text: completedJob.data?.content || '',
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: "Error: Failed to create description - job did not complete successfully",
            },
          ],
        };

      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating description: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    },
  );
} 
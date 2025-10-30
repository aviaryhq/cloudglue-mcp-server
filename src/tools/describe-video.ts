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
    .optional(),
  page: z
    .number()
    .int()
    .min(0)
    .describe("Page number for paginated results. Each page contains 5 minutes of video content. Defaults to 0 (first page). Use this to retrieve descriptions for specific time segments of longer videos. Increase the page number to get the next 5-minute segment.")
    .optional()
    .default(0)
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
    "Gets comprehensive video descriptions with intelligent cost optimization and pagination support. Automatically checks for existing descriptions before creating new ones. Use this for individual video analysis - for analyzing multiple videos in a collection, use retrieve_collection_descriptions instead. Supports YouTube URLs, Cloudglue URLs, and direct HTTP video URLs with different analysis levels. Results are paginated in 5-minute segments - use the 'page' parameter to retrieve specific time segments of longer videos (page 0 = first 5 minutes, page 1 = next 5 minutes, etc.).",
    schema,
    async ({ url, collection_id, page = 0 }) => {
      const fileId = extractFileIdFromUrl(url);
      const PAGE_SIZE_SECONDS = 300; // 5 minutes in seconds

      // Helper function to format paginated response
      const formatPaginatedResponse = (
        descriptionContent: string,
        currentPage: number,
        totalPages: number
      ) => {
        const doc = {
          description: descriptionContent,
          page: currentPage,
          total_pages: totalPages,
        };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(doc, null, 2),
            },
          ],
        };
      };

      // Step 1: Check if we have a collection_id and file_id, get from collection
      // Note: Collection descriptions don't support pagination, so return full content if page is 0
      if (collection_id && fileId && page === 0) {
        try {
          const descriptions = await cgClient.collections.getMediaDescriptions(
            collection_id, fileId, {response_format: 'markdown'}
          );
          if (descriptions.content) {
            // For collection descriptions, we can't paginate, so return as page 0 with total_pages 1
            return formatPaginatedResponse(descriptions.content, 0, 1);
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
          const describeJob = existingDescriptions.data[0];
          const describeJobId = describeJob.job_id;
          const duration = describeJob.duration_seconds || 0;
          const totalPages = duration > 0 ? Math.ceil(duration / PAGE_SIZE_SECONDS) : 1;
          
          // If duration is not available, get full description and return it as page 0
          if (duration === 0) {
            const description = await cgClient.describe.getDescribe(describeJobId, {
              response_format: 'markdown',
            });
            return formatPaginatedResponse(
              description.data?.content || '',
              page === 0 ? 0 : page,
              totalPages
            );
          }
          
          // Calculate time range for the requested page
          const startTime = page * PAGE_SIZE_SECONDS;
          const endTime = Math.min((page + 1) * PAGE_SIZE_SECONDS, duration);
          
          // If page is beyond the video length, return empty description
          if (startTime >= duration) {
            return formatPaginatedResponse('', page, totalPages);
          }

          const description = await cgClient.describe.getDescribe(describeJobId, {
            response_format: 'markdown',
            start_time_seconds: startTime,
            end_time_seconds: endTime,
          });
          
          return formatPaginatedResponse(
            description.data?.content || '',
            page,
            totalPages
          );
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
          const duration = completedJob.duration_seconds || 0;
          const totalPages = duration > 0 ? Math.ceil(duration / PAGE_SIZE_SECONDS) : 1;
          
          // Calculate time range for the requested page
          const startTime = page * PAGE_SIZE_SECONDS;
          const endTime = Math.min((page + 1) * PAGE_SIZE_SECONDS, duration || Infinity);
          
          // If page is beyond the video length, return empty description
          if (startTime >= (duration || Infinity)) {
            return formatPaginatedResponse('', page, totalPages);
          }

          // Get paginated description for the requested page
          let descriptionContent = '';
          if (duration > 0) {
            const paginatedDescription = await cgClient.describe.getDescribe(
              completedJob.job_id,
              {
                response_format: 'markdown',
                start_time_seconds: startTime,
                end_time_seconds: endTime,
              }
            );
            descriptionContent = paginatedDescription.data?.content || '';
          } else {
            // Fallback to full content if duration is not available (only for page 0)
            if (page === 0) {
              descriptionContent = completedJob.data?.content || '';
            } else {
              descriptionContent = '';
            }
          }

          return formatPaginatedResponse(descriptionContent, page, totalPages);
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                description: "Error: Failed to create description - job did not complete successfully",
                page: page,
                total_pages: 0,
              }, null, 2),
            },
          ],
        };

      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                description: `Error creating description: ${error instanceof Error ? error.message : 'Unknown error'}`,
                page: page,
                total_pages: 0,
              }, null, 2),
            },
          ],
        };
      }
    },
  );
} 
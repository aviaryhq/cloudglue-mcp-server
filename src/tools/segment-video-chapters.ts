import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  url: z
    .string()
    .describe("Video URL to segment into chapters. Supports multiple formats:\n\n• **Cloudglue platform (default)**: `cloudglue://files/file-id` - Use file ID from list_videos\n• **YouTube URLs**: `https://www.youtube.com/watch?v=...` or `https://youtu.be/...`\n• **Public HTTP video URLs**: Direct links to MP4 files (e.g., `https://example.com/video.mp4`)\n• **Data connector URLs** (requires setup in Cloudglue account):\n  - **Dropbox**: Shareable links (`https://www.dropbox.com/scl/fo/...`) or `dropbox://<path>/<to>/<file>`\n  - **Google Drive**: `gdrive://file/<file_id>`\n  - **Zoom**: Meeting UUID (`zoom://uuid/QFwZYEreTl2e6MBFSslXjQ%3D%3D`) or Meeting ID (`zoom://id/81586198865`)\n\nSee https://docs.cloudglue.dev/data-connectors/overview for data connector setup."),
  prompt: z
    .string()
    .describe("Custom prompt to guide chapter detection. Describe what types of chapters or segments you want to identify. Examples: 'Identify main topics and transitions', 'Find scene changes and key moments', 'Segment by speaker changes and topics'. Leave empty to use default chapter detection.")
    .optional(),
};

// Helper function to format time in seconds to HH:MM:SS format
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

export function registerSegmentVideoChapters(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "segment_video_chapters",
    "Segment videos into chapters with intelligent cost optimization. Automatically checks for existing chapter segmentation jobs before creating new ones. Returns timestamps and descriptions for each chapter detected. Supports Cloudglue URLs and direct HTTP video URLs. Note: YouTube URLs are not supported for segmentation.",
    schema,
    async ({ url, prompt }) => {
      // Check if it's a YouTube URL (not supported)
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        return {
          content: [
            {
              type: "text",
              text: "Error: YouTube URLs are not supported for video segmentation. Please use Cloudglue URLs or direct HTTP video URLs instead.",
            },
          ],
        };
      }

      // Step 1: Check for existing narrative segmentation jobs for this URL
      try {
        const existingJobs = await cgClient.segments.listSegmentJobs({ 
          criteria: "narrative",
          url: url,
          status: "completed",
          limit: 1
        });
        
        if (existingJobs.data && existingJobs.data.length > 0) {
          const job = existingJobs.data[0];
          if (job.segments && job.segments.length > 0) {
            const chaptersText = job.segments.map((segment, index) => {
              const startTime = formatTime(segment.start_time);
              const description = segment.description || `Chapter ${index + 1}`;
              return `Chapter ${index + 1}: ${startTime} - ${description}`;
            }).join('\n');

            return {
              content: [
                {
                  type: "text",
                  text: `Found existing chapter segmentation:\n\n${chaptersText}\n\nTotal chapters: ${job.segments.length}`,
                },
              ],
            };
          }
        }
      } catch (error) {
        // Continue to create new job if listing fails
      }

      // Step 2: Create new narrative segmentation job
      try {
        const narrativeConfig: any = {};
        if (prompt) {
          narrativeConfig.prompt = prompt;
        }

        const segmentJob = await cgClient.segments.createSegmentJob({
          url: url,
          criteria: "narrative",
          narrative_config: narrativeConfig,
        });

        // Wait for completion using SDK's waitForReady method
        const completedJob = await cgClient.segments.waitForReady(segmentJob.job_id);

        if (completedJob.status === "completed" && completedJob.segments) {
          const chaptersText = completedJob.segments.map((segment, index) => {
            const startTime = formatTime(segment.start_time);
            const description = segment.description || `Chapter ${index + 1}`;
            return `Chapter ${index + 1}: ${startTime} - ${description}`;
          }).join('\n');

          return {
            content: [
              {
                type: "text",
                text: `New chapter segmentation created:\n\n${chaptersText}\n\nTotal chapters: ${completedJob.segments.length}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: "Error: Failed to create chapter segmentation - job did not complete successfully",
            },
          ],
        };

      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating chapter segmentation: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    },
  );
}

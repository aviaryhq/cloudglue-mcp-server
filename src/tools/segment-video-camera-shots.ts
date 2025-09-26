import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  url: z
    .string()
    .describe("Video URL to segment into camera shots. Supports Cloudglue URLs (cloudglue://files/file-id) or direct HTTP video URLs. For Cloudglue URLs, use the file ID from list_videos. Note: YouTube URLs are not supported for segmentation."),
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

export function registerSegmentVideoCameraShots(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "segment_video_camera_shots",
    "Segment videos into camera shots with intelligent cost optimization. Automatically checks for existing shot segmentation jobs before creating new ones. Returns timestamps and metadata for each camera shot detected. Supports Cloudglue URLs and direct HTTP video URLs. Note: YouTube URLs are not supported for segmentation.",
    schema,
    async ({ url }) => {
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

      // Step 1: Check for existing shot segmentation jobs for this URL
      try {
        const existingJobs = await cgClient.segments.listSegmentJobs({ 
          criteria: "shot",
          url: url,
          status: "completed",
          limit: 1
        });
        
        if (existingJobs.data && existingJobs.data.length > 0) {
          const job = existingJobs.data[0];
          if (job.segments && job.segments.length > 0) {
            const segmentsText = job.segments.map((segment, index) => {
              const startTime = formatTime(segment.start_time);
              const endTime = formatTime(segment.end_time);
              const duration = (segment.end_time - segment.start_time).toFixed(1);
              return `Shot ${index + 1}: ${startTime} - ${endTime} (${duration}s)`;
            }).join('\n');

            return {
              content: [
                {
                  type: "text",
                  text: `Found existing camera shot segmentation:\n\n${segmentsText}\n\nTotal shots: ${job.segments.length}`,
                },
              ],
            };
          }
        }
      } catch (error) {
        // Continue to create new job if listing fails
      }

      // Step 2: Create new shot segmentation job
      try {
        const segmentJob = await cgClient.segments.createSegmentJob({
          url: url,
          criteria: "shot",
        });

        // Wait for completion using SDK's waitForReady method
        const completedJob = await cgClient.segments.waitForReady(segmentJob.job_id);

        if (completedJob.status === "completed" && completedJob.segments) {
          const segmentsText = completedJob.segments.map((segment, index) => {
            const startTime = formatTime(segment.start_time);
            const endTime = formatTime(segment.end_time);
            const duration = (segment.end_time - segment.start_time).toFixed(1);
            return `Shot ${index + 1}: ${startTime} - ${endTime} (${duration}s)`;
          }).join('\n');

          return {
            content: [
              {
                type: "text",
                text: `New camera shot segmentation created:\n\n${segmentsText}\n\nTotal shots: ${completedJob.segments.length}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: "Error: Failed to create camera shot segmentation - job did not complete successfully",
            },
          ],
        };

      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating camera shot segmentation: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    },
  );
}

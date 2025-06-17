import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  url: z
    .string()
    .describe("Video URL to transcribe. Supports YouTube URLs (https://www.youtube.com/watch?v=...) or Cloudglue URLs (cloudglue://files/file-id). For Cloudglue URLs, use the file ID from list_videos."),
  collection_id: z
    .string()
    .describe("Optional collection ID to check for existing transcripts first (saves time and cost). Use collection ID from list_collections without 'cloudglue://collections/' prefix. Only works with Cloudglue URLs.")
    .optional(),
  force_new: z
    .boolean()
    .describe("Force creation of a new transcript even if one already exists. Use when you need fresh analysis or different settings.")
    .default(false)
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
    "Gets comprehensive video transcripts and descriptions with intelligent cost optimization. Automatically checks for existing transcripts before creating new ones. Use this for individual video analysis - for analyzing multiple videos in a collection, use retrieve_collection_transcripts instead. Supports both YouTube and Cloudglue videos with different analysis levels.",
    schema,
    async ({ url, collection_id, force_new }) => {
      const fileId = extractFileIdFromUrl(url);

      // Step 1: Check if we have a collection_id and file_id, get from collection
      if (collection_id && fileId && !force_new) {
        try {
          const transcripts = await cgClient.collections.getTranscripts(
            collection_id, fileId, undefined, undefined, 'markdown'
          );
          if (transcripts.content) {
            return {
              content: [
                {
                  type: "text",
                  text: `Found existing transcript in collection:\n\n${transcripts.content}`,
                },
              ],
            };
          }
        } catch (error) {
          // Continue to next step if collection lookup fails
        }
      }

      // Step 2: Check for existing individual transcripts for this URL
      if (!force_new) {
        try {
          const existingTranscripts = await cgClient.transcribe.listTranscribes({ 
            limit: 1, 
            status: 'completed', 
            url: url 
          });
          
          if (existingTranscripts.data && existingTranscripts.data.length > 0) {
            const transcript = existingTranscripts.data[0];
            return {
              content: [
                {
                  type: "text",
                  text: `Found existing transcript:\n\n${transcript.data?.content || JSON.stringify(transcript.data)}`,
                },
              ],
            };
          }
        } catch (error) {
          // Continue to create new transcript if listing fails
        }
      }

      // Step 3: Create new transcript
      try {
        const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
        const isCloudGlue = url.startsWith('cloudglue://');

        const transcribeConfig = {
          enable_summary: isYouTube, // only for youtube
          enable_speech: true,
          enable_scene_text: isCloudGlue, // Only enable for Cloudglue videos
          enable_visual_scene_description: isCloudGlue, // Only enable for Cloudglue videos
        };

        const transcribeJob = await cgClient.transcribe.createTranscribe(url, transcribeConfig);

        // Wait for completion using SDK's waitForReady method
        const completedJob = await cgClient.transcribe.waitForReady(
          transcribeJob.job_id,
          {
            response_format: "markdown",
          },
        );

        if (completedJob.status === "completed") {
          const content = completedJob.data?.content || JSON.stringify(completedJob.data);
          return {
            content: [
              {
                type: "text",
                text: `New transcript created:\n\n${content}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: "Error: Failed to create transcript - job did not complete successfully",
            },
          ],
        };

      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating transcript: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    },
  );
} 
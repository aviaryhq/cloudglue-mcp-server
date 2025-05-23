import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  url: z
    .string()
    .describe(
      "The fully qualified cloudglue url of the video to describe, e.g. cloudglue://files/file-id",
    ),
};

export function registerDescribeCloudglueVideo(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "transcribe_cloudglue_video",
    "Generates a comprehensive multimodal transcript for an individual CloudGlue video by URL. Analyzes visual content, speech, and on-screen text to create a detailed scene-by-scene description. Only use for videos not yet in collections - for collection videos, use get_collection_rich_transcripts instead.",
    schema,
    async ({ url }) => {
      const transcribeJob = await cgClient.transcribe.createTranscribe(url, {
        enable_summary: true,
        enable_speech: true,
        enable_scene_text: true,
        enable_visual_scene_description: true,
      });

      while (
        transcribeJob.status === "pending" ||
        transcribeJob.status === "processing"
      ) {
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const updatedJob = await cgClient.transcribe.getTranscribe(
          transcribeJob.job_id,
          {
            response_format: "markdown",
          },
        );
        if (updatedJob.status !== transcribeJob.status) {
          Object.assign(transcribeJob, updatedJob);
        }
      }

      if (transcribeJob.status === "completed") {
        if (transcribeJob.data?.content) {
          return {
            content: [
              {
                type: "text",
                text: transcribeJob.data.content,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(transcribeJob.data),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to describe video",
          },
        ],
      };
    },
  );
}

import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  url: z
    .string()
    .describe(
      "The url of the youtube video to describe, e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ),
};

export function registerDescribeYoutubeVideo(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "transcribe_youtube_video",
    "Returns detailed description of a youtube video. Don't use this tool if the video is already part of a collection; use get_collection_video_description instead. Note that YouTube videos are currently limited to speech and metadata level understanding, for fully fledge multimodal video understanding please upload a file instead to the CloudGlue Files API and use the describe_cloudglue_video tool.",
    schema,
    async ({ url }) => {
      const transcribeJob = await cgClient.transcribe.createTranscribe(url, {
        enable_summary: true,
        enable_speech: true,
        enable_scene_text: false,
        enable_visual_scene_description: false,
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

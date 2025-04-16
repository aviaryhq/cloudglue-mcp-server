import { z } from "zod";
import { CloudGlue } from "cloudglue-js";
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
    "describe_youtube_video",
    "Returns detailed description of a youtube video. Don't use this tool if it is already part of a collection, get the description from the collection instead using get-collection-video-description and file_id",
    schema,
    async ({ url }) => {
      const describeJob = await cgClient.describe.createDescribe(url, {
        enable_speech: true,
        enable_scene_text: true,
        enable_visual_scene_description: true,
      });

      while (
        describeJob.status === "pending" ||
        describeJob.status === "processing"
      ) {
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const updatedJob = await cgClient.describe.getDescribe(
          describeJob.job_id,
        );
        if (updatedJob.status !== describeJob.status) {
          Object.assign(describeJob, updatedJob);
        }
      }

      if (describeJob.status === "completed" && describeJob.data) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(describeJob.data),
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

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
    "describe_cloudglue_video",
    "Returns detailed description of a video uploaded to CloudGlue. Don't use this tool if the video is already part of a collection; use get_collection_video_description instead.",
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

import { z } from "zod";
import { CloudGlue } from "cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  url: z
    .string()
    .describe(
      "The url of the video to extract entities from, e.g. cloudglue://files/file-id",
    ),
  prompt: z
    .string()
    .describe(
      "A prompt to guide the entity extraction, e.g. 'Extract the restaurant name and specialty information from this video'",
    ),
};

export function registerExtractCloudglueVideoEntities(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "extract_cloudglue_video_entities",
    "Returns detailed entities extracted from a video uploaded to CloudGlue. Don't use this tool if it is already part of a collection, get the entities from the collection instead using get-collection-video-entities and file_id",
    schema,
    async ({ url, prompt }) => {
      const extractJob = await cgClient.extract.createExtract(url, {
        prompt: prompt,
      });

      while (
        extractJob.status === "pending" ||
        extractJob.status === "processing"
      ) {
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const updatedJob = await cgClient.extract.getExtract(extractJob.job_id);
        if (updatedJob.status !== extractJob.status) {
          Object.assign(extractJob, updatedJob);
        }
      }

      if (extractJob.status === "completed" && extractJob.data) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(extractJob.data),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to extract entities from video",
          },
        ],
      };
    },
  );
}

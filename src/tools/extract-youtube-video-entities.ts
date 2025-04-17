import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  url: z
    .string()
    .describe(
      "The url of the youtube video to extract entities from, e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ),
  prompt: z
    .string()
    .describe(
      "A prompt to guide the entity extraction, e.g. 'Extract the restaurant name and specialty information from this video'",
    ),
};

export function registerExtractYoutubeVideoEntities(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "extract_youtube_video_entities",
    "Returns detailed entities extracted from a youtube video. Don't use this tool if the video is already part of a collection; use get_collection_video_entities instead.  Note that YouTube videos are currently limited to speech and metadata level understanding, for fully fledge multimodal video understanding please upload a file instead to the CloudGlue Files API and use the extract_cloudglue_video_entities tool.",
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

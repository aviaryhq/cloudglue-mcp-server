import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  urls: z
    .array(z.string())
    .min(1)
    .max(50)
    .describe(
      "Array of YouTube video URLs to extract entities from, e.g. ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=abc123']. Maximum 50 URLs.",
    ),
  prompt: z
    .string()
    .describe(
      "A prompt to guide the entity extraction, e.g. 'Extract the restaurant name and specialty information from this video'",
    ),
};

// Helper function to process URLs in batches with concurrency control
async function processBatch<T>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<any>
): Promise<any[]> {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  
  return results;
}

export function registerExtractYoutubeVideoEntities(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "extract_youtube_video_entities",
    "Extracts structured data from YouTube videos (up to 50 URLs) based on your prompt. Limited to speech and metadata. For videos in entity collections, use get_collection_video_entities.",
    schema,
    async ({ urls, prompt }) => {
      const processVideo = async (url: string) => {
        try {
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
              url,
              status: "success",
              entities: extractJob.data,
            };
          }

          return {
            url,
            status: "error",
            entities: null,
            error: "Failed to extract entities from video",
          };
        } catch (error) {
          return {
            url,
            status: "error",
            entities: null,
            error: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      };

      // Process URLs in batches of 10 for concurrency control
      const results = await processBatch(urls, 10, processVideo);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    },
  );
}

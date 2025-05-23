import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  urls: z
    .array(z.string())
    .min(1)
    .max(50)
    .describe(
      "Array of YouTube video URLs to transcribe, e.g. ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=abc123']. Maximum 50 URLs.",
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

export function registerDescribeYoutubeVideo(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "transcribe_youtube_video",
    "Transcribes YouTube videos (up to 50 URLs at once). Limited to speech and metadata analysis only. For videos already in collections, use get_collection_rich_transcripts instead.",
    schema,
    async ({ urls }) => {
      const processVideo = async (url: string) => {
        try {
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
            return {
              url,
              status: "success",
              content: transcribeJob.data?.content || JSON.stringify(transcribeJob.data),
            };
          }

          return {
            url,
            status: "error",
            content: "Failed to transcribe video",
          };
        } catch (error) {
          return {
            url,
            status: "error",
            content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

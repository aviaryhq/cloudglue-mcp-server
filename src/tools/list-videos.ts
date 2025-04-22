import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  limit: z
    .number()
    .min(1)
    .max(100)
    .describe("The maximum number of videos to return")
    .default(10),
};

export function registerListVideos(server: McpServer, cgClient: CloudGlue) {
  server.tool(
    "list_videos",
    "Returns metadata about all individual videos that the user has access to, independent of collections",
    schema,
    async ({ limit }) => {
      const files = await cgClient.files.listFiles({ limit: limit });
      
      const filteredFiles = files.data
        .filter(file => file.status === "completed")
        .map(file => ({
          filename: file.filename,
          uri: file.uri,
          id: file.id,
          created_at: file.created_at,
          metadata: file.metadata,
          video_info: file.video_info ? {
            duration_seconds: file.video_info.duration_seconds,
            has_audio: file.video_info.has_audio
          } : null
        }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(filteredFiles),
          },
        ],
      };
    },
  );
}

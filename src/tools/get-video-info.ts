import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  file_id: z
    .string()
    .describe(
      "The file id without the 'cloudglue://files/' prefix (e.g., for 'cloudglue://files/abc123', use 'abc123')",
    ),
};

export function registerGetVideoInfo(server: McpServer, cgClient: CloudGlue) {
  server.tool(
    "get_video_info",
    "Returns information about a video given a cloudglue video url",
    schema,
    async ({ file_id }) => {
      const file = await cgClient.files.getFile(file_id);

      if (file.status !== "completed") {
        return {
          content: [
            {
              type: "text",
              text: `Unable to retrieve video: Video is in ${file.status} status`,
            },
          ],
          isError: true
        };
      }

      const videoInfo = {
        filename: file.filename,
        uri: file.uri,
        id: file.id,
        created_at: file.created_at,
        metadata: file.metadata,
        video_info: file.video_info ? {
          duration_seconds: file.video_info.duration_seconds,
          has_audio: file.video_info.has_audio
        } : null
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(videoInfo),
          },
        ],
      };
    },
  );
}

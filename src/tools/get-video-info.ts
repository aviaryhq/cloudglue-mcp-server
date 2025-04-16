import { z } from "zod";
import { CloudGlue } from "cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  file_id: z
    .string()
    .describe(
      "The file id of the video to get information about, e.g. cloudglue://files/<file_id>",
    ),
};

export function registerGetVideoInfo(server: McpServer, cgClient: CloudGlue) {
  server.tool(
    "get_video_info",
    "Returns information about a video given a cloudglue video url",
    schema,
    async ({ file_id }) => {
      const file = await cgClient.files.getFile(file_id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(file),
          },
        ],
      };
    },
  );
}

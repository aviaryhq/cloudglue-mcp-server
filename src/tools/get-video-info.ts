import { z } from "zod";
import { CloudGlue } from "cloudglue-js";
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

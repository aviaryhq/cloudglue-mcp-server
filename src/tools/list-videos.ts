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
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(files),
          },
        ],
      };
    },
  );
}

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
  url: z
    .string()
    .describe("The url of the video from which entities were extracted, either cloudglue or youtube urls")
    .optional(),
};

export function registerListExtracts(server: McpServer, cgClient: CloudGlue) {
  server.tool(
    "list_extracts",
    "Returns individual video entity extractions executed by user on independent of collections and optionally filtered by url",
    schema,
    async ({ limit, url }) => {
      const extractions = await cgClient.extract.listExtracts({ limit: limit, status: 'completed', url: url });
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(extractions),
          },
        ],
      };
    },
  );
}

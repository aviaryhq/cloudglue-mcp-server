import { z } from "zod";
import { CloudGlue } from "cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  collection_id: z
    .string()
    .describe(
      "The collection id of the video to return, e.g. cloudglue://collections/<collection_id>",
    ),
  file_id: z
    .string()
    .describe(
      "The file id of the video to return, e.g. cloudglue://files/<file_id>",
    ),
};

export function registerGetCollectionVideoEntities(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "get_collection_video_entities",
    "Returns detailed entities extracted from a video in a given collection",
    schema,
    async ({ collection_id, file_id }) => {
      const entities = await cgClient.collections.getEntities(
        collection_id,
        file_id,
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(entities),
          },
        ],
      };
    },
  );
}

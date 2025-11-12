import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  name: z
    .string()
    .describe(
      "Name of the collection to create. Must be unique within your account.",
    ),
  description: z
    .string()
    .describe(
      "Optional description of the collection's purpose or contents.",
    )
    .optional(),
};

export function registerCreateCollection(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "create_collection",
    "Create a new media-descriptions collection for organizing and processing videos. The collection will be configured to extract summaries, scene text, speech transcripts, and visual descriptions from videos. Use this to set up a collection before adding videos to it.",
    schema,
    async ({ name, description }) => {
      try {
        const collection = await cgClient.collections.createCollection({
          collection_type: "media-descriptions",
          name: name,
          description: description,
          describe_config: {
            enable_summary: true,
            enable_scene_text: true,
            enable_speech: true,
            enable_visual_scene_description: true,
          },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  id: collection.id,
                  name: collection.name,
                  collection_type: collection.collection_type,
                  created_at: collection.created_at,
                  description: collection.description ?? undefined,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error:
                    error instanceof Error
                      ? error.message
                      : "Unknown error occurred",
                },
                null,
                2,
              ),
            },
          ],
        };
      }
    },
  );
}


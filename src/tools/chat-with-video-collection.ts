import { z } from "zod";
import { CloudGlue } from "cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  collection_id: z
    .string()
    .describe(
      "The collection id of the videos to chat with, e.g. cloudglue://collections/<collection_id>",
    ),
  prompt: z
    .string()
    .describe(
      "A prompt to guide the chat completion, e.g. 'What is the restaurant name and specialty information from this video?'",
    ),
};

export function registerChatWithVideoCollection(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "chat_with_video_collection",
    "Returns a chat completion response from a video collection given a prompt",
    schema,
    async ({ collection_id, prompt }) => {
      const response = await cgClient.chat.createCompletion({
        model: "nimbus-001",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        collections: [collection_id],
        force_search: true,
        include_citations: true,
      });

      if (response.choices?.[0]?.message?.content) {
        return {
          content: [
            {
              type: "text",
              text: [
                "Chat completion response: ",
                response.choices[0].message.content,
                "\n\nCitations:",
                JSON.stringify(response.choices[0].citations),
              ].join("\n"),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to chat with video collection",
          },
        ],
      };
    },
  );
}

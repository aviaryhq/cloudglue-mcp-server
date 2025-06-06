import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  name: z
    .string()
    .describe("Name for the new collection. Should be descriptive and unique within your account."),
  collection_type: z
    .enum(["rich-transcripts", "entities"])
    .describe("Type of collection: 'rich-transcripts' for video transcript analysis or 'entities' for structured data extraction."),
  description: z
    .string()
    .describe("Optional description explaining the purpose and contents of this collection.")
    .optional(),
  // Entity collection specific parameters
  schema: z
    .string()
    .describe("JSON schema string defining the structure for entity extraction. Only used for 'entities' collections. Either schema or prompt must be provided for entity collections.")
    .optional(),
  prompt: z
    .string()
    .describe("Extraction prompt describing what entities to extract. Only used for 'entities' collections. Either schema or prompt must be provided for entity collections.")
    .optional(),
  // Rich transcript collection specific parameters
  enable_summary: z
    .boolean()
    .describe("Enable AI-generated summaries for videos in this rich-transcripts collection.")
    .default(true),
  enable_scene_text: z
    .boolean()
    .describe("Enable text detection from video frames for rich-transcripts collection.")
    .default(true),
  enable_visual_scene_description: z
    .boolean()
    .describe("Enable AI-generated visual scene descriptions for rich-transcripts collection.")
    .default(true),
  enable_speech: z
    .boolean()
    .describe("Enable speech-to-text transcription for rich-transcripts collection.")
    .default(true),
};

export function registerCreateCollection(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "create_collection",
    "Create a new Cloudglue collection for organizing videos with specific analysis configurations. Supports both rich-transcripts (comprehensive video analysis) and entities (structured data extraction) collection types. Each type has different configuration options for customizing the analysis pipeline.",
    schema,
    async ({ 
      name, 
      collection_type, 
      description, 
      schema: extractSchema, 
      prompt, 
      enable_summary, 
      enable_scene_text, 
      enable_visual_scene_description, 
      enable_speech 
    }) => {
      try {
        // Validation for entity collections
        if (collection_type === "entities") {
          if (!extractSchema && !prompt) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    error: "For 'entities' collections, either 'schema' or 'prompt' (or both) must be provided",
                    collection_type,
                    name,
                    provided_schema: !!extractSchema,
                    provided_prompt: !!prompt,
                  }, null, 2),
                },
              ],
            };
          }
        }

        // Build collection configuration based on type
        let collectionConfig: any = {
          name,
          collection_type,
          ...(description && { description }),
        };

        if (collection_type === "entities") {
          // Configure entity extraction
          const extractConfig: any = {};
          
          if (prompt) {
            extractConfig.prompt = prompt;
          }
          
          if (extractSchema) {
            try {
              // Validate that schema is valid JSON
              JSON.parse(extractSchema);
              extractConfig.schema = extractSchema;
            } catch (error) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      error: "Invalid JSON schema provided",
                      schema_error: error instanceof Error ? error.message : 'Unknown error',
                      provided_schema: extractSchema,
                    }, null, 2),
                  },
                ],
              };
            }
          }
          
          collectionConfig.extract_config = extractConfig;

        } else if (collection_type === "rich-transcripts") {
          // Configure rich transcript analysis
          collectionConfig.transcribe_config = {
            enable_summary,
            enable_scene_text,
            enable_visual_scene_description,
            enable_speech,
          };
        }

        // Create the collection
        const collection = await cgClient.collections.createCollection(collectionConfig);

        // Get full collection details for response
        const collectionDetails = await cgClient.collections.getCollection(collection.id);

                 const result = {
           operation: "collection_created",
           collection_id: collection.id,
           collection_metadata: collectionDetails,
         };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };

      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `Failed to create collection: ${error instanceof Error ? error.message : 'Unknown error'}`,
                collection_name: name,
                collection_type,
                description: description || null,
              }, null, 2),
            },
          ],
        };
      }
    },
  );
} 
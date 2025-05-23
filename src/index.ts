#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import * as dotenv from "dotenv";
import { parseArgs } from "node:util";

// Import tool registrations
import { registerListVideoCollections } from "./tools/list-video-collections.js";
import { registerGetVideoInfo } from "./tools/get-video-info.js";
import { registerListVideos } from "./tools/list-videos.js";
import { registerListCollectionVideos } from "./tools/list-collection-videos.js";
import { registerGetCollectionRichTranscripts } from "./tools/get-collection-rich-transcripts.js";
import { registerGetCollectionVideoEntities } from "./tools/get-collection-video-entities.js";
import { registerDescribeCloudglueVideo } from "./tools/transcribe-cloudglue-video.js";
import { registerDescribeYoutubeVideo } from "./tools/transcribe-youtube-video.js";
import { registerExtractCloudglueVideoEntities } from "./tools/extract-cloudglue-video-entities.js";
import { registerExtractYoutubeVideoEntities } from "./tools/extract-youtube-video-entities.js";
import { registerChatWithVideoCollection } from "./tools/chat-with-video-collection.js";
import { registerListTranscripts } from "./tools/list-transcripts.js";
import { registerListExtracts } from "./tools/list-extracts.js";
import { registerListCollectionEntities } from "./tools/list-collection-entities.js";
import { registerListCollectionRichTranscripts } from "./tools/list-collection-rich-transcripts.js";

// Parse command line arguments
const { values: args } = parseArgs({
  options: {
    "api-key": {
      type: "string",
    },
    "base-url": {
      type: "string",
    },
  },
});

// Load environment variables from .env file
dotenv.config();

const cgClient = new CloudGlue({
  apiKey: args["api-key"] || process.env.CLOUDGLUE_API_KEY,
  ...(args["base-url"] || process.env.CLOUDGLUE_BASE_URL ? {
    baseUrl: args["base-url"] || process.env.CLOUDGLUE_BASE_URL,
  } : {}),
});

// Create server instance
const server = new McpServer({
  name: "cloudglue-mcp-server",
  version: "0.0.9",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Register all tools
registerListVideoCollections(server, cgClient);
registerListCollectionEntities(server, cgClient);
registerListCollectionRichTranscripts(server, cgClient);
registerListVideos(server, cgClient);
registerGetVideoInfo(server, cgClient);
registerListCollectionVideos(server, cgClient);
registerGetCollectionRichTranscripts(server, cgClient);
registerGetCollectionVideoEntities(server, cgClient);
registerDescribeCloudglueVideo(server, cgClient);
registerDescribeYoutubeVideo(server, cgClient);
registerExtractCloudglueVideoEntities(server, cgClient);
registerExtractYoutubeVideoEntities(server, cgClient);
registerChatWithVideoCollection(server, cgClient);
registerListTranscripts(server, cgClient);
registerListExtracts(server, cgClient);


// Run server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CloudGlue MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

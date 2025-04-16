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
import { registerGetCollectionVideoDescription } from "./tools/get-collection-video-description.js";
import { registerGetCollectionVideoEntities } from "./tools/get-collection-video-entities.js";
import { registerDescribeCloudglueVideo } from "./tools/describe-cloudglue-video.js";
import { registerDescribeYoutubeVideo } from "./tools/describe-youtube-video.js";
import { registerExtractCloudglueVideoEntities } from "./tools/extract-cloudglue-video-entities.js";
import { registerExtractYoutubeVideoEntities } from "./tools/extract-youtube-video-entities.js";
import { registerChatWithVideoCollection } from "./tools/chat-with-video-collection.js";

// Parse command line arguments
const { values: args } = parseArgs({
  options: {
    "api-key": {
      type: "string",
    },
  },
});

// Load environment variables from .env file
dotenv.config();

const cgClient = new CloudGlue({
  apiKey: args["api-key"] || process.env.CLOUDGLUE_API_KEY,
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
registerGetVideoInfo(server, cgClient);
registerListVideos(server, cgClient);
registerListCollectionVideos(server, cgClient);
registerGetCollectionVideoDescription(server, cgClient);
registerGetCollectionVideoEntities(server, cgClient);
registerDescribeCloudglueVideo(server, cgClient);
registerDescribeYoutubeVideo(server, cgClient);
registerExtractCloudglueVideoEntities(server, cgClient);
registerExtractYoutubeVideoEntities(server, cgClient);
registerChatWithVideoCollection(server, cgClient);

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

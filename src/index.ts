#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import * as dotenv from "dotenv";
import { parseArgs } from "node:util";

// Import tool registrations
import { registerListCollections } from "./tools/list-collections.js";
import { registerListVideos } from "./tools/list-videos.js";
import { registerDescribeVideo } from "./tools/describe-video.js";
import { registerExtractVideoEntities } from "./tools/extract-video-entities.js";
import { registerRetrieveCollectionTranscripts } from "./tools/retrieve-collection-transcripts.js";
import { registerRetrieveCollectionEntities } from "./tools/retrieve-collection-entities.js";
import { registerFindVideoCollectionMoments } from "./tools/find-video-collection-moments.js";
import { registerGetVideoMetadata } from "./tools/get-video-metadata.js";
import { registerRetrieveTranscriptSummaries } from "./tools/retrieve-transcript-summaries.js";

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
  version: "0.1.2",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Register all tools
registerListCollections(server, cgClient);
registerListVideos(server, cgClient);
registerDescribeVideo(server, cgClient);
registerExtractVideoEntities(server, cgClient);
registerRetrieveCollectionTranscripts(server, cgClient);
registerRetrieveCollectionEntities(server, cgClient);
registerFindVideoCollectionMoments(server, cgClient);
registerGetVideoMetadata(server, cgClient);
registerRetrieveTranscriptSummaries(server, cgClient);

// Run server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Cloudglue MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

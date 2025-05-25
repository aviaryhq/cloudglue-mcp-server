# Cloudglue MCP Server

[![NPM Version](https://img.shields.io/npm/v/%40aviaryhq%2Fcloudglue-mcp-server)](https://www.npmjs.com/package/@aviaryhq/cloudglue-mcp-server) 
[![License](https://img.shields.io/badge/License-ELv2-blue.svg)](LICENSE.md)
![MCP](https://badge.mcpx.dev?status=on 'MCP Enabled')
[![Discord](https://img.shields.io/discord/1366541583272382536?logo=discord&label=Discord)](https://discord.gg/QD5KWFVner)

Connect Cloudglue to Cursor, Claude Desktop, and other AI assistants to unlock the power of video collection understanding. Cloudglue helps your videos into structured data ready for LLMs.

## 📖 Resources

- [Model Context Protocol](https://modelcontextprotocol.io/introduction)
- [Cloudglue API Docs](https://docs.cloudglue.dev)
- [Terms of Service](https://cloudglue.dev/terms)
- [Privacy Policy](https://cloudglue.dev/privacy)
- [Pricing](https://cloudglue.dev/pricing)

> By using the Cloudglue SDK and/or the MCP server, you agree to the [Cloudglue Terms of Service](https://cloudglue.dev/terms) and acknowledge our [Privacy Policy](https://cloudglue.dev/privacy).

## Setup

### 1. API Key

First, get a Cloudglue API Key from [cloudglue.dev](http://cloudglue.dev), this will be used to authenticate the MCP server with your Cloudglue account.

### 2. Configure MCP client

Next, configure your MCP client (e.g. Claude Desktop) to use this MCP server. Most MCP clients store the configuration as JSON, for `cloudglue-mcp-server` this would look like the following:

```json
{
  "mcpServers": {
    "cloudglue": {
      "command": "npx",
      "args": [
        "-y",
        "@aviaryhq/cloudglue-mcp-server@latest"
      ],
      "env": {
        "CLOUDGLUE_API_KEY": "<YOUR-API-KEY>"
        }
    }
  }
}
```

Replace `<YOUR-API-KEY>` with the API Key created in step 1. Alternatively instead of the environment variable you could pass in the API key to the server via the `--api-key` CLI flag.

## Local Development Setup

### 1. API Key

First, get a Cloudglue API Key from [cloudglue.dev](http://cloudglue.dev), this will be used to authenticate the MCP server with your CloudGglue account.

### 2. Install and build server locally

You can build this server locally via:

```bash
npm install
npm run build
```

### 3. Configure MCP client

Next, configure your MCP client (such as Cursor) to use this server. Most MCP clients store the configuration as JSON in the following format:

```json
{
  "mcpServers": {
      "cloudglue-mcp-server": {
          "command": "node",
          "args": [
              "/ABSOLUTE/PATH/TO/PARENT/FOLDER/cloudglue-mcp-server/build/index.js",
              "--api-key",
              "<YOUR-API-KEY>"
          ]
      }
  }
}
```


## Tools

The following Cloudglue tools are available to LLMs through this MCP server:

### **Discovery & Navigation**

- **`list_collections`**: Discover available video collections and their metadata. Use this first to understand what video collections exist, their types (transcripts vs entities), and get collection IDs needed for other tools.

- **`list_videos`**: Browse and search video metadata with advanced filtering by collection, date ranges, and pagination. Essential for finding specific videos and getting video IDs needed for other tools.

### **Individual Video Analysis**

- **`get_video_description`**: Get comprehensive transcripts and descriptions from individual videos (YouTube or Cloudglue upload) with intelligent cost optimization. Automatically checks for existing transcripts before creating new ones. Supports customizable summarization.

- **`get_video_entity`**: Extract structured data and entities from individual videos using custom prompts. Quality depends on prompt specificity. Examples: extract speakers, products, action items, or any structured information.

- **`get_video_metadata`**: Get technical video metadata including duration, resolution, file size, and processing information. Use for video specifications rather than content analysis.

### **Collection Analysis**

- **`retrieve_collection_transcripts`**: Bulk retrieve transcripts from entire collections with pagination and date filtering. Use for comprehensive analysis across multiple videos, comparing content, or finding patterns.

- **`retrieve_collection_entities`**: Bulk retrieve structured entity data from entire collections. Perfect for aggregating extracted information, analyzing trends, or comprehensive data analysis across videos.

- **`find_video_collection_moments`**: AI-powered semantic search to find specific moments, topics, or discussions within video collections. Returns relevant segments with context and timestamps. Perfect for "needle in haystack" searches.

### **When to Use Which Tool**

- **Start with** `list_collections` and `list_videos` to explore available content
- **For single videos**: Use `get_video_description` or `get_video_entity` 
- **For collections**: Use `retrieve_collection_*` for bulk analysis or `find_video_collection_moments` for targeted searches
- **For technical specs**: Use `get_video_metadata`

All tools include intelligent features like cost optimization, automatic fallbacks, and comprehensive error handling.

## Contact

* [Open an Issue](https://github.com/aviaryhq/cloudglue-mcp-server/issues/new)
* [Email](mailto:support@cloudglue.dev)

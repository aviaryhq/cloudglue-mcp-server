# Cloudglue MCP Server

[![NPM Version](https://img.shields.io/npm/v/%40aviaryhq%2Fcloudglue-mcp-server)](https://www.npmjs.com/package/@aviaryhq/cloudglue-mcp-server) 
[![License](https://img.shields.io/badge/License-ELv2-blue.svg)](LICENSE.md)
![MCP](https://badge.mcpx.dev?status=on 'MCP Enabled')
[![Discord](https://img.shields.io/discord/1366541583272382536?logo=discord&label=Discord)](https://discord.gg/QD5KWFVner)

Connect Cloudglue to Cursor, Claude Desktop, and other AI assistants to unlock the power of video collection understanding. Cloudglue helps turn your videos into structured data ready for LLMs.

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

Replace `<YOUR-API-KEY>` with the API Key created in step 1. 

### Optional Configuration

You can customize the server with additional CLI arguments:

- `--api-key`: Provide API key directly (alternative to environment variable)
- `--base-url`: Use custom Cloudglue API endpoint  
- `--working-dir`: Set working directory for local file uploads (defaults to home directory)

Example with custom working directory:
```json
{
  "mcpServers": {
    "cloudglue": {
      "command": "npx",
      "args": [
        "-y",
        "@aviaryhq/cloudglue-mcp-server@latest",
        "--working-dir",
        "/path/to/your/videos"
      ],
      "env": {
        "CLOUDGLUE_API_KEY": "<YOUR-API-KEY>"
        }
    }
  }
}
```

## Local Development Setup

### 1. API Key

First, get a Cloudglue API Key from [cloudglue.dev](http://cloudglue.dev), this will be used to authenticate the MCP server with your Cloudglue account.

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

### **File Management**

- **`add_file`**: Upload local files to Cloudglue or add existing Cloudglue files to collections. Supports two modes: 1) Upload new file with optional collection assignment, 2) Add existing file to collection. Returns comprehensive file metadata and collection status. Use working directory context for relative file paths. Supports videos, images, documents, and other file types with automatic MIME type detection.

### **Collection Management**

- **`create_collection`**: Create a new CloudGlue collection for organizing videos with specific analysis configurations. Supports both rich-transcripts (comprehensive video analysis) and entities (structured data extraction) collection types. Each type has different configuration options for customizing the analysis pipeline. Returns complete collection metadata upon successful creation.

### **Discovery & Navigation**

- **`list_collections`**: Discover available video collections and their basic metadata. Use this first to understand what video collections exist before using other collection-specific tools. Shows collection IDs needed for other tools, video counts, and collection types.

- **`list_videos`**: Browse and search video metadata with powerful filtering options. Use this to explore available videos, find specific content by date, or see what's in a collection. Returns essential video info like duration, filename, and IDs needed for other tools.

### **Individual Video Analysis**

- **`get_video_description`**: Get comprehensive transcripts and descriptions from individual videos (YouTube or Cloudglue upload) with intelligent cost optimization. Automatically checks for existing transcripts before creating new ones. Supports customizable summarization.

- **`get_video_entities`**: Extract structured data and entities from videos using custom prompts with intelligent cost optimization. Automatically checks for existing extractions before creating new ones. For individual videos - use retrieve_collection_entities for bulk collection analysis. The quality of results depends heavily on your prompt specificity.

- **`get_video_metadata`**: Get comprehensive technical metadata about a Cloudglue video file including duration, resolution, file size, processing status, and computed statistics. Use this when you need video specifications, file details, or processing information rather than content analysis. Different from content-focused tools like get_video_description.

### **Collection Analysis**

- **`retrieve_collection_transcripts`**: Bulk retrieve rich multimodal transcripts (text, audio, and visual) from a collection with advanced filtering. Use this for comprehensive analysis of multiple videos in a collection, when you need to compare transcripts, or analyze patterns across content. For single videos, use get_video_description instead. Use date filtering to focus on specific time periods.

- **`retrieve_collection_entities`**: Batch retrieve structured entity data from multiple videos in a collection. Entities can be user-defined based on what's important for your collection (people, objects, concepts, custom categories). Perfect for data mining, building datasets, or analyzing previously extracted entities at scale. Supports pagination and date-based filtering to manage large result sets. For individual video entities, use get_video_entities instead.

- **`find_video_collection_moments`**: AI-powered semantic search to find specific moments, topics, or content within a video collection. Returns relevant segments with context, timestamps, and citations. Perfect for finding needle-in-haystack content, specific discussions, or thematic analysis across multiple videos. Much more targeted than bulk retrieval tools.

### **When to Use Which Tool**

- **To create collections**: Use `create_collection` to set up new video collections with specific analysis configurations
- **To upload files**: Use `add_file` to upload local files or add existing files to collections
- **Start exploring**: Use `list_collections` and `list_videos` to explore available content
- **For single videos**: Use `get_video_description` or `get_video_entities` 
- **For collections**: Use `retrieve_collection_*` for bulk analysis or `find_video_collection_moments` for targeted searches
- **For technical specs**: Use `get_video_metadata`

All tools include intelligent features like cost optimization, automatic fallbacks, and comprehensive error handling.

### **Collection Types & Configuration**

#### Rich-Transcripts Collections
Perfect for comprehensive video analysis and content understanding:
- **`enable_summary`**: AI-generated video summaries 
- **`enable_scene_text`**: Extract text visible in video frames
- **`enable_visual_scene_description`**: AI descriptions of visual content
- **`enable_speech`**: Speech-to-text transcription

#### Entities Collections  
Ideal for structured data extraction and custom analysis:
- **`prompt`**: Natural language description of what entities to extract
- **`schema`**: JSON schema defining the exact structure of extracted data
- Must provide either `prompt` or `schema` (or both) for entity collections

## Contact

* [Open an Issue](https://github.com/aviaryhq/cloudglue-mcp-server/issues/new)
* [Email](mailto:support@cloudglue.dev)

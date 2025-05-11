# CloudGlue MCP Server

[![NPM Version](https://img.shields.io/npm/v/%40aviaryhq%2Fcloudglue-mcp-server)](https://www.npmjs.com/package/@aviaryhq/cloudglue-mcp-server) 
[![License](https://img.shields.io/badge/License-ELv2-blue.svg)](LICENSE.md)
![MCP](https://badge.mcpx.dev?status=on 'MCP Enabled')
[![Discord](https://img.shields.io/discord/1366541583272382536?logo=discord&label=Discord)](https://discord.gg/QD5KWFVner)

Connect CloudGlue to Cursor, Claude Desktop, and other AI assistants to unlock the power of video collection understanding. CloudGlue helps your videos into structured data ready for LLMs.

## 📖 Resources

- [Model Context Protocol](https://modelcontextprotocol.io/introduction)
- [CloudGlue API Docs](https://docs.cloudglue.dev)
- [Terms of Service](https://cloudglue.dev/terms)
- [Privacy Policy](https://cloudglue.dev/privacy)
- [Pricing](https://cloudglue.dev/pricing)

> By using the CloudGlue SDK and/or the MCP server, you agree to the [CloudGlue Terms of Service](https://cloudglue.dev/terms) and acknowledge our [Privacy Policy](https://cloudglue.dev/privacy).

## Setup

### 1. API Key

First, get a CloudGlue API Key from [cloudglue.dev](http://cloudglue.dev), this will be used to authenticate the MCP server with your CloudGlue account.

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

First, get a CloudGlue API Key from [cloudglue.dev](http://cloudglue.dev), this will be used to authenticate the MCP server with your CloudGlue account.

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

The following CloudGlue tools are available to the LLM:

**Chat with Videos**

- `chat_with_video_collection`: Returns a chat completion response from a video collection given a prompt, can be used to search for information in the video collection to quickly answer questions or find videos relevant to a query

**Describe and Extract Information from Videos**

- `describe_cloudglue_video`: Returns detailed description of a video uploaded to CloudGlue.
- `extract_cloudglue_video_entities`: Returns detailed entities extracted from a video uploaded to CloudGlue.
- `describe_youtube_video`: Returns detailed description of a YouTube video.
- `extract_youtube_video_entities`: Returns detailed entities extracted from a YouTube video.

**Manage Video Files, Collections and Generated Artifacts**

- `get_video_info`: Returns information about a video given a cloudglue video url
- `list_videos`: Returns metadata about videos that the user has access to
- `list_video_collections`: Returns metadata about video collections that the user has access to
- `list_collection_videos`: Returns metadata about videos in a given collection
- `get_collection_video_description`: Returns detailed description of a video in a given collection
- `get_collection_video_entities`: Returns detailed entities extracted from a video in a given collection

## Contact

* [Open an Issue](https://github.com/aviaryhq/cloudglue-mcp-server/issues/new)
* [Email](mailto:support@cloudglue.dev)

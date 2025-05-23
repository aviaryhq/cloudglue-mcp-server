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

The following Cloudglue tools are available to the LLM:

**Chat with Videos**

- `chat_with_video_collection`: Returns a chat completion response from a video collection given a prompt. Helpful for search and summarization use cases.

**Transcribe and Extract Information from Videos**

- `transcribe_cloudglue_video`: Returns rich multimodal video transcript of a video uploaded to Cloudglue.
- `transcribe_youtube_video`: Returns detailed descriptions of YouTube videos. Can process multiple videos in parallel (up to 50 URLs, max 10 concurrent).
- `extract_cloudglue_video_entities`: Returns detailed entities extracted from a video uploaded to Cloudglue.
- `extract_youtube_video_entities`: Returns detailed entities extracted from YouTube videos. Can process multiple videos in parallel using the same extraction prompt (up to 50 URLs, max 10 concurrent).

**Manage Video Files and Collections**

- `list_videos`: Returns metadata about all individual videos the user has access to, independent of collections.
- `get_video_info`: Returns information about a specific video.
- `list_video_collections`: Returns metadata about video collections that the user has access to.
- `list_collection_videos`: Returns metadata about videos in a given collection.

**Access Rich Transcripts and Entities**

- `get_collection_rich_transcripts`: Returns rich transcripts of a video in a given collection.
- `get_collection_video_entities`: Returns detailed entities extracted from a video in a given collection.
- `list_collection_entities`: Returns a list of entities extracted from all videos in a given collection.
- `list_collection_rich_transcripts`: Returns a list of rich transcripts from all videos in a given collection.

**List Individual Transcription and Extraction Jobs**

- `list_transcripts`: Returns individual video transcription jobs executed by user, independent of collections.
- `list_extracts`: Returns individual video entity extractions executed by user, independent of collections.

## Contact

* [Open an Issue](https://github.com/aviaryhq/cloudglue-mcp-server/issues/new)
* [Email](mailto:support@cloudglue.dev)

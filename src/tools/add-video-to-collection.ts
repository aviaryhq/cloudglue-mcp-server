import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  collection_id: z
    .string()
    .describe(
      "Collection ID where the video will be added. Use collection ID from list_collections.",
    ),
  url: z
    .string()
    .describe(
      "Video URL to add to the collection. Supports multiple formats:\n\n• **Cloudglue platform (default)**: `cloudglue://files/file-id` - Use file ID from list_videos\n• **Public HTTP video URLs**: Direct links to MP4 files (e.g., `https://example.com/video.mp4`)\n• **Data connector URLs** (requires setup in Cloudglue account):\n  - **Dropbox**: Shareable links (`https://www.dropbox.com/scl/fo/...`) or `dropbox://<path>/<to>/<file>`\n  - **Google Drive**: `gdrive://file/<file_id>`\n  - **Zoom**: Meeting UUID (`zoom://uuid/QFwZYEreTl2e6MBFSslXjQ%3D%3D`) or Meeting ID (`zoom://id/81586198865`)\n\nNote: YouTube URLs are not supported for adding videos to collections.\nSee https://docs.cloudglue.dev/data-connectors/overview for data connector setup.",
    ),
};

export function registerAddVideoToCollection(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "add_video_to_collection",
    "Add a video to an existing collection by URL. Supports Cloudglue URLs, public HTTP video URLs, and data connector URLs (Dropbox, Google Drive, Zoom). Note: YouTube URLs are not supported. The video will be processed according to the collection's configuration.",
    schema,
    async ({ collection_id, url }) => {
      // Helper function to format error response
      const formatErrorResponse = (error: string) => {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  collection_id: collection_id,
                  url: url,
                  error: error,
                },
                null,
                2,
              ),
            },
          ],
        };
      };

      // Check if it's a YouTube URL (not supported)
      if (url.includes("youtube.com") || url.includes("youtu.be")) {
        return formatErrorResponse(
          "YouTube URLs are not supported for adding videos to collections. Please use Cloudglue URLs, public HTTP video URLs, or data connector URLs instead.",
        );
      }

      try {
        const result = await cgClient.collections.addVideoByUrl({
          collectionId: collection_id,
          url: url,
          params: {},
        });

        // Wait for the video to be ready using SDK's waitForReady method
        const completedVideo = await cgClient.collections.waitForReady(
          collection_id,
          result.file_id,
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  collection_id: collection_id,
                  file_id: result.file_id,
                  url: url,
                  status: completedVideo.status,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return formatErrorResponse(
          error instanceof Error ? error.message : "Unknown error occurred",
        );
      }
    },
  );
}


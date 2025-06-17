import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const schema = {
  limit: z
    .number()
    .min(1)
    .max(100)
    .describe("Maximum number of videos to return (1-100). Use smaller limits for quick overviews.")
    .default(10),
  offset: z
    .number()
    .min(0)
    .describe("Number of videos to skip for pagination. Use with limit to page through large result sets (e.g., offset=10, limit=10 gets videos 11-20).")
    .default(0),
  collection_id: z
    .string()
    .describe("Filter to videos in a specific collection. Use the collection ID from list_collections (without the 'cloudglue://collections/' prefix). Leave empty to see all user videos.")
    .optional(),
  created_after: z
    .string()
    .describe("Only show videos created after this date. Format: YYYY-MM-DD (e.g., '2024-01-15'). Useful for finding recent content.")
    .optional(),
  created_before: z
    .string()
    .describe("Only show videos created before this date. Format: YYYY-MM-DD (e.g., '2024-01-15'). Useful for filtering to older content.")
    .optional(),
};

export function registerListVideos(server: McpServer, cgClient: CloudGlue) {
  server.tool(
    "list_videos",
    "Browse and search video metadata with powerful filtering options. Use this to explore available videos, find specific content by date, or see what's in a collection. Returns essential video info like duration, filename, and IDs needed for other tools. Use pagination to get more than 10 videos.",
    schema,
    async ({ limit, offset, collection_id, created_after, created_before }) => {
      let videos: any[] = [];

      if (collection_id) {
        // If collection_id is provided, get videos from that collection
        const collectionVideos = await cgClient.collections.listVideos(collection_id, {
          limit: limit + offset, // Get more to handle offset
        });

        // Get detailed info for each video and apply filtering
        const processedVideos = await Promise.all(
          collectionVideos.data
            .filter(video => video.status === "completed")
            .map(async (video) => {
              const fileInfo = await cgClient.files.getFile(video.file_id);
              
              return {
                filename: fileInfo.filename,
                uri: fileInfo.uri,
                id: fileInfo.id,
                created_at: fileInfo.created_at,
                metadata: fileInfo.metadata,
                video_info: fileInfo.video_info ? {
                  duration_seconds: fileInfo.video_info.duration_seconds,
                  has_audio: fileInfo.video_info.has_audio
                } : null,
                collection_id: video.collection_id,
                added_at: video.added_at,
              };
            })
        );

        videos = processedVideos;
      } else {
        // Get all individual videos
        const files = await cgClient.files.listFiles({ 
          limit: limit + offset, // Get more to handle offset
        });
        
        videos = files.data
          .filter(file => file.status === "completed")
          .map(file => ({
            filename: file.filename,
            uri: file.uri,
            id: file.id,
            created_at: file.created_at,
            metadata: file.metadata,
            video_info: file.video_info ? {
              duration_seconds: file.video_info.duration_seconds,
              has_audio: file.video_info.has_audio
            } : null
          }));
      }

      // Apply date filtering
      if (created_after || created_before) {
        videos = videos.filter(video => {
          const videoDate = new Date(video.created_at);
          
          if (created_after) {
            const afterDate = new Date(created_after + 'T00:00:00.000Z');
            if (videoDate <= afterDate) return false;
          }
          
          if (created_before) {
            const beforeDate = new Date(created_before + 'T23:59:59.999Z');
            if (videoDate >= beforeDate) return false;
          }
          
          return true;
        });
      }

      // Apply pagination
      const paginatedVideos = videos.slice(offset, offset + limit);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              videos: paginatedVideos,
              pagination: {
                offset,
                limit,
                total_returned: paginatedVideos.length,
                has_more: offset + limit < videos.length
              }
            }, null, 2),
          },
        ],
      };
    },
  );
}

import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Helper function to extract playlist ID from YouTube URL
function extractPlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([^&]+)/);
  return match ? match[1] : null;
}

// Helper function to resolve YouTube channel URL to actual channel ID
async function resolveChannelId(url: string): Promise<string> {
  // If it's already a direct channel ID URL, extract it
  const directChannelMatch = url.match(/\/channel\/([^/?]+)/);
  if (directChannelMatch) {
    return directChannelMatch[1];
  }
  
  // For other formats (@handle, /c/, /user/), we need to resolve to the actual channel ID
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch channel page: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Look for channel ID in various places in the HTML
    // Method 1: Look for canonical link
    const canonicalMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/([^"]+)"/);
    if (canonicalMatch) {
      return canonicalMatch[1];
    }
    
    // Method 2: Look for channel ID in meta property
    const metaMatch = html.match(/<meta property="og:url" content="https:\/\/www\.youtube\.com\/channel\/([^"]+)"/);
    if (metaMatch) {
      return metaMatch[1];
    }
    
    // Method 3: Look for channel ID in script tags
    const scriptMatch = html.match(/"channelId":"([^"]+)"/);
    if (scriptMatch) {
      return scriptMatch[1];
    }
    
    // Method 4: Look for external_id pattern (backup)
    const externalIdMatch = html.match(/"externalId":"([^"]+)"/);
    if (externalIdMatch) {
      return externalIdMatch[1];
    }
    
    throw new Error("Could not find channel ID in page source");
    
  } catch (error) {
    throw new Error(`Failed to resolve channel ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to extract video URLs from a YouTube playlist or channel
async function extractVideosFromSource(sourceUrl: string, limit: number, sourceType: 'playlist' | 'channel'): Promise<string[]> {
  let rssUrl: string;
  let sourceId: string | null;
  
  if (sourceType === 'playlist') {
    sourceId = extractPlaylistId(sourceUrl);
    if (!sourceId) {
      throw new Error("Invalid YouTube playlist URL");
    }
    rssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${sourceId}`;
  } else {
    sourceId = await resolveChannelId(sourceUrl);
    rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${sourceId}`;
  }

  try {
    const response = await fetch(rssUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${sourceType}: ${response.status} ${response.statusText}`);
    }

    const xmlText = await response.text();
    
    // Extract video IDs from RSS XML
    const videoIdMatches = xmlText.match(/<yt:videoId>([^<]+)<\/yt:videoId>/g);
    if (!videoIdMatches) {
      throw new Error(`No videos found in ${sourceType} or ${sourceType} is private`);
    }

    // Extract just the video IDs and convert to full URLs
    // Note: YouTube RSS feeds return at most 15 videos, ordered by most recent
    const videoIds = videoIdMatches
      .map(match => match.replace(/<\/?yt:videoId>/g, ''))
      .slice(0, limit); // Apply limit (max 15 from RSS)

    const videoUrls = videoIds.map(id => `https://www.youtube.com/watch?v=${id}`);
    
    return videoUrls;
  } catch (error) {
    throw new Error(`Failed to extract videos from ${sourceType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export const schema = {
  collection_id: z
    .string()
    .describe("Collection ID from list_collections without the 'cloudglue://collections/' prefix (e.g., use 'abc123' not 'cloudglue://collections/abc123')."),
  youtube_urls: z
    .array(z.string().url())
    .max(50)
    .describe("List of up to 50 YouTube video URLs to add to the collection. Use either this, playlist_url, or channel_url - not multiple.")
    .optional(),
  playlist_url: z
    .string()
    .url()
    .describe("YouTube playlist URL to add videos from. Use either this, youtube_urls, or channel_url - not multiple.")
    .optional(),
  channel_url: z
    .string()
    .url()
    .describe("YouTube channel URL to add recent videos from. Use either this, youtube_urls, or playlist_url - not multiple.")
    .optional(),
  limit: z
    .number()
    .min(1)
    .max(15)
    .describe("When using playlist_url or channel_url, limit to the most recent X videos (1-15). YouTube RSS feeds provide at most 15 recent videos. Defaults to 15.")
    .default(15),
};

export function registerAddYoutube(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "add_youtube",
    "Add YouTube videos to a Cloudglue collection with parallel processing. Supports individual video URLs (up to 50), playlist URLs, and channel URLs with automatic video extraction and channel ID resolution. Uses YouTube RSS feeds to extract up to 15 most recent videos from playlists/channels. Note: Only YouTube videos with available transcripts can be successfully processed by CloudGlue. Processes videos in batches of 5 for optimal performance and waits for all to complete before returning the updated collection video list.",
    schema,
    async ({ collection_id, youtube_urls, playlist_url, channel_url, limit }) => {
      try {
        // Validation: must provide exactly one source type
        const sourceCount = [youtube_urls, playlist_url, channel_url].filter(Boolean).length;
        
        if (sourceCount === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "Must provide either youtube_urls, playlist_url, or channel_url",
                  collection_id,
                  provided_youtube_urls: !!youtube_urls,
                  provided_playlist_url: !!playlist_url,
                  provided_channel_url: !!channel_url,
                }, null, 2),
              },
            ],
          };
        }

        if (sourceCount > 1) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "Cannot provide multiple source types - choose one: youtube_urls, playlist_url, or channel_url",
                  collection_id,
                  youtube_urls_count: youtube_urls?.length || 0,
                  playlist_url: playlist_url || null,
                  channel_url: channel_url || null,
                }, null, 2),
              },
            ],
          };
        }

        // Determine which URLs to process
        let urlsToProcess: string[] = [];
        let extractionInfo: any = null;
        
        if (youtube_urls) {
          urlsToProcess = youtube_urls;
        } else if (playlist_url) {
          // Extract individual video URLs from the playlist
          try {
            urlsToProcess = await extractVideosFromSource(playlist_url, limit, 'playlist');
            extractionInfo = {
              source_type: 'playlist',
              source_url: playlist_url,
              limit,
              videos_extracted: urlsToProcess.length,
              extraction_successful: true,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    error: `Failed to extract videos from playlist: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    playlist_url,
                    limit,
                    collection_id,
                  }, null, 2),
                },
              ],
            };
          }
        } else if (channel_url) {
          // Extract individual video URLs from the channel
          try {
            urlsToProcess = await extractVideosFromSource(channel_url, limit, 'channel');
            extractionInfo = {
              source_type: 'channel',
              source_url: channel_url,
              limit,
              videos_extracted: urlsToProcess.length,
              extraction_successful: true,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    error: `Failed to extract videos from channel: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    channel_url,
                    limit,
                    collection_id,
                  }, null, 2),
                },
              ],
            };
          }
        }

        // Process videos in batches of 5
        const batchSize = 5;
        const allAddResults: Array<{ url: string; result: any; error?: string }> = [];
        
        for (let i = 0; i < urlsToProcess.length; i += batchSize) {
          const batch = urlsToProcess.slice(i, i + batchSize);
          
          // Process current batch in parallel
          const batchPromises = batch.map(async (url) => {
            try {
              const addResult = await cgClient.collections.addYouTubeVideo(collection_id, url);
              return { url, result: addResult };
            } catch (error) {
              return { 
                url, 
                result: null, 
                error: error instanceof Error ? error.message : 'Unknown error' 
              };
            }
          });

          const batchResults = await Promise.all(batchPromises);
          allAddResults.push(...batchResults);
        }

        // Wait for all successful additions to complete processing
        const waitPromises = allAddResults
          .filter(item => item.result && !item.error)
          .map(async (item) => {
            try {
              await cgClient.collections.waitForReady(collection_id, item.result.file_id);
              return { url: item.url, status: 'completed' };
            } catch (error) {
              return { 
                url: item.url, 
                status: 'failed', 
                error: error instanceof Error ? error.message : 'Unknown error' 
              };
            }
          });

        const waitResults = await Promise.all(waitPromises);

        // Get updated collection video list
        const collectionVideos = await cgClient.collections.listVideos(collection_id, {
          limit: 100, // Get a comprehensive list
        });

        // Get detailed info for each video
        const videoDetails = await Promise.all(
          collectionVideos.data
            .filter(video => video.status === "completed")
            .map(async (video) => {
              try {
                const fileInfo = await cgClient.files.getFile(video.file_id);
                return {
                  filename: fileInfo.filename,
                  uri: fileInfo.uri,
                  id: fileInfo.id,
                  created_at: fileInfo.created_at,
                  video_info: fileInfo.video_info ? {
                    duration_seconds: fileInfo.video_info.duration_seconds,
                    has_audio: fileInfo.video_info.has_audio
                  } : null,
                  collection_id: video.collection_id,
                  added_at: video.added_at,
                  status: video.status,
                };
              } catch (error) {
                return {
                  file_id: video.file_id,
                  collection_id: video.collection_id,
                  added_at: video.added_at,
                  status: video.status,
                  error: `Failed to get file details: ${error instanceof Error ? error.message : 'Unknown error'}`
                };
              }
            })
        );

        const result = {
          operation: "youtube_videos_added",
          collection_id,
          processing_summary: {
            total_urls_requested: urlsToProcess.length,
            successful_additions: allAddResults.filter(r => r.result && !r.error).length,
            failed_additions: allAddResults.filter(r => r.error).length,
            completed_processing: waitResults.filter(r => r.status === 'completed').length,
            failed_processing: waitResults.filter(r => r.status === 'failed').length,
          },
          addition_results: allAddResults,
          processing_results: waitResults,
          collection_videos: {
            total_videos: videoDetails.length,
            videos: videoDetails,
          },
          input_parameters: {
            used_youtube_urls: !!youtube_urls,
            used_playlist_url: !!playlist_url,
            used_channel_url: !!channel_url,
            limit: (playlist_url || channel_url) ? limit : null,
          },
          ...(extractionInfo && {
            source_extraction: extractionInfo
          })
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
                error: `Failed to add YouTube videos: ${error instanceof Error ? error.message : 'Unknown error'}`,
                collection_id,
                youtube_urls_count: youtube_urls?.length || 0,
                playlist_url: playlist_url || null,
                channel_url: channel_url || null,
                limit: (playlist_url || channel_url) ? limit : null,
              }, null, 2),
            },
          ],
        };
      }
    },
  );
} 
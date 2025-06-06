import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fs from "fs";
import * as path from "path";
import { Blob } from "node:buffer";

// Declare File constructor type for TypeScript
declare const File: {
  prototype: File;
  new(fileBits: BlobPart[], filename: string, options?: FilePropertyBag): File;
};

export const schema = {
  local_file_path: z
    .string()
    .describe("Path to local file to upload. Can be absolute or relative to working directory. Required if file_id is not provided.")
    .optional(),
  file_id: z
    .string()
    .describe("Existing CloudGlue file ID to add to collection. Use this instead of local_file_path to add already uploaded files. Required if local_file_path is not provided.")
    .optional(),
  collection_id: z
    .string()
    .describe("Optional collection ID to add the file to after upload/processing. Use collection ID from list_collections without 'cloudglue://collections/' prefix.")
    .optional(),
};

// Helper function to format file size
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// Helper function to detect MIME type
function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

export function registerAddFile(
  server: McpServer,
  cgClient: CloudGlue,
  workingDir: string,
) {
  server.tool(
    "add_file",
    "Upload local files to CloudGlue or add existing CloudGlue files to collections. Supports two modes: 1) Upload new file with optional collection assignment, 2) Add existing file to collection. Returns comprehensive file metadata and collection status. Use working directory context for relative file paths.",
    schema,
    async ({ local_file_path, file_id, collection_id }) => {
      // Validation: must provide either local_file_path or file_id
      if (!local_file_path && !file_id) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Must provide either local_file_path or file_id",
                local_file_path: null,
                file_id: null,
                collection_id: collection_id || null,
              }, null, 2),
            },
          ],
        };
      }

      if (local_file_path && file_id) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Cannot provide both local_file_path and file_id - choose one",
                local_file_path,
                file_id,
                collection_id: collection_id || null,
              }, null, 2),
            },
          ],
        };
      }

      let finalFileId: string;
      let fileUri: string;
      let uploadedFile: any = null;

      try {
        // Mode 1: Upload local file
        if (local_file_path) {
          // Resolve file path (absolute or relative to working directory)
          const resolvedPath = path.isAbsolute(local_file_path) 
            ? local_file_path 
            : path.join(workingDir, local_file_path);

          // Validate file exists and check permissions
                     try {
             await fs.promises.access(resolvedPath, fs.constants.R_OK);
           } catch (error) {
             const nodeError = error as NodeJS.ErrnoException;
             if (nodeError.code === 'ENOENT') {
               // Get directory listing to help user
               let availableFiles: string[] = [];
               let totalFileCount = 0;
               try {
                 const dirEntries = await fs.promises.readdir(workingDir, { withFileTypes: true });
                 const allFiles = dirEntries
                   .filter(entry => entry.isFile() && entry.name.includes('.'))
                   .map(entry => entry.name);
                 
                 totalFileCount = allFiles.length;
                 availableFiles = allFiles.slice(0, 50); // First 50 files
               } catch {
                 // If we can't read directory, continue with empty list
               }

               return {
                 content: [
                   {
                     type: "text",
                     text: JSON.stringify({
                       error: `File not found: ${resolvedPath}`,
                       resolved_path: resolvedPath,
                       working_dir: workingDir,
                       original_path: local_file_path,
                       directory_info: {
                         total_files_with_extensions: totalFileCount,
                         first_50_files: availableFiles,
                         showing_count: Math.min(50, totalFileCount)
                       }
                     }, null, 2),
                   },
                 ],
               };
             } else {
               return {
                 content: [
                   {
                     type: "text",
                     text: JSON.stringify({
                       error: `Permission denied: Cannot read file ${resolvedPath}`,
                       resolved_path: resolvedPath,
                       working_dir: workingDir,
                       original_path: local_file_path,
                     }, null, 2),
                   },
                 ],
               };
             }
           }

          // Get file stats
          const fileStats = await fs.promises.stat(resolvedPath);
          
          // Validate it's a file
          if (!fileStats.isFile()) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    error: `Not a file: ${resolvedPath}`,
                    resolved_path: resolvedPath,
                    working_dir: workingDir,
                    original_path: local_file_path,
                  }, null, 2),
                },
              ],
            };
          }

          const fileName = path.basename(resolvedPath);
          const fileBuffer = await fs.promises.readFile(resolvedPath);
          const mimeType = getMimeType(fileName);
          
          // Create File object
          const file = new File(
            [fileBuffer],
            fileName,
            { type: mimeType }
          );

          // Upload file
          const uploadResult = await cgClient.files.uploadFile({
            file,
            metadata: {
              source: 'mcp_local_upload',
              original_path: resolvedPath,
              working_dir: workingDir,
              mime_type: mimeType,
              file_size: fileStats.size,
              file_size_formatted: formatFileSize(fileStats.size),
            }
          });

          if (!uploadResult.data || typeof uploadResult.data !== 'object' || !('id' in uploadResult.data)) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    error: "Unexpected upload response format",
                    upload_result: uploadResult,
                  }, null, 2),
                },
              ],
            };
          }

          const uploadData = uploadResult.data as { id: string; uri: string; status: string };
          finalFileId = uploadData.id;
          fileUri = uploadData.uri;

          // Wait for file processing
          uploadedFile = await cgClient.files.waitForReady(finalFileId);

        } else {
          // Mode 2: Use existing file ID
          finalFileId = file_id!;
          
          // Get existing file details
          uploadedFile = await cgClient.files.getFile(finalFileId);
          fileUri = uploadedFile.uri;
        }

        // Add to collection if specified
        let collectionResult = null;
        if (collection_id) {
          const addVideoResult = await cgClient.collections.addVideo(collection_id, finalFileId);
          
          // Wait for collection processing
          await cgClient.collections.waitForReady(collection_id, addVideoResult.file_id);
          
          // Get collection video details
          collectionResult = await cgClient.collections.getVideo(collection_id, addVideoResult.file_id);
        }

        // Format comprehensive response similar to get_video_metadata
        const result = {
          operation: local_file_path ? 'file_uploaded_and_processed' : 'existing_file_processed',
          file_uri: fileUri,
          file_id: finalFileId,
          file_metadata: {
            filename: uploadedFile.filename,
            uri: uploadedFile.uri,
            status: uploadedFile.status,
            created_at: uploadedFile.created_at,
            updated_at: uploadedFile.updated_at,
            file_size: uploadedFile.file_size || null,
            mime_type: uploadedFile.mime_type || null,
            metadata: uploadedFile.metadata || {},
            video_info: uploadedFile.video_info ? {
              duration_seconds: uploadedFile.video_info.duration_seconds,
              duration_formatted: uploadedFile.video_info.duration_seconds ? 
                `${Math.floor(uploadedFile.video_info.duration_seconds / 60)}:${(uploadedFile.video_info.duration_seconds % 60).toFixed(0).padStart(2, '0')}` : null,
              has_audio: uploadedFile.video_info.has_audio,
              width: uploadedFile.video_info.width || null,
              height: uploadedFile.video_info.height || null,
              fps: uploadedFile.video_info.fps || null,
              bitrate: uploadedFile.video_info.bitrate || null,
              codec: uploadedFile.video_info.codec || null,
            } : null,
            processing_info: {
              upload_completed_at: uploadedFile.upload_completed_at || null,
              processing_started_at: uploadedFile.processing_started_at || null,
              processing_completed_at: uploadedFile.processing_completed_at || null,
            },
          },
          collection_info: collectionResult ? {
            collection_id,
            added_at: collectionResult.added_at,
            status: collectionResult.status,
          } : null,
          ...(local_file_path && {
            upload_info: {
              original_path: local_file_path,
              resolved_path: path.isAbsolute(local_file_path) ? local_file_path : path.join(workingDir, local_file_path),
              working_dir: workingDir,
            }
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
                error: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                local_file_path: local_file_path || null,
                file_id: file_id || null,
                collection_id: collection_id || null,
                working_dir: workingDir,
              }, null, 2),
            },
          ],
        };
      }
    },
  );
} 
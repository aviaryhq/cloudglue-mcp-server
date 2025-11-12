import { z } from "zod";
import { CloudGlue } from "@aviaryhq/cloudglue-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fs from "node:fs";
import * as path from "node:path";

// Helper function to get MIME type from file extension
function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
  };

  return mimeTypes[ext] || "video/mp4";
}

export const schema = {
  collection_id: z
    .string()
    .describe(
      "Collection ID where the uploaded video will be added. Use collection ID from list_collections.",
    ),
  file_path: z
    .string()
    .describe(
      "Absolute path to the local video file to upload. The file must exist and be readable. Supported formats: MP4, MOV, AVI, MKV, WebM.",
    ),
};

export function registerUploadFileToCollection(
  server: McpServer,
  cgClient: CloudGlue,
) {
  server.tool(
    "upload_file_to_collection",
    "Upload a local video file to Cloudglue and add it to a collection. The file is first uploaded to your Cloudglue account, then automatically added to the specified collection. Requires an absolute file path to the video file on your local system.",
    schema,
    async ({ collection_id, file_path }) => {
      // Helper function to format error response
      const formatErrorResponse = (error: string) => {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  collection_id: collection_id,
                  file_path: file_path,
                  error: error,
                },
                null,
                2,
              ),
            },
          ],
        };
      };

      // Validate file exists and check permissions
      try {
        await fs.promises.access(file_path, fs.constants.R_OK);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return formatErrorResponse(`File not found: ${file_path}`);
        } else {
          return formatErrorResponse(
            `Permission denied: Cannot read file ${file_path}. Please check file permissions.`,
          );
        }
      }

      // Get file stats
      let fileStats: fs.Stats;
      try {
        fileStats = await fs.promises.stat(file_path);
      } catch (error) {
        return formatErrorResponse(
          `Failed to get file stats: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      // Validate it's a file
      if (!fileStats.isFile()) {
        return formatErrorResponse(`Not a file: ${file_path}`);
      }

      const fileName = path.basename(file_path);

      // Read file and convert to File object
      let fileBuffer: Buffer;
      try {
        fileBuffer = await fs.promises.readFile(file_path);
      } catch (error) {
        return formatErrorResponse(
          `Failed to read file: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      const mimeType = getMimeType(fileName);

      // Create File object - convert Buffer to ArrayBuffer for File constructor
      const arrayBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength,
      );
      if (arrayBuffer instanceof SharedArrayBuffer) {
        return formatErrorResponse(
          "SharedArrayBuffer is not supported for file uploads",
        );
      }
      const file = new File([arrayBuffer], fileName, { type: mimeType });

      // Upload file
      let uploadedFile;
      try {
        uploadedFile = await cgClient.files.uploadFile({
          file: file,
          metadata: {
            source: "local_upload",
            original_path: file_path,
            mime_type: mimeType,
          },
        });
      } catch (error) {
        return formatErrorResponse(
          `Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      const fileId = uploadedFile.data.id;

      // Wait for file upload to be ready using SDK's waitForReady method
      try {
        await cgClient.files.waitForReady(fileId);
      } catch (error) {
        return formatErrorResponse(
          `File uploaded but processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      // Add uploaded file to collection
      try {
        await cgClient.collections.addVideo(collection_id, fileId, {});
      } catch (error) {
        return formatErrorResponse(
          `File uploaded successfully but failed to add to collection: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      // Wait for the video in collection to be ready using SDK's waitForReady method
      let completedVideo;
      try {
        completedVideo = await cgClient.collections.waitForReady(
          collection_id,
          fileId,
        );
      } catch (error) {
        return formatErrorResponse(
          `File added to collection but processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                collection_id: collection_id,
                file_id: fileId,
                filename: fileName,
                status: completedVideo.status,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}


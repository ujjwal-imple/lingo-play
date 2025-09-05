import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import googleCloudService from "../services/googleCloudService";
import { VideoUploadResponse } from "../types";

/*
 * For this scope we avoid DB complexity and keep video metadata in
 * memory. This layer can later be replaced with a repository without changing
 * the controller contract.
 */
const videoStore = new Map<string, any>();

export const uploadVideo = async (req: Request, res: Response) => {
  try {
    if (!req.files || !req.files.video) {
      return res.status(400).json({
        success: false,
        message: "No video file provided",
      });
    }

    const videoFile = Array.isArray(req.files.video)
      ? req.files.video[0]
      : req.files.video;

    // Only accept video MIME types to avoid invalid processing pipelines
    if (!videoFile.mimetype.startsWith("video/")) {
      return res.status(400).json({
        success: false,
        message: "File must be a video",
      });
    }

    // Use UUID per upload to avoid collisions and to group derived assets
    const videoId = uuidv4();
    const fileExtension = videoFile.name.split(".").pop();
    const filename = `videos/${videoId}.${fileExtension}`;

    console.log(`Uploading video: ${videoFile.name} (${videoFile.size} bytes)`);

    // Store raw upload in GCS so downstream steps can fetch it directly
    const uploadUrl = await googleCloudService.uploadFile(videoFile, filename);

    /*
     * Keep the original upload reference so we can extract audio with
     * FFmpeg immediately, without re-downloading from GCS, improving latency.
     */
    const videoMetadata = {
      videoId,
      originalName: videoFile.name,
      filename,
      uploadUrl,
      size: videoFile.size,
      mimeType: videoFile.mimetype,
      uploadTime: new Date(),
      status: "uploaded",
      originalFile: videoFile, // Store original file for audio extraction
    };

    videoStore.set(videoId, videoMetadata);

    const response: VideoUploadResponse = {
      success: true,
      videoId,
      filename: videoFile.name,
      uploadUrl,
      message: "Video uploaded successfully",
    };

    console.log(`Video uploaded successfully: ${videoId}`);
    return res.json(response);
  } catch (error) {
    console.error("Error uploading video:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload video",
      error:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
    });
  }
};

export const getVideoStatus = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;

    const videoMetadata = videoStore.get(videoId);
    if (!videoMetadata) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    return res.json({
      success: true,
      data: videoMetadata,
    });
  } catch (error) {
    console.error("Error getting video status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get video status",
      error:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
    });
  }
};

// Export video store for use in other controllers
export { videoStore };

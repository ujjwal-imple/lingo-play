import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import googleCloudService from "../services/googleCloudService";
import { VideoUploadResponse } from "../types";

// In-memory storage for video metadata (since no DB required)
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

    // Validate file type
    if (!videoFile.mimetype.startsWith("video/")) {
      return res.status(400).json({
        success: false,
        message: "File must be a video",
      });
    }

    // Generate unique video ID and filename
    const videoId = uuidv4();
    const fileExtension = videoFile.name.split(".").pop();
    const filename = `videos/${videoId}.${fileExtension}`;

    console.log(`Uploading video: ${videoFile.name} (${videoFile.size} bytes)`);

    // Upload to Google Cloud Storage
    const uploadUrl = await googleCloudService.uploadFile(videoFile, filename);

    // Store metadata including original file for audio extraction
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

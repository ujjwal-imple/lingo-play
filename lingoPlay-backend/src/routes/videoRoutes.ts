import express from "express";
import { uploadVideo, getVideoStatus } from "../controllers/videoController";

const router = express.Router();

/**
 * POST /api/video/upload
 * Upload a video file to Google Cloud Storage
 */
router.post("/upload", uploadVideo);

/**
 * GET /api/video/:videoId/status
 * Get video upload status and metadata
 */
router.get("/:videoId/status", getVideoStatus);

export default router;

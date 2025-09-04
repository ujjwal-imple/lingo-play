import express from "express";
import {
  startTranscription,
  getTranscription,
} from "../controllers/transcriptionController";

const router = express.Router();

/**
 * POST /api/transcription/start
 * Start transcription process for a video
 */
router.post("/start", startTranscription);

/**
 * GET /api/transcription/:videoId
 * Get transcription results and summary
 */
router.get("/:videoId", getTranscription);

export default router;

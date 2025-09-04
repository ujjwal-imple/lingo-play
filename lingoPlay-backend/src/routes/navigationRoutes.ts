import express from "express";
import {
  navigateToTimestamp,
  navigateToPhrase,
} from "../controllers/navigationController";

const router = express.Router();

/**
 * POST /api/navigation/timestamp
 * Navigate to specific timestamp in video
 */
router.post("/timestamp", navigateToTimestamp);

/**
 * POST /api/navigation/phrase
 * Find phrase in transcription and return timestamp
 */
router.post("/phrase", navigateToPhrase);

export default router;

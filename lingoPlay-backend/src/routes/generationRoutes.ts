import express from "express";
import {
  generateVideo,
  getGenerationStatus,
} from "../controllers/generationController";

const router = express.Router();

/**
 * POST /api/generation/create
 * Generate video from text with persona
 */
router.post("/create", generateVideo);

/**
 * GET /api/generation/:generationId/status
 * Get video generation status and result
 */
router.get("/:generationId/status", getGenerationStatus);

export default router;

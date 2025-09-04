import { Request, Response } from "express";
import { NavigationResponse } from "../types";
import { transcriptionStore } from "./transcriptionController";

// Text normalization utilities for robust matching
const normalizeText = (input: string): string => {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9\s]+/g, " ") // punctuation -> space
    .replace(/\s+/g, " ")
    .trim();
};

const tokenize = (input: string): string[] => {
  const n = normalizeText(input);
  return n ? n.split(" ") : [];
};

export const navigateToTimestamp = async (req: Request, res: Response) => {
  try {
    const { timestamp } = req.body;

    if (typeof timestamp !== "number" || timestamp < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid timestamp in seconds is required",
      });
    }

    const response: NavigationResponse = {
      success: true,
      timestamp,
      message: `Navigate to ${timestamp} seconds`,
    };

    return res.json(response);
  } catch (error) {
    console.error("Error navigating to timestamp:", error);
    return res.status(500).json({
      success: false,
      timestamp: 0,
      message: "Failed to navigate to timestamp",
      error:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
    });
  }
};

export const navigateToPhrase = async (req: Request, res: Response) => {
  try {
    const { videoId, phrase } = req.body;

    if (!videoId || !phrase) {
      return res.status(400).json({
        success: false,
        timestamp: 0,
        message: "Video ID and phrase are required",
      });
    }

    const transcriptionData = transcriptionStore.get(videoId);
    if (!transcriptionData) {
      return res.status(404).json({
        success: false,
        timestamp: 0,
        message: "No transcription found for this video",
      });
    }

    // Build robust tokens from phrase
    const tokens = tokenize(phrase);
    if (!tokens.length) {
      return res.status(400).json({
        success: false,
        timestamp: 0,
        message: "Please provide a non-empty phrase",
      });
    }

    // Flatten all words with timings across segments for cross-segment matching
    type FlatWord = {
      text: string;
      normalized: string;
      startTime: number;
      endTime: number;
    };

    const flattened: FlatWord[] = [];

    for (const seg of transcriptionData.segments) {
      const hasWordTimings = Array.isArray(seg.words) && seg.words.length > 0;
      if (hasWordTimings) {
        for (const w of seg.words) {
          const orig = (w.text || "").trim();
          const normalized = normalizeText(orig);
          if (!normalized) continue;
          flattened.push({
            text: orig,
            normalized,
            startTime:
              typeof w.startTime === "number" ? w.startTime : seg.startTime,
            endTime: typeof w.endTime === "number" ? w.endTime : seg.endTime,
          });
        }
      } else {
        // Fallback: synthesize pseudo word-timings by distributing over segment duration
        const segTokens = tokenize(seg.text || "");
        const count = Math.max(1, segTokens.length);
        const duration = Math.max(
          0.001,
          (seg.endTime || seg.startTime) - seg.startTime
        );
        for (let i = 0; i < count; i++) {
          const normalized = segTokens[i];
          if (!normalized) continue;
          const t0 = seg.startTime + (i / count) * duration;
          const t1 = seg.startTime + ((i + 1) / count) * duration;
          flattened.push({
            text: normalized,
            normalized,
            startTime: t0,
            endTime: t1,
          });
        }
      }
    }

    // Try exact token sequence match with a small time-gap tolerance across words
    const maxGapSeconds = 1.5;
    let matchTimestamp: number | null = null;
    let matchedText = "";

    if (flattened.length >= tokens.length) {
      outer: for (let i = 0; i <= flattened.length - tokens.length; i++) {
        if (flattened[i].normalized !== tokens[0]) continue;
        let ok = true;
        for (let j = 1; j < tokens.length; j++) {
          const prev = flattened[i + j - 1];
          const curr = flattened[i + j];
          if (!curr || curr.normalized !== tokens[j]) {
            ok = false;
            break;
          }
          const gap = Math.max(0, curr.startTime - prev.endTime);
          if (gap > maxGapSeconds) {
            ok = false;
            break;
          }
        }
        if (ok) {
          matchTimestamp = flattened[i].startTime;
          matchedText = flattened
            .slice(i, i + tokens.length)
            .map((w) => w.text)
            .join(" ");
          break outer;
        }
      }
    }

    // Fallback: segment-level normalized substring match with approximate timestamp
    if (matchTimestamp === null) {
      const searchNorm = normalizeText(phrase);
      for (const seg of transcriptionData.segments) {
        const segNorm = normalizeText(seg.text || "");
        const idx = segNorm.indexOf(searchNorm);
        if (idx >= 0) {
          const approx = (() => {
            if (!seg.text || seg.endTime <= seg.startTime) return seg.startTime;
            const segLen = segNorm.length || 1;
            const ratio = Math.min(1, Math.max(0, idx / segLen));
            return seg.startTime + ratio * (seg.endTime - seg.startTime);
          })();
          matchTimestamp = approx;
          matchedText = phrase;
          break;
        }
      }
    }

    if (matchTimestamp === null) {
      return res.status(404).json({
        success: false,
        timestamp: 0,
        message: `Phrase "${phrase}" not found in transcription`,
      });
    }

    const response: NavigationResponse = {
      success: true,
      timestamp: matchTimestamp,
      message: `Found "${phrase}" at ${matchTimestamp.toFixed(1)} seconds`,
      matchedText: matchedText || undefined,
    };

    console.log(
      `Phrase search: "${phrase}" found at ${matchTimestamp.toFixed(
        3
      )}s in video ${videoId}`
    );
    return res.json(response);
  } catch (error) {
    console.error("Error navigating to phrase:", error);
    return res.status(500).json({
      success: false,
      timestamp: 0,
      message: "Failed to search for phrase",
      error:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
    });
  }
};

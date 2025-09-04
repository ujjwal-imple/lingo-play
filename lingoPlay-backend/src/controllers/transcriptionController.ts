import { Request, Response } from "express";
import googleCloudService from "../services/googleCloudService";
import {
  TranscriptionResponse,
  TranscriptionSegment,
  WebSocketMessage,
  WordTiming,
} from "../types";
import { videoStore } from "./videoController";
import { wsConnections } from "../server";
import vertexAiService from "../services/vertexAiService";

// In-memory storage for transcription data
const transcriptionStore = new Map<string, any>();

// Broadcast message to all WebSocket clients
const broadcastMessage = (message: WebSocketMessage) => {
  const messageStr = JSON.stringify(message);
  wsConnections.forEach((ws) => {
    if (ws.readyState === 1) {
      // WebSocket.OPEN
      ws.send(messageStr);
    }
  });
};

// Simple text summarization (in production, use a proper AI service)
const generateSummary = (text: string): string => {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  if (sentences.length <= 3) {
    return text;
  }

  // Simple extractive summarization - take first, middle, and last sentences
  const summary =
    [
      sentences[0],
      sentences[Math.floor(sentences.length / 2)],
      sentences[sentences.length - 1],
    ].join(". ") + ".";

  return summary;
};

export const startTranscription = async (req: Request, res: Response) => {
  try {
    const { videoId, language = "en-US" } = req.body;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: "Video ID is required",
      });
    }

    const videoMetadata = videoStore.get(videoId);
    if (!videoMetadata) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    // Check if transcription already exists
    if (transcriptionStore.has(videoId)) {
      return res.json({
        success: true,
        message: "Transcription already exists",
        data: transcriptionStore.get(videoId),
      });
    }

    console.log(`Starting transcription for video: ${videoId}`);

    // Send initial progress update
    broadcastMessage({
      type: "transcription_progress",
      data: { videoId, progress: 0, message: "Starting transcription..." },
      timestamp: new Date().toISOString(),
    });

    // Start transcription process asynchronously
    processTranscription(videoId, videoMetadata.uploadUrl, language);

    return res.json({
      success: true,
      message: "Transcription started",
      videoId,
    });
  } catch (error) {
    console.error("Error starting transcription:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start transcription",
      error:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
    });
  }
};

const processTranscription = async (
  videoId: string,
  uploadUrl: string,
  language: string
) => {
  try {
    // Progress update: 10% - Starting audio extraction
    broadcastMessage({
      type: "transcription_progress",
      data: {
        videoId,
        progress: 10,
        message: "Extracting audio from video...",
      },
      timestamp: new Date().toISOString(),
    });

    // Get video metadata to access the original file
    const videoMetadata = videoStore.get(videoId);
    if (!videoMetadata || !videoMetadata.originalFile) {
      throw new Error("Video file not found for audio extraction");
    }

    // Extract audio from video file
    const audioUrl = await googleCloudService.extractAudioFromVideo(
      videoMetadata.originalFile,
      videoMetadata.filename
    );

    // Progress update: 40% - Audio extracted, starting transcription
    broadcastMessage({
      type: "transcription_progress",
      data: {
        videoId,
        progress: 40,
        message: "Audio extracted, starting transcription...",
      },
      timestamp: new Date().toISOString(),
    });

    // Start transcription with audio URL
    const transcriptionResult = await googleCloudService.transcribeAudio(
      audioUrl
    );

    // Progress update: 75%
    broadcastMessage({
      type: "transcription_progress",
      data: { videoId, progress: 75, message: "Generating summary..." },
      timestamp: new Date().toISOString(),
    });

    // Process transcription results
    const segments: (TranscriptionSegment & { words?: WordTiming[] })[] = [];
    let fullText = "";

    if (transcriptionResult.results) {
      for (const result of transcriptionResult.results) {
        if (result.alternatives && result.alternatives[0]) {
          const alternative = result.alternatives[0];

          // Extract text
          const text = alternative.transcript;
          fullText += text + " ";

          // Extract timing information
          let startTime = 0;
          let endTime = 0;
          const words: WordTiming[] = [];

          if (alternative.words && alternative.words.length > 0) {
            const firstWord = alternative.words[0];
            const lastWord = alternative.words[alternative.words.length - 1];

            if (firstWord.startTime) {
              startTime =
                parseFloat(firstWord.startTime.seconds || "0") +
                (firstWord.startTime.nanos || 0) / 1000000000;
            }

            if (lastWord.endTime) {
              endTime =
                parseFloat(lastWord.endTime.seconds || "0") +
                (lastWord.endTime.nanos || 0) / 1000000000;
            }

            // Collect word-level timings
            for (const w of alternative.words) {
              const wStart =
                parseFloat(w.startTime?.seconds || "0") +
                (w.startTime?.nanos || 0) / 1000000000;
              const wEnd =
                parseFloat(w.endTime?.seconds || "0") +
                (w.endTime?.nanos || 0) / 1000000000;
              words.push({
                text: (w.word || "").trim(),
                startTime: wStart,
                endTime: wEnd,
              });
            }
          }

          segments.push({
            text: text.trim(),
            startTime,
            endTime,
            confidence: alternative.confidence || 0.9,
            words: words.length ? words : undefined,
          });
        }
      }
    }

    // Generate summary (Vertex AI with heuristic fallback)
    let summary = "";
    try {
      summary = await vertexAiService.summarizeText(fullText.trim());
    } catch (aiError) {
      console.warn("Vertex AI summarization failed, using fallback:", aiError);
      summary = generateSummary(fullText.trim());
    }

    // Store transcription data
    const transcriptionData = {
      videoId,
      segments,
      fullText: fullText.trim(),
      summary,
      language,
      createdAt: new Date(),
    };

    transcriptionStore.set(videoId, transcriptionData);

    // Progress update: 100% - Complete
    broadcastMessage({
      type: "transcription_complete",
      data: {
        videoId,
        progress: 100,
        message: "Transcription completed successfully",
        transcription: transcriptionData,
      },
      timestamp: new Date().toISOString(),
    });

    console.log(`Transcription completed for video: ${videoId}`);
  } catch (error) {
    console.error("Error processing transcription:", error);

    broadcastMessage({
      type: "error",
      data: {
        videoId,
        message: "Transcription failed",
        error: error instanceof Error ? error.message : String(error),
      },
      timestamp: new Date().toISOString(),
    });
  }
};

export const getTranscription = async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;

    const transcriptionData = transcriptionStore.get(videoId);

    console.log("Transcription data:", transcriptionData);

    if (!transcriptionData) {
      return res.status(404).json({
        success: false,
        message: "Transcription not found",
      });
    }

    const response: TranscriptionResponse = {
      success: true,
      videoId,
      transcription: transcriptionData.segments,
      fullText: transcriptionData.fullText,
      summary: transcriptionData.summary,
      message: "Transcription retrieved successfully",
    };

    return res.json(response);
  } catch (error) {
    console.error("Error getting transcription:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get transcription",
      error:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
    });
  }
};

// Export transcription store for use in other controllers
export { transcriptionStore };

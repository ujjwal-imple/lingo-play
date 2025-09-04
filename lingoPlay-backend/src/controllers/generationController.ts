import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import googleCloudService from "../services/googleCloudService";
import { VideoGenerationResponse, WebSocketMessage } from "../types";
import { wsConnections } from "../server";

// In-memory storage for generation tasks
const generationStore = new Map<string, any>();

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

// Voice configuration mapping
type VoiceKey =
  | "professional-male"
  | "professional-female"
  | "casual-male"
  | "casual-female"
  | "energetic-male"
  | "energetic-female";

const getVoiceConfig = (persona: any) => {
  const voiceMap: Record<
    VoiceKey,
    { name: string; gender: string; speed: number; pitch: number }
  > = {
    "professional-male": {
      name: "en-US-Standard-B",
      gender: "MALE",
      speed: 0.9,
      pitch: -2.0,
    },
    "professional-female": {
      name: "en-US-Standard-C",
      gender: "FEMALE",
      speed: 0.9,
      pitch: 0.0,
    },
    "casual-male": {
      name: "en-US-Standard-D",
      gender: "MALE",
      speed: 1.1,
      pitch: 2.0,
    },
    "casual-female": {
      name: "en-US-Standard-E",
      gender: "FEMALE",
      speed: 1.1,
      pitch: 1.0,
    },
    "energetic-male": {
      name: "en-US-Standard-A",
      gender: "MALE",
      speed: 1.2,
      pitch: 3.0,
    },
    "energetic-female": {
      name: "en-US-Standard-F",
      gender: "FEMALE",
      speed: 1.2,
      pitch: 2.0,
    },
  };

  const key = `${persona.style}-${persona.voice}` as VoiceKey;
  return voiceMap[key] || voiceMap["professional-female"];
};

export const generateVideo = async (req: Request, res: Response) => {
  try {
    const { text, persona } = req.body;

    if (!text || !persona) {
      return res.status(400).json({
        success: false,
        generationId: "",
        message: "Text and persona are required",
      });
    }

    if (text.length < 1 || text.length > 5000) {
      return res.status(400).json({
        success: false,
        generationId: "",
        message: "Text must be between 1 and 5000 characters",
      });
    }

    const generationId = uuidv4();

    console.log(`Starting video generation: ${generationId}`);
    console.log(`Text: ${text.substring(0, 100)}...`);
    console.log(`Persona: ${persona.voice} - ${persona.style}`);

    // Store generation metadata
    const generationData = {
      generationId,
      text,
      persona,
      status: "processing",
      progress: 0,
      createdAt: new Date(),
    };

    generationStore.set(generationId, generationData);

    // Send initial progress update
    broadcastMessage({
      type: "generation_progress",
      data: {
        generationId,
        progress: 0,
        message: "Starting video generation...",
      },
      timestamp: new Date().toISOString(),
    });

    // Start generation process asynchronously
    processVideoGeneration(generationId, text, persona);

    const response: VideoGenerationResponse = {
      success: true,
      generationId,
      message: "Video generation started",
    };

    return res.json(response);
  } catch (error) {
    console.error("Error starting video generation:", error);
    return res.status(500).json({
      success: false,
      generationId: "",
      message: "Failed to start video generation",
      error:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
    });
  }
};

const processVideoGeneration = async (
  generationId: string,
  text: string,
  persona: any
) => {
  try {
    const generationData = generationStore.get(generationId);

    // Progress update: 25%
    broadcastMessage({
      type: "generation_progress",
      data: { generationId, progress: 25, message: "Generating speech..." },
      timestamp: new Date().toISOString(),
    });

    // Get voice configuration
    const voiceConfig = getVoiceConfig(persona);

    // Generate speech
    const audioBuffer = await googleCloudService.generateSpeech(
      text,
      voiceConfig
    );

    // Progress update: 75%
    broadcastMessage({
      type: "generation_progress",
      data: { generationId, progress: 75, message: "Creating video file..." },
      timestamp: new Date().toISOString(),
    });

    // Save audio file to storage
    const audioFilename = `generated/audio_${generationId}.mp3`;

    // Create a temporary file object for upload
    const audioFile = {
      data: audioBuffer,
      mimetype: "audio/mpeg",
    };

    const audioUrl = await googleCloudService.uploadFile(
      audioFile,
      audioFilename
    );

    // For this demo, we'll just use the audio file as the "video"
    // In a real implementation, you'd combine audio with avatar/video
    const videoUrl = audioUrl;

    // Update generation data
    generationData.status = "completed";
    generationData.progress = 100;
    generationData.audioUrl = audioUrl;
    generationData.videoUrl = videoUrl;
    generationData.completedAt = new Date();

    generationStore.set(generationId, generationData);

    // Progress update: 100% - Complete
    broadcastMessage({
      type: "generation_complete",
      data: {
        generationId,
        progress: 100,
        message: "Video generation completed successfully",
        audioUrl,
        videoUrl,
      },
      timestamp: new Date().toISOString(),
    });

    console.log(`Video generation completed: ${generationId}`);
  } catch (error) {
    console.error("Error processing video generation:", error);

    const generationData = generationStore.get(generationId);
    if (generationData) {
      generationData.status = "failed";
      generationData.error =
        error instanceof Error ? error.message : String(error);
      generationStore.set(generationId, generationData);
    }

    broadcastMessage({
      type: "error",
      data: {
        generationId,
        message: "Video generation failed",
        error: error instanceof Error ? error.message : String(error),
      },
      timestamp: new Date().toISOString(),
    });
  }
};

export const getGenerationStatus = async (req: Request, res: Response) => {
  try {
    const { generationId } = req.params;

    const generationData = generationStore.get(generationId);
    if (!generationData) {
      return res.status(404).json({
        success: false,
        generationId,
        message: "Generation not found",
      });
    }

    // Generate signed URLs for completed generations
    let audioUrl = generationData.audioUrl;
    let videoUrl = generationData.videoUrl;

    if (generationData.status === "completed" && audioUrl) {
      try {
        const filename = audioUrl.split("/").pop();
        audioUrl = await googleCloudService.getSignedUrl(filename);
        videoUrl = audioUrl; // Same as audio for this demo
      } catch (urlError) {
        console.error("Error generating signed URL:", urlError);
      }
    }

    const response: VideoGenerationResponse = {
      success: true,
      generationId,
      audioUrl,
      videoUrl,
      message: `Generation status: ${generationData.status}`,
    };

    return res.json(response);
  } catch (error) {
    console.error("Error getting generation status:", error);
    return res.status(500).json({
      success: false,
      generationId: req.params.generationId,
      message: "Failed to get generation status",
      error:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
    });
  }
};

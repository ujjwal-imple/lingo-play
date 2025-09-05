import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import googleCloudService from "../services/googleCloudService";
import { VideoGenerationResponse } from "../types";
import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Jimp } from "jimp";
import didService from "../services/didService";
import broadcastMessage from "../utils/websocket";
import { getVoiceConfig } from "../utils/voice";

/*
 * Keep generation task metadata in-memory for the assignment scope. This
 * can be replaced with a persistent store without changing API contracts.
 */
const generationStore = new Map<string, any>();


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

    /*
     * Push early progress so the UI can reflect that work is underway,
     * improving perceived performance for long operations.
     */
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

    // Coarse-grained progress to communicate distinct phases
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

    // Notify UI when moving from audio synthesis to video composition
    broadcastMessage({
      type: "generation_progress",
      data: { generationId, progress: 75, message: "Creating video file..." },
      timestamp: new Date().toISOString(),
    });

    // Save audio file to storage
    const audioFilename = `generated/audio_${generationId}.mp3`;

    // Upload audio buffer as file
    const audioFile = {
      data: audioBuffer,
      mimetype: "audio/mpeg",
    };
    const audioUrl = await googleCloudService.uploadFile(audioFile, audioFilename);

    // Also write audio to temp file for ffmpeg composition
    const tempDir = os.tmpdir();
    const tempAudioPath = path.join(tempDir, `gen_audio_${generationId}.mp3`);
    fs.writeFileSync(tempAudioPath, audioBuffer);

    /*
     * Compose a simple placeholder video from a generated image and the
     * synthesized audio to ensure a baseline video exists even if D‑ID is not
     * configured or fails. This avoids runtime dependency on ffmpeg filters
     * like lavfi/text which may not be available on all hosts.
     */
    const tempVideoPath = path.join(tempDir, `gen_video_${generationId}.mp4`);
    const personaLabel = `${String(persona.style || "professional").toUpperCase()} ${
      String(persona.voice || "female").toUpperCase()
    }`;

    const imageWidth = 1280;
    const imageHeight = 720;
    const bgColor = 0x0f172aff; // slate-900 with alpha

    const image = new Jimp({ width: imageWidth, height: imageHeight, color: bgColor });

    // Simple avatar placeholder (accent square) centered
    const accent = 0x93c5fdff; // blue-300 with alpha
    const avatarSize = 220;
    const avatar = new Jimp({ width: avatarSize, height: avatarSize, color: accent });
    const avatarX = Math.floor((imageWidth - avatarSize) / 2);
    const avatarY = Math.floor((imageHeight - avatarSize) / 2) - 40;
    image.composite(avatar, avatarX, avatarY);

    const tempImagePath = path.join(tempDir, `gen_frame_${generationId}.png`);
    const imgBuffer = await image.getBuffer("image/png");
    fs.writeFileSync(tempImagePath, imgBuffer);

    /*
     * Use "-loop 1" to hold the single image for the duration of audio,
     * and "-shortest" to end when audio ends, producing a valid MP4 quickly.
     */
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(tempImagePath)
        .inputOptions(["-loop 1"])
        .input(tempAudioPath)
        .outputOptions([
          "-c:v libx264",
          "-tune stillimage",
          "-c:a aac",
          "-b:a 192k",
          "-pix_fmt yuv420p",
          "-shortest",
          "-r 30",
        ])
        .on("error", (err) => {
          console.error("FFmpeg video composition error:", err);
          reject(err);
        })
        .on("end", () => resolve())
        .save(tempVideoPath);
    });

    /*
     * Prefer D‑ID talking avatar for better UX when credentials and
     * assets are configured; otherwise fall back to placeholder video so the
     * feature still completes successfully.
     */
    let finalVideoUrl: string | undefined;
    let finalVideoObjectPath: string | undefined;

    const didImageUrl =
      (persona?.voice === "male"
        ? process.env.DID_AVATAR_IMAGE_MALE_URL
        : process.env.DID_AVATAR_IMAGE_FEMALE_URL) || process.env.DID_AVATAR_IMAGE_URL;
    const didEnabled =
      !!process.env.DID_API_USERNAME &&
      !!process.env.DID_API_PASSWORD &&
      !!didImageUrl;

    if (didEnabled) {
      try {
        broadcastMessage({
          type: "generation_progress",
          data: {
            generationId,
            progress: 82,
            message: "Requesting D-ID talking avatar...",
          },
          timestamp: new Date().toISOString(),
        });

        // Build driver expressions sequence per persona style
        const driverExpressions: {
          transition_frames: number;
          expressions: {
            start_frame: number;
            expression: "neutral" | "happy" | "surprise" | "serious";
            intensity?: number;
          }[];
        } = (() => {
          const style = String(persona?.style || "professional");
          if (style === "energetic") {
            return {
              transition_frames: 20,
              expressions: [
                { start_frame: 0, expression: "surprise", intensity: 1.0 },
                { start_frame: 50, expression: "happy", intensity: 1.0 },
                { start_frame: 140, expression: "neutral", intensity: 0.6 },
              ],
            };
          }
          if (style === "casual") {
            return {
              transition_frames: 18,
              expressions: [
                { start_frame: 0, expression: "happy", intensity: 0.9 },
                { start_frame: 120, expression: "neutral", intensity: 0.7 },
              ],
            };
          }
          // professional
          return {
            transition_frames: 16,
            expressions: [
              { start_frame: 0, expression: "neutral", intensity: 0.7 },
              { start_frame: 100, expression: "serious", intensity: 0.8 },
              { start_frame: 180, expression: "neutral", intensity: 0.7 },
            ],
          };
        })();

        // If you prefer D-ID TTS, use createTalkWithText; otherwise use audio
        let createRes;
        if (process.env.DID_USE_TEXT === "true") {
          console.log(didImageUrl)

          createRes = await didService.createTalkWithText(
            didImageUrl!,
            text,
            undefined,
            { driverExpressions }
          );
        } else {
          console.log("Creating talk with audio with Signed URL");
          // Create talk using the uploaded audio in GCS as a signed URL for D-ID to fetch
          // Get a 24h signed URL to the audio object path for D-ID to access
          const signedAudioUrl = await googleCloudService.getSignedUrl(
            audioFilename
          );
          createRes = await didService.createTalkWithAudio(
            didImageUrl!,
            signedAudioUrl,
            { driverExpressions }
          );
        }

        // Poll for completion (up to ~2 minutes)
        let attempts = 0;
        let talk = createRes;
        while (attempts < 48) {
          if (talk?.result_url && talk.status === "done") break;
          await new Promise((r) => setTimeout(r, 2500));
          talk = await didService.getTalk(createRes.id);
          attempts++;
        }

        if (talk?.result_url) {
          // Download the result and upload to our bucket
          const resp = await fetch(talk.result_url);
          if (!resp.ok) throw new Error(`Failed to fetch D-ID result: ${resp.status}`);
          const buf = Buffer.from(await resp.arrayBuffer());
          const didVideoFilename = `generated/did_video_${generationId}.mp4`;
          const didVideoFile = { data: buf, mimetype: "video/mp4" };
          finalVideoUrl = await googleCloudService.uploadFile(
            didVideoFile,
            didVideoFilename
          );
          finalVideoObjectPath = didVideoFilename;
        } else {
          throw new Error("D-ID did not return a result_url in time");
        }
      } catch (e) {
        console.warn("D-ID generation failed, using placeholder video:", e);
      }
    }

    if (!finalVideoUrl) {
      const videoFilename = `generated/video_${generationId}.mp4`;
      const videoBuffer = fs.readFileSync(tempVideoPath);
      const videoFile = { data: videoBuffer, mimetype: "video/mp4" };
      finalVideoUrl = await googleCloudService.uploadFile(videoFile, videoFilename);
      finalVideoObjectPath = videoFilename;
    }

    // Cleanup temp files
    try {
      fs.existsSync(tempAudioPath) && fs.unlinkSync(tempAudioPath);
      fs.existsSync(tempVideoPath) && fs.unlinkSync(tempVideoPath);
      const tempImagePath = path.join(tempDir, `gen_frame_${generationId}.png`);
      fs.existsSync(tempImagePath) && fs.unlinkSync(tempImagePath);
    } catch {}

    // Update generation data
    generationData.status = "completed";
    generationData.progress = 100;
    generationData.audioUrl = audioUrl;
    generationData.videoUrl = finalVideoUrl;
    generationData.audioObjectPath = audioFilename;
    generationData.videoObjectPath = finalVideoObjectPath;
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
        videoUrl: finalVideoUrl,
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

    // Generate signed URLs for completed generations using stored object paths
    let audioUrl = generationData.audioUrl;
    let videoUrl = generationData.videoUrl;

    if (generationData.status === "completed") {
      try {
        if (generationData.audioObjectPath) {
          audioUrl = await googleCloudService.getSignedUrl(
            generationData.audioObjectPath
          );
        }
        if (generationData.videoObjectPath) {
          videoUrl = await googleCloudService.getSignedUrl(
            generationData.videoObjectPath
          );
        }
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

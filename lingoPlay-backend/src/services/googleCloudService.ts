import { Storage } from "@google-cloud/storage";
import { SpeechClient } from "@google-cloud/speech";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { GoogleCloudConfig } from "../types";
import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

class GoogleCloudService {
  private storage: Storage | null = null;
  private speechClient: SpeechClient | null = null;
  private ttsClient: TextToSpeechClient | null = null;
  private bucketName: string | null = null;
  private initialized = false;

  private initialize() {
    if (this.initialized) return;

    console.log("Initializing Google Cloud Service...");
    console.log(
      "GOOGLE_CLOUD_PROJECT_ID:",
      process.env.GOOGLE_CLOUD_PROJECT_ID
    );
    console.log("GOOGLE_CLOUD_KEY_FILE:", process.env.GOOGLE_CLOUD_KEY_FILE);
    console.log(
      "GOOGLE_CLOUD_STORAGE_BUCKET:",
      process.env.GOOGLE_CLOUD_STORAGE_BUCKET
    );

    if (
      !process.env.GOOGLE_CLOUD_PROJECT_ID ||
      !process.env.GOOGLE_CLOUD_KEY_FILE ||
      !process.env.GOOGLE_CLOUD_STORAGE_BUCKET
    ) {
      throw new Error(
        "Missing required Google Cloud environment variables. Please check your .env file."
      );
    }

    const config: GoogleCloudConfig = {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
      bucketName: process.env.GOOGLE_CLOUD_STORAGE_BUCKET,
    };

    // Initialize Google Cloud clients
    this.storage = new Storage({
      projectId: config.projectId,
      keyFilename: config.keyFilename,
    });

    this.speechClient = new SpeechClient({
      projectId: config.projectId,
      keyFilename: config.keyFilename,
    });

    this.ttsClient = new TextToSpeechClient({
      projectId: config.projectId,
      keyFilename: config.keyFilename,
    });

    this.bucketName = config.bucketName;
    this.initialized = true;
    console.log("✅ Google Cloud Service initialized successfully!");
  }

  // Upload file to Google Cloud Storage
  async uploadFile(file: any, filename: string): Promise<string> {
    this.initialize();
    try {
      const bucket = this.storage!.bucket(this.bucketName!);
      const fileUpload = bucket.file(filename);

      const stream = fileUpload.createWriteStream({
        metadata: {
          contentType: file.mimetype || "application/octet-stream",
        },
        resumable: false,
      });

      return new Promise((resolve, reject) => {
        stream.on("error", (error) => {
          console.error("Upload error:", error);
          reject(error);
        });

        stream.on("finish", () => {
          const publicUrl = `gs://${this.bucketName}/${filename}`;
          console.log(`File uploaded successfully: ${publicUrl}`);
          resolve(publicUrl);
        });

        // Support express-fileupload with useTempFiles=true (tempFilePath) or in-memory buffer (data)
        if (file.tempFilePath && fs.existsSync(file.tempFilePath)) {
          fs.createReadStream(file.tempFilePath)
            .on("error", (err) => {
              console.error("Read temp file error:", err);
              stream.destroy(err);
            })
            .pipe(stream);
        } else if (file.data) {
          stream.end(file.data);
        } else {
          stream.destroy(
            new Error(
              "No file data found. Ensure express-fileupload is configured and the file is provided."
            )
          );
        }
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    }
  }

  // Get signed URL for downloading
  async getSignedUrl(filename: string): Promise<string> {
    this.initialize();
    try {
      const bucket = this.storage!.bucket(this.bucketName!);
      const file = bucket.file(filename);

      const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      });

      return url;
    } catch (error) {
      console.error("Error generating signed URL:", error);
      throw error;
    }
  }

  // Transcribe audio from video
  async transcribeAudio(audioUri: string): Promise<any> {
    this.initialize();
    try {
      // For extracted WAV audio files (16kHz, 1 channel, PCM 16-bit)
      let request = {
        config: {
          encoding: "LINEAR16" as const,
          sampleRateHertz: 16000,
          audioChannelCount: 1,
          languageCode: "en-US",
          enableWordTimeOffsets: true,
          enableAutomaticPunctuation: true,
          model: "latest_short",
        },
        audio: {
          uri: audioUri,
        },
      };

      console.log("Starting transcription for:", audioUri);
      console.log("Request config:", JSON.stringify(request.config, null, 2));

      try {
        const [operation] = await this.speechClient!.longRunningRecognize(
          request
        );
        console.log("Transcription operation started successfully");
        return await this.waitForTranscriptionOperation(operation);
      } catch (error) {
        console.log("First attempt failed, trying with FLAC encoding...");

        // Fallback to FLAC encoding which works well with video files
        const flacRequest = {
          config: {
            encoding: "FLAC" as const,
            languageCode: "en-US",
            enableWordTimeOffsets: true,
          },
          audio: {
            uri: audioUri,
          },
        };

        try {
          const [operation] = await this.speechClient!.longRunningRecognize(
            flacRequest
          );
          console.log(
            "Transcription operation started with FLAC fallback config"
          );
          return await this.waitForTranscriptionOperation(operation);
        } catch (secondError) {
          console.log(
            "FLAC attempt failed, trying absolute basic configuration..."
          );

          // Final fallback - absolute minimum configuration
          const minimalRequest = {
            config: {
              languageCode: "en-US",
              enableWordTimeOffsets: true,
            },
            audio: {
              uri: audioUri,
            },
          };

          const [operation] = await this.speechClient!.longRunningRecognize(
            minimalRequest
          );
          console.log("Transcription operation started with minimal config");
          return await this.waitForTranscriptionOperation(operation);
        }
      }
    } catch (error) {
      console.error("Error transcribing audio:", error);
      throw error;
    }
  }

  private async waitForTranscriptionOperation(operation: any): Promise<any> {
    try {
      console.log("Transcription operation started, waiting for completion...");

      const [response] = await operation.promise();
      console.log("Transcription completed successfully");

      return response;
    } catch (error) {
      console.error("Error transcribing audio:", error);
      throw error;
    }
  }

  // Generate speech from text
  async generateSpeech(text: string, voiceConfig: any): Promise<Buffer> {
    this.initialize();
    try {
      const request = {
        input: { text },
        voice: {
          languageCode: "en-US",
          name: voiceConfig.name || "en-US-Standard-A",
          ssmlGender: voiceConfig.gender || "FEMALE",
        },
        audioConfig: {
          audioEncoding: "MP3" as const,
          speakingRate: voiceConfig.speed || 1.0,
          pitch: voiceConfig.pitch || 0.0,
        },
      };

      console.log(
        "Generating speech for text:",
        text.substring(0, 100) + "..."
      );
      const [response] = await this.ttsClient!.synthesizeSpeech(request);

      if (!response.audioContent) {
        throw new Error("No audio content received from TTS");
      }

      console.log("Speech generation completed successfully");
      return response.audioContent as Buffer;
    } catch (error) {
      console.error("Error generating speech:", error);
      throw error;
    }
  }

  // Extract audio from video file
  async extractAudioFromVideo(
    videoFile: any,
    filename: string
  ): Promise<string> {
    this.initialize();
    return new Promise((resolve, reject) => {
      try {
        // Create temporary directories
        const tempDir = os.tmpdir();
        const createdTempVideoPath = path.join(
          tempDir,
          `temp_video_${Date.now()}.mp4`
        );
        const audioPath = path.join(tempDir, `temp_audio_${Date.now()}.wav`);

        console.log("Extracting audio from video...");
        console.log("Intended temp video path:", createdTempVideoPath);
        console.log("Audio path:", audioPath);

        // Determine input source path
        let inputVideoPath = createdTempVideoPath;
        let shouldCleanupCreatedVideo = false;

        if (videoFile.tempFilePath && fs.existsSync(videoFile.tempFilePath)) {
          // Use the temp file directly when express-fileupload stores to disk
          inputVideoPath = videoFile.tempFilePath;
          console.log("Using existing temp upload file:", inputVideoPath);
        } else if (videoFile.data) {
          // Write in-memory buffer to disk
          fs.writeFileSync(createdTempVideoPath, videoFile.data);
          shouldCleanupCreatedVideo = true;
          console.log("Wrote in-memory upload to:", createdTempVideoPath);
        } else {
          throw new Error(
            "Video file has neither tempFilePath nor data buffer available"
          );
        }

        // Extract audio using FFmpeg
        ffmpeg(inputVideoPath)
          .noVideo()
          .audioCodec("pcm_s16le")
          .audioFrequency(16000) // 16kHz sample rate for Speech-to-Text
          .audioChannels(1) // Mono audio
          .format("wav")
          .output(audioPath)
          .on("end", async () => {
            try {
              console.log("Audio extraction completed");

              // Read the extracted audio file
              const audioBuffer = fs.readFileSync(audioPath);

              // Create audio filename
              const audioFilename = filename.replace(/\.[^/.]+$/, ".wav");

              // Upload audio to Google Cloud Storage
              const bucket = this.storage!.bucket(this.bucketName!);
              const audioFileUpload = bucket.file(audioFilename);

              const stream = audioFileUpload.createWriteStream({
                metadata: {
                  contentType: "audio/wav",
                },
                resumable: false,
              });

              stream.on("error", (error) => {
                console.error("Audio upload error:", error);
                const filesToCleanup = [audioPath];
                if (shouldCleanupCreatedVideo)
                  filesToCleanup.push(createdTempVideoPath);
                this.cleanupTempFiles(filesToCleanup);
                reject(error);
              });

              stream.on("finish", () => {
                const audioUrl = `gs://${this.bucketName}/${audioFilename}`;
                console.log(`Audio file uploaded successfully: ${audioUrl}`);
                const filesToCleanup = [audioPath];
                if (shouldCleanupCreatedVideo)
                  filesToCleanup.push(createdTempVideoPath);
                this.cleanupTempFiles(filesToCleanup);
                resolve(audioUrl);
              });

              stream.end(audioBuffer);
            } catch (error) {
              console.error("Error processing extracted audio:", error);
              const filesToCleanup = [audioPath];
              if (shouldCleanupCreatedVideo)
                filesToCleanup.push(createdTempVideoPath);
              this.cleanupTempFiles(filesToCleanup);
              reject(error);
            }
          })
          .on("error", (error: any) => {
            console.error("FFmpeg error:", error);
            const filesToCleanup = [audioPath];
            if (shouldCleanupCreatedVideo)
              filesToCleanup.push(createdTempVideoPath);
            this.cleanupTempFiles(filesToCleanup);
            reject(error);
          })
          .run();
      } catch (error) {
        console.error("Error extracting audio from video:", error);
        reject(error);
      }
    });
  }

  // Clean up temporary files
  private cleanupTempFiles(filePaths: string[]): void {
    filePaths.forEach((filePath) => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up temp file: ${filePath}`);
        }
      } catch (error) {
        console.error(`Error cleaning up temp file ${filePath}:`, error);
      }
    });
  }

  // Delete file from storage
  async deleteFile(filename: string): Promise<void> {
    this.initialize();
    try {
      const bucket = this.storage!.bucket(this.bucketName!);
      await bucket.file(filename).delete();
      console.log(`File deleted: ${filename}`);
    } catch (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  }
}

export default new GoogleCloudService();

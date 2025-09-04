import { useState } from "react";
import { apiService } from "../../services/apiService";
import { X, Download, User, Users } from "lucide-react";
import styles from "./VideoGenerationSection.module.css";

interface VideoGenerationSectionProps {
  onVideoGenerated?: (videoUrl: string) => void;
}

interface PersonaOption {
  id: string;
  label: string;
  voice: "male" | "female";
  style: "professional" | "casual" | "energetic";
  description: string;
}

const personaOptions: PersonaOption[] = [
  {
    id: "professional-male",
    label: "Professional Male",
    voice: "male",
    style: "professional",
    description: "Clear, authoritative business voice",
  },
  {
    id: "professional-female",
    label: "Professional Female",
    voice: "female",
    style: "professional",
    description: "Confident, articulate presentation style",
  },
  {
    id: "casual-male",
    label: "Casual Male",
    voice: "male",
    style: "casual",
    description: "Relaxed, conversational tone",
  },
  {
    id: "casual-female",
    label: "Casual Female",
    voice: "female",
    style: "casual",
    description: "Friendly, approachable speaking style",
  },
  {
    id: "energetic-male",
    label: "Energetic Male",
    voice: "male",
    style: "energetic",
    description: "Enthusiastic, dynamic presentation",
  },
  {
    id: "energetic-female",
    label: "Energetic Female",
    voice: "female",
    style: "energetic",
    description: "Vibrant, engaging delivery style",
  },
];

const VideoGenerationSection = ({
  onVideoGenerated,
}: VideoGenerationSectionProps) => {
  const [inputText, setInputText] = useState("");
  const [selectedPersona, setSelectedPersona] = useState<string>(
    "professional-female"
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string>("");
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string>("");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!inputText.trim()) return;

    const selectedPersonaData = personaOptions.find(
      (p) => p.id === selectedPersona
    );
    if (!selectedPersonaData) return;

    setIsGenerating(true);
    setGenerationProgress(0);
    setError(null);
    setGeneratedVideoUrl("");
    setGeneratedAudioUrl("");

    try {
      console.log("Starting video generation...");

      // Create persona object in the format expected by backend
      const persona = {
        voice: selectedPersonaData.voice,
        style: selectedPersonaData.style,
      };

      const response = await apiService.generateVideo(
        inputText.trim(),
        persona
      );

      if (response.success) {
        console.log("Video generation started:", response.generationId);

        // The progress updates will come via WebSocket (handled in App.tsx)
        // For now, we'll poll for completion
        pollGenerationStatus(response.generationId);
      } else {
        throw new Error(response.message || "Failed to start video generation");
      }
    } catch (error) {
      console.error("Video generation error:", error);
      setError(
        error instanceof Error ? error.message : "Failed to generate video"
      );
      setIsGenerating(false);
    }
  };

  const pollGenerationStatus = async (generationId: string) => {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    const pollInterval = setInterval(async () => {
      attempts++;

      try {
        const response = await apiService.getGenerationStatus(generationId);

        if (response.success) {
          // Update progress (mock progress since WebSocket might not be connected)
          setGenerationProgress(Math.min(75 + attempts * 2, 95));

          if (response.audioUrl || response.videoUrl) {
            clearInterval(pollInterval);
            setGenerationProgress(100);
            setGeneratedAudioUrl(response.audioUrl || "");
            setGeneratedVideoUrl(response.videoUrl || response.audioUrl || "");
            setIsGenerating(false);
            onVideoGenerated?.(response.videoUrl || response.audioUrl || "");
            console.log("Video generation completed");
          }
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          throw new Error("Generation timed out");
        }
      } catch (error) {
        clearInterval(pollInterval);
        console.error("Polling error:", error);
        setError(error instanceof Error ? error.message : "Generation failed");
        setIsGenerating(false);
      }
    }, 5000); // Poll every 5 seconds
  };

  const handleClearGeneration = () => {
    setGeneratedVideoUrl("");
    setGeneratedAudioUrl("");
    setGenerationProgress(0);
    setError(null);
  };

  const selectedPersonaData = personaOptions.find(
    (p) => p.id === selectedPersona
  );

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Video Generation</h3>

      <div className={styles.content}>
        <div className={styles.inputGroup}>
          <label className={styles.label}>
            Enter text to convert to video:
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Enter the text you want to convert into a video with speech..."
            className={styles.textarea}
            rows={3}
            disabled={isGenerating}
          />
          <div className={styles.charCount}>
            {inputText.length} characters
            {inputText.length > 5000 && (
              <span className={styles.charWarning}> (Max 5000 characters)</span>
            )}
          </div>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            <p>❌ {error}</p>
          </div>
        )}

        <div className={styles.personaGroup}>
          <label className={styles.label}>Select persona:</label>
          <div className={styles.personaGrid}>
            {personaOptions.map((persona) => (
              <button
                key={persona.id}
                className={`${styles.personaCard} ${
                  selectedPersona === persona.id ? styles.selectedPersona : ""
                }`}
                onClick={() => setSelectedPersona(persona.id)}
                disabled={isGenerating}
              >
                <div className={styles.personaHeader}>
                  <span className={styles.personaIcon}>
                    {persona.voice === "male" ? "👨" : "👩"}
                  </span>
                  <span className={styles.personaLabel}>{persona.label}</span>
                </div>
                <div className={styles.personaDescription}>
                  {persona.description}
                </div>
                <div className={styles.personaTags}>
                  <span className={styles.tag}>{persona.voice}</span>
                  <span className={styles.tag}>{persona.style}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedPersonaData && (
          <div className={styles.selectedPersonaPreview}>
            <strong>Selected:</strong> {selectedPersonaData.label} -{" "}
            {selectedPersonaData.description}
          </div>
        )}

        <button
          onClick={handleGenerate}
          className={styles.generateButton}
          disabled={
            !inputText.trim() || inputText.length > 5000 || isGenerating
          }
        >
          {isGenerating ? "Generating Video..." : "Generate Video"}
        </button>

        {isGenerating && (
          <div className={styles.progressContainer}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${generationProgress}%` }}
              ></div>
            </div>
            <div className={styles.progressText}>
              {generationProgress < 30 && "Processing text..."}
              {generationProgress >= 30 &&
                generationProgress < 60 &&
                "Generating speech..."}
              {generationProgress >= 60 &&
                generationProgress < 90 &&
                "Creating video..."}
              {generationProgress >= 90 && "Finalizing..."}
            </div>
          </div>
        )}

        {(generatedVideoUrl || generatedAudioUrl) && (
          <div className={styles.resultContainer}>
            <div className={styles.resultHeader}>
              <h4>Generated Content Ready!</h4>
              <button
                onClick={handleClearGeneration}
                className={styles.clearButton}
              >
                <X size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            {generatedVideoUrl && (
              <video
                className={styles.generatedVideo}
                controls
                src={generatedVideoUrl}
              >
                Your browser does not support the video tag.
              </video>
            )}

            {generatedAudioUrl && !generatedVideoUrl && (
              <audio
                className={styles.generatedAudio}
                controls
                src={generatedAudioUrl}
              >
                Your browser does not support the audio tag.
              </audio>
            )}

            <div className={styles.resultActions}>
              {generatedVideoUrl && (
                <a
                  href={generatedVideoUrl}
                  download="generated-video.mp4"
                  className={styles.downloadButton}
                >
                  <Download size={16} strokeWidth={2} aria-hidden="true" />{" "}
                  Download Video
                </a>
              )}
              {generatedAudioUrl && (
                <a
                  href={generatedAudioUrl}
                  download="generated-audio.mp3"
                  className={styles.downloadButton}
                  style={{ marginLeft: generatedVideoUrl ? "1rem" : "0" }}
                >
                  <Download size={16} strokeWidth={2} aria-hidden="true" />{" "}
                  Download Audio
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { VideoGenerationSection };
export type { VideoGenerationSectionProps };

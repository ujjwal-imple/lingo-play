import { useState } from "react";
import { apiService } from "../../services/apiService";
import type { TranscriptionSegment } from "../../types/api";
import styles from "./TranscriptionSection.module.css";
import { FileText, Sparkles, AlertCircle } from "lucide-react";

interface TranscriptionSectionProps {
  videoId?: string;
  transcription: TranscriptionSegment[];
  summary: string;
  isTranscribing: boolean;
  onStartTranscription: () => void;
  showManualStart?: boolean;
}

const TranscriptionSection = ({
  videoId,
  transcription,
  summary,
  isTranscribing,
  onStartTranscription,
  showManualStart = true,
}: TranscriptionSectionProps) => {
  const [activeTab, setActiveTab] = useState<"transcription" | "summary">(
    "transcription"
  );
  const [error, setError] = useState<string | null>(null);

  const handleStartTranscription = async () => {
    if (!videoId) {
      setError("No video uploaded");
      return;
    }

    try {
      setError(null);
      onStartTranscription();

      // Start transcription process
      await apiService.startTranscription(videoId);

      console.log("Transcription started successfully");
    } catch (error) {
      console.error("Failed to start transcription:", error);
      setError(
        error instanceof Error ? error.message : "Failed to start transcription"
      );
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Transcription & Summary</h3>

      {!videoId && (
        <div className={styles.placeholder}>
          <div className={styles.placeholderIcon}>
            <FileText size={48} strokeWidth={2} aria-hidden="true" />
          </div>
          <p>Upload a video to see transcription and summary</p>
        </div>
      )}

      {videoId && (
        <>
          {/* Show start button if allowed and no transcription exists */}
          {showManualStart && !transcription.length && !isTranscribing && (
            <div className={styles.startSection}>
              <p>Video uploaded successfully! Ready to transcribe.</p>
              <button
                onClick={handleStartTranscription}
                className={styles.startButton}
              >
                Start Transcription
              </button>
            </div>
          )}

          {/* Show error message if any */}
          {error && (
            <div className={styles.errorMessage}>
              <p>
                <AlertCircle
                  size={16}
                  style={{
                    marginRight: "0.4rem",
                    verticalAlign: "text-bottom",
                  }}
                  aria-hidden="true"
                />
                {error}
              </p>
            </div>
          )}

          {/* Show tabs and content when transcription exists or is in progress */}
          {(transcription.length > 0 || isTranscribing || summary) && (
            <>
              <div className={styles.tabs}>
                <button
                  className={`${styles.tab} ${
                    activeTab === "transcription" ? styles.activeTab : ""
                  }`}
                  onClick={() => setActiveTab("transcription")}
                >
                  Transcription
                </button>
                <button
                  className={`${styles.tab} ${
                    activeTab === "summary" ? styles.activeTab : ""
                  }`}
                  onClick={() => setActiveTab("summary")}
                >
                  Summary
                </button>
              </div>

              <div className={styles.content}>
                {activeTab === "transcription" && (
                  <div className={styles.transcriptionContent}>
                    {isTranscribing ? (
                      <div className={styles.loading}>
                        <div className={styles.spinner}></div>
                        <p>
                          Transcribing audio... This may take a few minutes.
                        </p>
                      </div>
                    ) : transcription.length > 0 ? (
                      <div className={styles.transcriptionText}>
                        {transcription.map((segment, index) => (
                          <p key={index} className={styles.transcriptionLine}>
                            {segment.text}
                            <span className={styles.confidence}>
                              ({Math.round(segment.confidence * 100)}%)
                            </span>
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.noContent}>
                        No transcription available
                      </p>
                    )}
                  </div>
                )}

                {activeTab === "summary" && (
                  <div className={styles.summaryContent}>
                    {isTranscribing ? (
                      <div className={styles.loading}>
                        <div className={styles.spinner}></div>
                        <p>
                          <Sparkles
                            size={14}
                            style={{
                              marginRight: "0.4rem",
                              verticalAlign: "text-bottom",
                            }}
                            aria-hidden="true"
                          />
                          Generating summary...
                        </p>
                      </div>
                    ) : summary ? (
                      <div className={styles.summaryText}>
                        {summary.split("\n").map((line, index) => (
                          <p key={index} className={styles.summaryLine}>
                            {line}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.noContent}>No summary available</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export { TranscriptionSection };
export type { TranscriptionSectionProps };

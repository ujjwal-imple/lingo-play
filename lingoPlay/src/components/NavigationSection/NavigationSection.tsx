import { useState } from "react";
import {
  apiService,
  type TranscriptionSegment,
} from "../../services/apiService";
import styles from "./NavigationSection.module.css";
import { Clock, Search, X } from "lucide-react";

interface NavigationSectionProps {
  videoId?: string;
  transcription: TranscriptionSegment[];
  onNavigateToTime?: (seconds: number) => void;
}

const NavigationSection = ({
  videoId,
  transcription,
  onNavigateToTime,
}: NavigationSectionProps) => {
  const [selectedMode, setSelectedMode] = useState<"seconds" | "phrase">(
    "seconds"
  );
  const [timeInput, setTimeInput] = useState("");
  const [phraseInput, setPhraseInput] = useState("");
  const [searchResult, setSearchResult] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleNavigateBySeconds = async () => {
    const seconds = parseFloat(timeInput);
    if (isNaN(seconds) || seconds < 0) {
      setSearchResult("Please enter a valid time in seconds");
      return;
    }

    setIsLoading(true);
    try {
      // Call the API to validate the timestamp
      const response = await apiService.navigateToTimestamp(seconds);

      if (response.success) {
        onNavigateToTime?.(seconds);
        setSearchResult(`Navigated to ${seconds} seconds`);
      } else {
        setSearchResult("Failed to navigate to timestamp");
      }
    } catch (error) {
      console.error("Navigation error:", error);
      setSearchResult(
        error instanceof Error ? error.message : "Navigation failed"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigateByPhrase = async () => {
    if (!phraseInput.trim()) {
      setSearchResult("Please enter a phrase to search");
      return;
    }

    if (!videoId) {
      setSearchResult("No video uploaded");
      return;
    }

    if (!transcription.length) {
      setSearchResult("No transcription available to search");
      return;
    }

    setIsLoading(true);
    try {
      // Call the API to search for the phrase
      const response = await apiService.navigateToPhrase(
        videoId,
        phraseInput.trim()
      );

      if (response.success) {
        onNavigateToTime?.(response.timestamp);
        setSearchResult(
          `Found "${phraseInput}" at ${response.timestamp.toFixed(1)} seconds`
        );
        if (response.matchedText) {
          setSearchResult(
            (prev) => `${prev}\nMatched: "${response.matchedText}"`
          );
        }
      } else {
        setSearchResult(`Phrase "${phraseInput}" not found in transcription`);
      }
    } catch (error) {
      console.error("Phrase search error:", error);
      setSearchResult(error instanceof Error ? error.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = (mode: "seconds" | "phrase") => {
    setSelectedMode(mode);
    setSearchResult("");
  };

  const clearResult = () => {
    setSearchResult("");
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Navigation</h3>

      <div className={styles.modeSelector}>
        <button
          className={`${styles.modeButton} ${
            selectedMode === "seconds" ? styles.active : ""
          }`}
          onClick={() => handleModeChange("seconds")}
        >
          <Clock size={16} strokeWidth={2} aria-hidden="true" /> Go to Seconds
        </button>
        <button
          className={`${styles.modeButton} ${
            selectedMode === "phrase" ? styles.active : ""
          }`}
          onClick={() => handleModeChange("phrase")}
        >
          <Search size={16} strokeWidth={2} aria-hidden="true" /> Go to Phrase
        </button>
      </div>

      <div className={styles.navigationContent}>
        {selectedMode === "seconds" && (
          <div className={styles.secondsNavigation}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Enter timestamp (seconds):</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                placeholder="e.g., 30.5"
                className={styles.input}
              />
            </div>
            <button
              onClick={handleNavigateBySeconds}
              className={styles.navigateButton}
              disabled={!timeInput || isLoading}
            >
              {isLoading ? "Navigating..." : "Navigate to Time"}
            </button>
          </div>
        )}

        {selectedMode === "phrase" && (
          <div className={styles.phraseNavigation}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Enter phrase to search:</label>
              <input
                type="text"
                value={phraseInput}
                onChange={(e) => setPhraseInput(e.target.value)}
                placeholder="e.g., React development"
                className={styles.input}
                onKeyPress={(e) =>
                  e.key === "Enter" && handleNavigateByPhrase()
                }
              />
            </div>
            <button
              onClick={handleNavigateByPhrase}
              className={styles.navigateButton}
              disabled={
                !phraseInput.trim() || !transcription.length || isLoading
              }
            >
              {isLoading ? "Searching..." : "Find & Navigate"}
            </button>
            {!transcription.length && (
              <p className={styles.hint}>
                Upload and transcribe a video first to search phrases
              </p>
            )}
          </div>
        )}
      </div>

      {searchResult && (
        <div className={styles.resultContainer}>
          <div className={styles.result}>{searchResult}</div>
          <button
            onClick={clearResult}
            className={styles.clearButton}
            aria-label="Clear result"
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};

export { NavigationSection };
export type { NavigationSectionProps };

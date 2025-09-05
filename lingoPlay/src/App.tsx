import { useState, useRef, useEffect } from "react";
import { VideoPlayer } from "./components/VideoPlayer/VideoPlayer";
import type { VideoPlayerRef } from "./components/VideoPlayer/VideoPlayer";
import { TranscriptionSection } from "./components/TranscriptionSection/TranscriptionSection";
import { NavigationSection } from "./components/NavigationSection/NavigationSection";
import { VideoGenerationSection } from "./components/VideoGenerationSection/VideoGenerationSection";
import { apiService } from "./services/apiService";
import type { TranscriptionSegment } from "./types/api";
import styles from "./App.module.css";

function App() {
  // State for uploaded video and its metadata
  const [uploadedVideoData, setUploadedVideoData] = useState<
    | {
        videoId: string;
        uploadUrl: string;
        filename: string;
      }
    | undefined
  >();

  const [transcription, setTranscription] = useState<TranscriptionSegment[]>(
    []
  );
  const [summary, setSummary] = useState<string>("");
  const [isTranscribing, setIsTranscribing] = useState(false);

  const videoPlayerRef = useRef<VideoPlayerRef>(null);

  /*
   * Establish a single WebSocket subscription for real-time progress
   * so the UI reacts immediately to long-running backend jobs without
   * polling. We attach once on mount and cleanly disconnect on unmount.
   */
  useEffect(() => {
    apiService.connectWebSocket({
      onTranscriptionProgress: (data) => {
        console.log("Transcription progress:", data);
      },
      onTranscriptionComplete: (data) => {
        console.log("Transcription completed:", data);
        setTranscription(data.transcription.segments);
        setSummary(data.transcription.summary);
        setIsTranscribing(false);
      },
      onGenerationProgress: (data) => {
        console.log("Generation progress:", data);
      },
      onGenerationComplete: (data) => {
        console.log("Generation completed:", data);
      },
      onError: (data) => {
        console.error("WebSocket error:", data);
        setIsTranscribing(false);
      },
    });

    return () => {
      apiService.disconnectWebSocket();
    };
  }, []);

  /*
   * Auto-start transcription for a just-uploaded video to reduce clicks
   * and improve perceived responsiveness. We reset local state first to
   * avoid briefly showing stale results while the new job begins.
   */
  useEffect(() => {
    const start = async () => {
      if (!uploadedVideoData?.videoId) return;
      try {
        setTranscription([]);
        setSummary("");
        setIsTranscribing(true);
        await apiService.startTranscription(uploadedVideoData.videoId);
        console.log(
          "Auto transcription started for:",
          uploadedVideoData.videoId
        );
      } catch (error) {
        console.error("Failed to auto-start transcription:", error);
        setIsTranscribing(false);
      }
    };
    start();
  }, [uploadedVideoData?.videoId]);

  const handleVideoUploaded = (videoData: {
    videoId: string;
    uploadUrl: string;
    filename: string;
  }) => {
    setUploadedVideoData(videoData);
    console.log("Video uploaded with ID:", videoData.videoId);
  };

  const handleNavigateToTime = (seconds: number) => {
    console.log("Navigate to time:", seconds);
    videoPlayerRef.current?.jumpToTime(seconds);
  };

  const handleVideoGenerated = (videoUrl: string) => {
    console.log("Video generated:", videoUrl);
  };

  return (
    <div className={styles.container}>
      <div className={styles.leftPanel}>
        <VideoPlayer
          ref={videoPlayerRef}
          onVideoUploaded={handleVideoUploaded}
          onTimeUpdate={(time) => console.log("Current time:", time)}
        />
      </div>

      <div className={styles.rightPanel}>
        <div className={`${styles.section} ${styles.transcriptionSection}`}>
          <TranscriptionSection
            videoId={uploadedVideoData?.videoId}
            transcription={transcription}
            summary={summary}
            isTranscribing={isTranscribing}
            onStartTranscription={() => setIsTranscribing(true)}
            showManualStart={false}
          />
        </div>

        <div className={`${styles.section} ${styles.navigationSection}`}>
          <NavigationSection
            videoId={uploadedVideoData?.videoId}
            transcription={transcription}
            onNavigateToTime={handleNavigateToTime}
          />
        </div>

        <div className={`${styles.section} ${styles.videoGenerationSection}`}>
          <VideoGenerationSection onVideoGenerated={handleVideoGenerated} />
        </div>
      </div>
    </div>
  );
}

export default App;

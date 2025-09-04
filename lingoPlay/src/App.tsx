import { useState, useRef, useEffect } from "react";
import { VideoPlayer } from "./components/VideoPlayer/VideoPlayer";
import type { VideoPlayerRef } from "./components/VideoPlayer/VideoPlayer";
import { TranscriptionSection } from "./components/TranscriptionSection/TranscriptionSection";
import { NavigationSection } from "./components/NavigationSection/NavigationSection";
import { VideoGenerationSection } from "./components/VideoGenerationSection/VideoGenerationSection";
import { apiService, type TranscriptionSegment } from "./services/apiService";
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

  // State for transcription data
  const [transcription, setTranscription] = useState<TranscriptionSegment[]>(
    []
  );
  const [summary, setSummary] = useState<string>("");

  // Loading states
  const [isTranscribing, setIsTranscribing] = useState(false);

  const videoPlayerRef = useRef<VideoPlayerRef>(null);

  // Connect to WebSocket on component mount
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
    // Could potentially load the generated video in the main player
  };

  return (
    <div className={styles.container}>
      {/* Left Panel - Video Player */}
      <div className={styles.leftPanel}>
        <VideoPlayer
          ref={videoPlayerRef}
          onVideoUploaded={handleVideoUploaded}
          onTimeUpdate={(time) => console.log("Current time:", time)}
        />
      </div>

      {/* Right Panel - Three Sections */}
      <div className={styles.rightPanel}>
        {/* Top Section - Transcription & Summary */}
        <div className={`${styles.section} ${styles.transcriptionSection}`}>
          <TranscriptionSection
            videoId={uploadedVideoData?.videoId}
            transcription={transcription}
            summary={summary}
            isTranscribing={isTranscribing}
            onStartTranscription={() => setIsTranscribing(true)}
          />
        </div>

        {/* Middle Section - Navigation */}
        <div className={`${styles.section} ${styles.navigationSection}`}>
          <NavigationSection
            videoId={uploadedVideoData?.videoId}
            transcription={transcription}
            onNavigateToTime={handleNavigateToTime}
          />
        </div>

        {/* Bottom Section - Video Generation */}
        <div className={`${styles.section} ${styles.videoGenerationSection}`}>
          <VideoGenerationSection onVideoGenerated={handleVideoGenerated} />
        </div>
      </div>
    </div>
  );
}

export default App;

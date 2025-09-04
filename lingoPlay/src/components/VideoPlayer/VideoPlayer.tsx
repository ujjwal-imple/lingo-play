import React, { useRef, useState, forwardRef } from "react";
import {
  Upload,
  Hourglass,
  XCircle,
  Play as PlayIcon,
  Pause as PauseIcon,
  FileText,
} from "lucide-react";
import { apiService } from "../../services/apiService";
import styles from "./VideoPlayer.module.css";

interface VideoPlayerProps {
  onVideoUploaded?: (videoData: {
    videoId: string;
    uploadUrl: string;
    filename: string;
  }) => void;
  onTimeUpdate?: (currentTime: number) => void;
}

export interface VideoPlayerRef {
  jumpToTime: (seconds: number) => void;
}

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ onVideoUploaded, onTimeUpdate }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [videoSrc, setVideoSrc] = useState<string>("");
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadedVideoData, setUploadedVideoData] = useState<{
      videoId: string;
      uploadUrl: string;
      filename: string;
    } | null>(null);

    const handleFileUpload = async (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      const file = event.target.files?.[0];
      if (!file || !file.type.startsWith("video/")) {
        setUploadError("Please select a valid video file");
        return;
      }

      if (file.size > 500 * 1024 * 1024) {
        // 500MB limit
        setUploadError("File size exceeds 500MB limit");
        return;
      }

      setIsUploading(true);
      setUploadError(null);

      try {
        console.log("Starting upload for:", file.name);
        const response = await apiService.uploadVideo(file);

        console.log("Upload successful:", response);

        // Set video source to the local file for immediate playback
        const localUrl = URL.createObjectURL(file);
        setVideoSrc(localUrl);

        // Store the uploaded video data
        const videoData = {
          videoId: response.videoId,
          uploadUrl: response.uploadUrl,
          filename: response.filename,
        };

        setUploadedVideoData(videoData);
        onVideoUploaded?.(videoData);
      } catch (error) {
        console.error("Upload failed:", error);
        setUploadError(
          error instanceof Error ? error.message : "Upload failed"
        );
      } finally {
        setIsUploading(false);
      }
    };

    const handlePlayPause = () => {
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause();
        } else {
          videoRef.current.play();
        }
        setIsPlaying(!isPlaying);
      }
    };

    const handleTimeUpdate = () => {
      if (videoRef.current) {
        const time = videoRef.current.currentTime;
        setCurrentTime(time);
        onTimeUpdate?.(time);
      }
    };

    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        setDuration(videoRef.current.duration);
      }
    };

    const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(event.target.value);
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      }
    };

    // Expose jumpToTime method for external navigation
    React.useImperativeHandle(ref, () => ({
      jumpToTime: (seconds: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = seconds;
          setCurrentTime(seconds);
        }
      },
    }));

    const formatTime = (time: number) => {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    return (
      <div className={styles.container}>
        <h2 className={styles.title}>Video Player</h2>

        {!videoSrc && !isUploading && (
          <div className={styles.uploadArea}>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              className={styles.fileInput}
              id="video-upload"
              disabled={isUploading}
            />
            <label htmlFor="video-upload" className={styles.uploadLabel}>
              <div className={styles.uploadIcon}>
                <Upload size={48} strokeWidth={2} aria-hidden="true" />
              </div>
              <p>Click to upload video</p>
              <p className={styles.uploadHint}>
                Supports MP4, WebM, OGV (Max 500MB)
              </p>
              {uploadedVideoData && (
                <p className={styles.uploadSuccess}>
                  Uploaded: {uploadedVideoData.filename}
                </p>
              )}
            </label>
          </div>
        )}

        {isUploading && (
          <div className={styles.uploadArea}>
            <div className={styles.uploadIcon}>
              <Hourglass size={40} strokeWidth={2} aria-hidden="true" />
            </div>
            <p>Uploading video...</p>
            <p className={styles.uploadHint}>
              Please wait while your video uploads
            </p>
          </div>
        )}

        {uploadError && (
          <div className={styles.errorMessage}>
            <p>
              <XCircle
                size={18}
                style={{ marginRight: "0.5rem", verticalAlign: "text-bottom" }}
                aria-hidden="true"
              />
              Upload Error: {uploadError}
            </p>
            <button
              onClick={() => {
                setUploadError(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              className={styles.retryButton}
            >
              Try Again
            </button>
          </div>
        )}

        {videoSrc && (
          <div className={styles.videoContainer}>
            <video
              ref={videoRef}
              src={videoSrc}
              className={styles.video}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />

            <div className={styles.controls}>
              <button
                onClick={handlePlayPause}
                className={styles.playButton}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <PauseIcon size={20} strokeWidth={2} aria-hidden="true" />
                ) : (
                  <PlayIcon size={20} strokeWidth={2} aria-hidden="true" />
                )}
              </button>

              <div className={styles.progressContainer}>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className={styles.progressBar}
                />
                <div className={styles.timeDisplay}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>
            </div>

            {uploadedVideoData && (
              <div className={styles.uploadInfo}>
                <p>
                  <FileText
                    size={16}
                    style={{
                      marginRight: "0.4rem",
                      verticalAlign: "text-bottom",
                    }}
                    aria-hidden="true"
                  />
                  Video ID: {uploadedVideoData.videoId}
                </p>
                <p>Ready for transcription</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

VideoPlayer.displayName = "VideoPlayer";

export { VideoPlayer };
export type { VideoPlayerProps };

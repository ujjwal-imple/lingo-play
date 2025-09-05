// API Service for LingoPlay Backend
import { config } from "../utils/config";
import { wsClient } from "./wsClient";
import type {
  VideoUploadResponse,
  TranscriptionResponse,
  NavigationResponse,
  VideoGenerationResponse,
  TranscriptionProgressData,
  TranscriptionCompleteData,
  GenerationProgressData,
  GenerationCompleteData,
  ErrorData,
  Persona,
} from "../types/api";

class ApiService {
  // no internal WS state; delegated to wsClient

  // Generic API request method
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${config.apiBaseUrl}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Network error" }));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async uploadVideo(videoFile: File): Promise<VideoUploadResponse> {
    const formData = new FormData();
    formData.append("video", videoFile);

    const response = await fetch(`${config.apiBaseUrl}/video/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Upload failed" }));
      throw new Error(
        errorData.message || `Upload failed: HTTP ${response.status}`
      );
    }

    return response.json();
  }

  async getVideoStatus(
    videoId: string
  ): Promise<{ success: boolean; data: unknown }> {
    return this.request(`/video/${videoId}/status`);
  }

  async startTranscription(
    videoId: string,
    language = "en-US"
  ): Promise<{ success: boolean; message: string; videoId: string }> {
    return this.request("/transcription/start", {
      method: "POST",
      body: JSON.stringify({ videoId, language }),
    });
  }

  async getTranscription(videoId: string): Promise<TranscriptionResponse> {
    return this.request(`/transcription/${videoId}`);
  }

  async navigateToTimestamp(timestamp: number): Promise<NavigationResponse> {
    return this.request("/navigation/timestamp", {
      method: "POST",
      body: JSON.stringify({ timestamp }),
    });
  }

  async navigateToPhrase(
    videoId: string,
    phrase: string
  ): Promise<NavigationResponse> {
    return this.request("/navigation/phrase", {
      method: "POST",
      body: JSON.stringify({ videoId, phrase }),
    });
  }

  async generateVideo(
    text: string,
    persona: Persona
  ): Promise<VideoGenerationResponse> {
    return this.request("/generation/create", {
      method: "POST",
      body: JSON.stringify({ text, persona }),
    });
  }

  async getGenerationStatus(
    generationId: string
  ): Promise<VideoGenerationResponse> {
    return this.request(`/generation/${generationId}/status`);
  }

  // WebSocket Connection (delegated to wsClient for clarity)
  connectWebSocket(callbacks?: {
    onTranscriptionProgress?: (data: TranscriptionProgressData) => void;
    onTranscriptionComplete?: (data: TranscriptionCompleteData) => void;
    onGenerationProgress?: (data: GenerationProgressData) => void;
    onGenerationComplete?: (data: GenerationCompleteData) => void;
    onError?: (data: ErrorData) => void;
  }) {
    wsClient.connect(callbacks);
  }

  disconnectWebSocket() {
    wsClient.disconnect();
  }
}

export const apiService = new ApiService();
export default apiService;

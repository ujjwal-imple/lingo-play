// API Service for LingoPlay Backend

const API_BASE_URL = "http://localhost:3001/api";

// Types for API responses
export interface VideoUploadResponse {
  success: boolean;
  videoId: string;
  filename: string;
  uploadUrl: string;
  message: string;
}

export interface TranscriptionResponse {
  success: boolean;
  videoId: string;
  transcription: TranscriptionSegment[];
  fullText: string;
  summary: string;
  message: string;
}

export interface TranscriptionSegment {
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface NavigationResponse {
  success: boolean;
  timestamp: number;
  message: string;
  matchedText?: string;
}

export interface VideoGenerationResponse {
  success: boolean;
  generationId: string;
  audioUrl?: string;
  videoUrl?: string;
  message: string;
}

// WebSocket data types
export interface TranscriptionProgressData {
  videoId: string;
  progress: number;
  message: string;
}

export interface TranscriptionCompleteData {
  videoId: string;
  progress: number;
  message: string;
  transcription: {
    segments: TranscriptionSegment[];
    fullText: string;
    summary: string;
  };
}

export interface GenerationProgressData {
  generationId: string;
  progress: number;
  message: string;
}

export interface GenerationCompleteData {
  generationId: string;
  progress: number;
  message: string;
  audioUrl?: string;
  videoUrl?: string;
}

export interface ErrorData {
  videoId?: string;
  generationId?: string;
  message: string;
  error?: string;
}

// WebSocket Message Types
export interface WebSocketMessage {
  type:
    | "transcription_progress"
    | "transcription_complete"
    | "generation_progress"
    | "generation_complete"
    | "error";
  data:
    | TranscriptionProgressData
    | TranscriptionCompleteData
    | GenerationProgressData
    | GenerationCompleteData
    | ErrorData;
  timestamp: string;
}

// Persona interface
export interface Persona {
  voice: "male" | "female";
  style: "professional" | "casual" | "energetic";
}

class ApiService {
  private ws: WebSocket | null = null;
  private wsCallbacks: Map<
    string,
    (
      data:
        | TranscriptionProgressData
        | TranscriptionCompleteData
        | GenerationProgressData
        | GenerationCompleteData
        | ErrorData
    ) => void
  > = new Map();

  // Generic API request method
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

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

  // Video Upload
  async uploadVideo(videoFile: File): Promise<VideoUploadResponse> {
    const formData = new FormData();
    formData.append("video", videoFile);

    const response = await fetch(`${API_BASE_URL}/video/upload`, {
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

  // Get Video Status
  async getVideoStatus(
    videoId: string
  ): Promise<{ success: boolean; data: unknown }> {
    return this.request(`/video/${videoId}/status`);
  }

  // Start Transcription
  async startTranscription(
    videoId: string,
    language = "en-US"
  ): Promise<{ success: boolean; message: string; videoId: string }> {
    return this.request("/transcription/start", {
      method: "POST",
      body: JSON.stringify({ videoId, language }),
    });
  }

  // Get Transcription
  async getTranscription(videoId: string): Promise<TranscriptionResponse> {
    return this.request(`/transcription/${videoId}`);
  }

  // Navigate to Timestamp
  async navigateToTimestamp(timestamp: number): Promise<NavigationResponse> {
    return this.request("/navigation/timestamp", {
      method: "POST",
      body: JSON.stringify({ timestamp }),
    });
  }

  // Navigate to Phrase
  async navigateToPhrase(
    videoId: string,
    phrase: string
  ): Promise<NavigationResponse> {
    return this.request("/navigation/phrase", {
      method: "POST",
      body: JSON.stringify({ videoId, phrase }),
    });
  }

  // Generate Video
  async generateVideo(
    text: string,
    persona: Persona
  ): Promise<VideoGenerationResponse> {
    return this.request("/generation/create", {
      method: "POST",
      body: JSON.stringify({ text, persona }),
    });
  }

  // Get Generation Status
  async getGenerationStatus(
    generationId: string
  ): Promise<VideoGenerationResponse> {
    return this.request(`/generation/${generationId}/status`);
  }

  // WebSocket Connection
  connectWebSocket(callbacks?: {
    onTranscriptionProgress?: (data: TranscriptionProgressData) => void;
    onTranscriptionComplete?: (data: TranscriptionCompleteData) => void;
    onGenerationProgress?: (data: GenerationProgressData) => void;
    onGenerationComplete?: (data: GenerationCompleteData) => void;
    onError?: (data: ErrorData) => void;
  }) {
    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket("ws://localhost:3001");

    this.ws.onopen = () => {
      console.log("WebSocket connected");
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        // Call registered callbacks
        switch (message.type) {
          case "transcription_progress":
            callbacks?.onTranscriptionProgress?.(
              message.data as TranscriptionProgressData
            );
            break;
          case "transcription_complete":
            callbacks?.onTranscriptionComplete?.(
              message.data as TranscriptionCompleteData
            );
            break;
          case "generation_progress":
            callbacks?.onGenerationProgress?.(
              message.data as GenerationProgressData
            );
            break;
          case "generation_complete":
            callbacks?.onGenerationComplete?.(
              message.data as GenerationCompleteData
            );
            break;
          case "error":
            callbacks?.onError?.(message.data as ErrorData);
            break;
        }
      } catch (error) {
        console.error("WebSocket message parse error:", error);
      }
    };

    this.ws.onclose = () => {
      console.log("WebSocket disconnected");
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  disconnectWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const apiService = new ApiService();
export default apiService;

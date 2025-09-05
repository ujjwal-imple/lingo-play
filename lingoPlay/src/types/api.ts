// Shared API and WebSocket types for the frontend

export interface VideoUploadResponse {
  success: boolean;
  videoId: string;
  filename: string;
  uploadUrl: string;
  message: string;
}

export interface TranscriptionSegment {
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface TranscriptionResponse {
  success: boolean;
  videoId: string;
  transcription: TranscriptionSegment[];
  fullText: string;
  summary: string;
  message: string;
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

export interface Persona {
  voice: "male" | "female";
  style: "professional" | "casual" | "energetic";
}



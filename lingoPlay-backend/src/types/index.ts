export interface VideoUploadRequest {
  videoId: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface VideoUploadResponse {
  success: boolean;
  videoId: string;
  filename: string;
  uploadUrl?: string;
  message: string;
}

export interface TranscriptionRequest {
  videoId: string;
  language?: string;
}

export interface TranscriptionSegment {
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface WordTiming {
  text: string;
  startTime: number;
  endTime: number;
}

export interface TranscriptionResponse {
  success: boolean;
  videoId: string;
  transcription: TranscriptionSegment[];
  fullText: string;
  summary?: string;
  message: string;
}

export interface NavigationRequest {
  videoId: string;
  type: "timestamp" | "phrase";
  value: string | number;
}

export interface NavigationResponse {
  success: boolean;
  timestamp: number;
  message: string;
  matchedText?: string;
}

export interface VideoGenerationRequest {
  text: string;
  persona: {
    voice: "male" | "female";
    style: "professional" | "casual" | "friendly" | "energetic";
    language?: string;
  };
}

export interface VideoGenerationResponse {
  success: boolean;
  generationId: string;
  audioUrl?: string;
  videoUrl?: string;
  message: string;
}

export interface WebSocketMessage {
  type:
    | "transcription_progress"
    | "transcription_complete"
    | "generation_progress"
    | "generation_complete"
    | "error";
  data: any;
  timestamp: string;
}

export interface GoogleCloudConfig {
  projectId: string;
  keyFilename: string;
  bucketName: string;
}

export interface ProcessingStatus {
  id: string;
  type: "transcription" | "generation";
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  message: string;
  startTime: Date;
  endTime?: Date;
  result?: any;
  error?: string;
}

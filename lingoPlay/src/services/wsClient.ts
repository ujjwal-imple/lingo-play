import { config } from "../utils/config";
import type {
  WebSocketMessage,
  TranscriptionProgressData,
  TranscriptionCompleteData,
  GenerationProgressData,
  GenerationCompleteData,
  ErrorData,
} from "../types/api";

type Callbacks = {
  onTranscriptionProgress?: (data: TranscriptionProgressData) => void;
  onTranscriptionComplete?: (data: TranscriptionCompleteData) => void;
  onGenerationProgress?: (data: GenerationProgressData) => void;
  onGenerationComplete?: (data: GenerationCompleteData) => void;
  onError?: (data: ErrorData) => void;
};

export class WsClient {
  private ws: WebSocket | null = null;
  private callbacks?: Callbacks;

  connect(callbacks?: Callbacks) {
    this.callbacks = callbacks;
    if (this.ws) this.ws.close();
    this.ws = new WebSocket(config.wsUrl);

    this.ws.onopen = () => {
      console.log("WebSocket connected");
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        switch (message.type) {
          case "transcription_progress":
            this.callbacks?.onTranscriptionProgress?.(
              message.data as TranscriptionProgressData
            );
            break;
          case "transcription_complete":
            this.callbacks?.onTranscriptionComplete?.(
              message.data as TranscriptionCompleteData
            );
            break;
          case "generation_progress":
            this.callbacks?.onGenerationProgress?.(
              message.data as GenerationProgressData
            );
            break;
          case "generation_complete":
            this.callbacks?.onGenerationComplete?.(
              message.data as GenerationCompleteData
            );
            break;
          case "error":
            this.callbacks?.onError?.(message.data as ErrorData);
            break;
        }
      } catch (e) {
        console.error("WebSocket message parse error:", e);
      }
    };

    this.ws.onclose = () => {
      console.log("WebSocket disconnected");
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsClient = new WsClient();
export default wsClient;



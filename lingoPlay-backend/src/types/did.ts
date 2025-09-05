export type DidExpression = "neutral" | "happy" | "surprise" | "serious";

export type DidDriverExpressions = {
  expressions: { start_frame: number; expression: DidExpression; intensity?: number }[];
  transition_frames?: number;
};

export type DidProvider = {
  type?: "microsoft" | "amazon" | "elevenlabs";
  voice_id?: string;
};

export type CreateTalkResponse = {
  id: string;
  status?: string;
  result_url?: string;
  error?: string;
};



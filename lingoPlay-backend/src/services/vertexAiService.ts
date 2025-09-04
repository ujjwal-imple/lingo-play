import { VertexAI } from "@google-cloud/vertexai";

class VertexAiService {
  private client: any | null = null;
  private initialized = false;

  private initialize() {
    if (this.initialized) return;

    const project = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.VERTEX_LOCATION || "us-central1";
    const keyFile = process.env.GOOGLE_CLOUD_KEY_FILE;

    if (!project || !keyFile) {
      throw new Error(
        "Missing GOOGLE_CLOUD_PROJECT_ID or GOOGLE_CLOUD_KEY_FILE for Vertex AI"
      );
    }

    this.client = new VertexAI({
      project,
      location,
      googleAuthOptions: { keyFile },
    });
    this.initialized = true;
  }

  async summarizeText(text: string): Promise<string> {
    this.initialize();
    if (!text || !text.trim()) return "";

    const modelName =
      process.env.VERTEX_SUMMARY_MODEL || "gemini-2.0-flash-lite-001";
    const generativeModel: any = this.client!.getGenerativeModel({
      model: modelName,
    });

    const prompt = `Summarize the following transcript in detail. Be neutral,thoughtful and factual.\n\nTranscript:\n${text}`;

    const result: any = await generativeModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 10000,
      },
    });

    const candidates = result?.response?.candidates || [];
    console.log("Candidates:", candidates);
    const firstText = candidates[0]?.content?.parts?.[0]?.text || "";
    console.log("First text:", firstText);
    return firstText.trim();
  }
}

export default new VertexAiService();

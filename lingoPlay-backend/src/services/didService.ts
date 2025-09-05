import dotenv from "dotenv";
import { CreateTalkResponse, DidDriverExpressions, DidProvider } from "../types/did";

dotenv.config();

class DidService {
  private readonly baseUrl = "https://api.d-id.com";

  private getAuthHeader(): string {
    const username = process.env.DID_API_USERNAME || "";
    const password = process.env.DID_API_PASSWORD || "";
    if (!username || !password) {
      throw new Error(
        "Missing DID_API_USERNAME or DID_API_PASSWORD environment variables"
      );
    }
    // Per D-ID docs, send literal "Basic API_USERNAME:API_PASSWORD"
    return `Basic ${username}:${password}`;
  }

  async createTalkWithAudio(
    sourceUrl: string,
    audioUrl: string,
    options?: {
      driver?: string;
      background?: string;
      driverExpressions?: DidDriverExpressions;
    }
  ): Promise<CreateTalkResponse> {
    const body: any = {
      source_url: sourceUrl,
      script: {
        type: "audio",
        audio_url: audioUrl,
      },
      // stitch true to ensure a single output video
      config: { stitch: true },
    };

    if (options?.driver) body.driver_url = options.driver;
    if (options?.background) body.background = options.background;
    if (options?.driverExpressions)
      body.config.driver_expressions = options.driverExpressions;

    const res = await fetch(`${this.baseUrl}/talks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: this.getAuthHeader(),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`D-ID create talk failed: HTTP ${res.status} ${text}`);
    }

    return (await res.json()) as CreateTalkResponse;
  }

  async createTalkWithText(
    sourceUrl: string,
    text: string,
    provider?: DidProvider,
    options?: {
      driver?: string;
      background?: string;
      driverExpressions?: DidDriverExpressions;
    }
  ): Promise<CreateTalkResponse> {
    const body: any = {
      source_url: sourceUrl,
      script: {
        type: "text",
        input: text,
      },
      config: { stitch: true },
    };

    if (provider && (provider.type || provider.voice_id)) {
      body.script.provider = {};
      if (provider.type) body.script.provider.type = provider.type;
      if (provider.voice_id) body.script.provider.voice_id = provider.voice_id;
    }

    if (options?.driver) body.driver_url = options.driver;
    if (options?.background) body.background = options.background;
    if (options?.driverExpressions)
      body.config.driver_expressions = options.driverExpressions;

    const res = await fetch(`${this.baseUrl}/talks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: this.getAuthHeader(),
      },
      body: JSON.stringify(body),
    });

    

    if (!res.ok) {
     
      const textRes = await res.text().catch(() => "");
      throw new Error(`D-ID create talk (text) failed: HTTP ${res.status} ${textRes}`);
    }

    return (await res.json()) as CreateTalkResponse;
  }

  async getTalk(id: string): Promise<CreateTalkResponse> {
    const res = await fetch(`${this.baseUrl}/talks/${id}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: this.getAuthHeader(),
      },
    });
   

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.log("D-ID get talk (text) failed:", res);
      throw new Error(`D-ID get talk failed: HTTP ${res.status} ${text}`);
    }

    return (await res.json()) as CreateTalkResponse;
  }
}

export default new DidService();



import { describe, it, expect } from "vitest";
import { getVoiceConfig } from "./voice";

describe("utils/voice", () => {
  it("returns expected config for professional male", () => {
    const cfg = getVoiceConfig({ style: "professional", voice: "male" });
    expect(cfg.name).toBe("en-US-Standard-B");
    expect(cfg.gender).toBe("MALE");
  });

  it("returns expected config for energetic female", () => {
    const cfg = getVoiceConfig({ style: "energetic", voice: "female" });
    expect(cfg.name).toBe("en-US-Standard-F");
    expect(cfg.gender).toBe("FEMALE");
    expect(cfg.speed).toBeGreaterThan(1);
  });

  it("falls back to professional-female when unknown persona given", () => {
    const cfg = getVoiceConfig({ style: "unknown", voice: "unknown" });
    expect(cfg.name).toBe("en-US-Standard-C");
    expect(cfg.gender).toBe("FEMALE");
  });
});



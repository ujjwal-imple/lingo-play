type VoiceKey =
  | "professional-male"
  | "professional-female"
  | "casual-male"
  | "casual-female"
  | "energetic-male"
  | "energetic-female";

export const getVoiceConfig = (persona: any) => {
  const voiceMap: Record<
    VoiceKey,
    { name: string; gender: string; speed: number; pitch: number }
  > = {
    "professional-male": {
      name: "en-US-Standard-B",
      gender: "MALE",
      speed: 0.9,
      pitch: -2.0,
    },
    "professional-female": {
      name: "en-US-Standard-C",
      gender: "FEMALE",
      speed: 0.9,
      pitch: 0.0,
    },
    "casual-male": {
      name: "en-US-Standard-D",
      gender: "MALE",
      speed: 1.1,
      pitch: 2.0,
    },
    "casual-female": {
      name: "en-US-Standard-E",
      gender: "FEMALE",
      speed: 1.1,
      pitch: 1.0,
    },
    "energetic-male": {
      name: "en-US-Standard-A",
      gender: "MALE",
      speed: 1.2,
      pitch: 3.0,
    },
    "energetic-female": {
      name: "en-US-Standard-F",
      gender: "FEMALE",
      speed: 1.2,
      pitch: 2.0,
    },
  };

  const key = `${persona.style}-${persona.voice}` as VoiceKey;
  return voiceMap[key] || voiceMap["professional-female"];
};



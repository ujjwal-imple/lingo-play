import { describe, it, expect } from "vitest";
import { formatTime } from "./time";

describe("utils/time", () => {
  it("formats seconds into mm:ss with zero padding", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(600)).toBe("10:00");
  });

  it("floors fractional seconds and clamps negatives to zero", () => {
    expect(formatTime(59.9)).toBe("0:59");
    expect(formatTime(-10)).toBe("0:00");
  });
});



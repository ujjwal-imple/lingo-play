import { describe, it, expect } from "vitest";
import { normalizeText, tokenize, simpleExtractiveSummary } from "./text";

describe("utils/text", () => {
  describe("normalizeText", () => {
    it("lowercases, strips diacritics and punctuation, collapses spaces", () => {
      const input = "Héllo,   Wörld!!  This—is  a  test.";
      const result = normalizeText(input);
      expect(result).toBe("hello world this is a test");
    });

    it("handles empty and falsy strings", () => {
      expect(normalizeText("")).toBe("");
      expect(normalizeText((undefined as unknown) as string)).toBe("");
    });
  });

  describe("tokenize", () => {
    it("splits normalized text into tokens", () => {
      const tokens = tokenize(" React, development 101! ");
      expect(tokens).toEqual(["react", "development", "101"]);
    });

    it("returns empty array for empty input", () => {
      expect(tokenize("")).toEqual([]);
    });
  });

  describe("simpleExtractiveSummary", () => {
    it("returns original text if <= 3 sentences", () => {
      const text = "One. Two. Three.";
      expect(simpleExtractiveSummary(text)).toBe(text);
    });

    it("returns first, middle, last sentence otherwise", () => {
      const text = "S1. S2. S3. S4. S5.";
      const summary = simpleExtractiveSummary(text);
      expect(summary).toBe("S1. S3. S5.");
    });
  });
});



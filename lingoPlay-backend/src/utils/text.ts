export const normalizeText = (input: string): string => {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const tokenize = (input: string): string[] => {
  const normalized = normalizeText(input);
  return normalized ? normalized.split(" ") : [];
};

export const simpleExtractiveSummary = (text: string): string => {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (sentences.length <= 3) return text.trim();
  return [
    sentences[0],
    sentences[Math.floor(sentences.length / 2)],
    sentences[sentences.length - 1],
  ]
    .map((s) => s.trim())
    .join(". ")
    .concat(".");
};

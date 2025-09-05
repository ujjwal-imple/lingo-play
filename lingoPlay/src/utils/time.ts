export const formatTime = (timeSeconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(timeSeconds || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};



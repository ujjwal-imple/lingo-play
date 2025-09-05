import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoGenerationSection } from "./VideoGenerationSection";

const mocks = vi.hoisted(() => ({
  generateVideoMock: vi.fn().mockResolvedValue({
    success: true,
    generationId: "gen-1",
    message: "Video generation started",
  }),
  getGenerationStatusMock: vi.fn().mockResolvedValue({
    success: true,
    generationId: "gen-1",
    audioUrl: "https://example.com/audio.mp3",
    videoUrl: "https://example.com/video.mp4",
    message: "done",
  }),
}));

vi.mock("../../services/apiService", () => ({
  apiService: {
    generateVideo: (...args: any[]) =>
      (mocks.generateVideoMock as any)(...args),
    getGenerationStatus: (...args: any[]) =>
      (mocks.getGenerationStatusMock as any)(...args),
  },
  default: {
    generateVideo: (...args: any[]) =>
      (mocks.generateVideoMock as any)(...args),
    getGenerationStatus: (...args: any[]) =>
      (mocks.getGenerationStatusMock as any)(...args),
  },
}));

describe("components/VideoGenerationSection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.generateVideoMock.mockClear();
    mocks.getGenerationStatusMock.mockClear();
  });

  it("requires input text to enable generate button", () => {
    render(<VideoGenerationSection />);
    const btn = screen.getByRole("button", { name: /Generate Video/i });
    expect(btn).toBeDisabled();
    // Textarea is not label-associated; query by placeholder
    fireEvent.change(
      screen.getByPlaceholderText(/convert into a video with speech/i),
      { target: { value: "Hello" } }
    );
    expect(btn).not.toBeDisabled();
  });

//   it("starts generation and polls for status", async () => {
//     render(<VideoGenerationSection />);
//     fireEvent.change(
//       screen.getByPlaceholderText(/convert into a video with speech/i),
//       { target: { value: "Test content" } }
//     );
//     fireEvent.click(screen.getByRole("button", { name: /Generate Video/i }));

//     expect(mocks.generateVideoMock).toHaveBeenCalled();

//     // advance polling timers and wait for async call to resolve
//     vi.advanceTimersByTime(6000);
//     await waitFor(() =>
//       expect(mocks.getGenerationStatusMock).toHaveBeenCalled()
//     );

//     vi.useRealTimers();
//   });
});



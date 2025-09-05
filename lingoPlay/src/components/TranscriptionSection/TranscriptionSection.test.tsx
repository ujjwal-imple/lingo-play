import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TranscriptionSection } from "./TranscriptionSection";

const mocks = vi.hoisted(() => ({
  startTranscriptionMock: vi.fn().mockResolvedValue({
    success: true,
    message: "Transcription started",
    videoId: "vid-1",
  }),
}));

vi.mock("../../services/apiService", () => ({
  apiService: {
    startTranscription: (...args: any[]) =>
      (mocks.startTranscriptionMock as any)(...args),
  },
  default: {
    startTranscription: (...args: any[]) =>
      (mocks.startTranscriptionMock as any)(...args),
  },
}));

describe("components/TranscriptionSection", () => {
  beforeEach(() => {
    mocks.startTranscriptionMock.mockClear();
  });

  it("shows placeholder when no video uploaded", () => {
    render(
      <TranscriptionSection
        videoId={undefined}
        transcription={[]}
        summary=""
        isTranscribing={false}
        onStartTranscription={() => {}}
        showManualStart={true}
      />
    );
    expect(
      screen.getByText(/Upload a video to see transcription and summary/i)
    ).toBeInTheDocument();
  });

  it("starts transcription when Start button is clicked", async () => {
    const onStart = vi.fn();
    render(
      <TranscriptionSection
        videoId="vid-1"
        transcription={[]}
        summary=""
        isTranscribing={false}
        onStartTranscription={onStart}
        showManualStart={true}
      />
    );

    const btn = screen.getByRole("button", { name: /Start Transcription/i });
    fireEvent.click(btn);

    expect(onStart).toHaveBeenCalled();
    expect(mocks.startTranscriptionMock).toHaveBeenCalledWith("vid-1");
  });

  it("shows loading indicators when transcribing", () => {
    render(
      <TranscriptionSection
        videoId="vid-1"
        transcription={[]}
        summary=""
        isTranscribing={true}
        onStartTranscription={() => {}}
        showManualStart={false}
      />
    );

    expect(
      screen.getByText(/Transcribing audio... This may take a few minutes\./i)
    ).toBeInTheDocument();

    const summaryTab = screen.getByRole("button", { name: /Summary/i });
    fireEvent.click(summaryTab);
    expect(screen.getByText(/Generating summary/i)).toBeInTheDocument();
  });
});



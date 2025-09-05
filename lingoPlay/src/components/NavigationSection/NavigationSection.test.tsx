import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NavigationSection } from "./NavigationSection";

const mocks = vi.hoisted(() => ({
  navigateToTimestampMock: vi.fn().mockResolvedValue({
    success: true,
    timestamp: 12.5,
    message: "Navigate to 12.5 seconds",
  }),
  navigateToPhraseMock: vi.fn().mockResolvedValue({
    success: true,
    timestamp: 6.2,
    message: "Found phrase",
    matchedText: "world this",
  }),
}));

vi.mock("../../services/apiService", () => ({
  apiService: {
    navigateToTimestamp: (...args: any[]) =>
      (mocks.navigateToTimestampMock as any)(...args),
    navigateToPhrase: (...args: any[]) =>
      (mocks.navigateToPhraseMock as any)(...args),
  },
  default: {
    navigateToTimestamp: (...args: any[]) =>
      (mocks.navigateToTimestampMock as any)(...args),
    navigateToPhrase: (...args: any[]) =>
      (mocks.navigateToPhraseMock as any)(...args),
  },
}));

describe("components/NavigationSection", () => {
  beforeEach(() => {
    mocks.navigateToTimestampMock.mockClear();
    mocks.navigateToPhraseMock.mockClear();
  });

  it("navigates by seconds and calls onNavigateToTime", async () => {
    const onNavigate = vi.fn();
    render(
      <NavigationSection
        videoId="vid-1"
        transcription={[]}
        onNavigateToTime={onNavigate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Go to Seconds/i }));
    fireEvent.change(screen.getByPlaceholderText(/e\.g\., 30\.5/i), {
      target: { value: "12.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Navigate to Time/i }));

    await waitFor(() =>
      expect(mocks.navigateToTimestampMock).toHaveBeenCalledWith(12.5)
    );
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith(12.5));
  });

  it("validates phrase search requires transcription and videoId", async () => {
    // Provide a non-empty transcription so the button is enabled,
    // but keep videoId undefined to trigger validation path.
    render(
      <NavigationSection
        videoId={undefined}
        transcription={[{ text: "t", startTime: 0, endTime: 1, confidence: 1 }] as any}
        onNavigateToTime={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Go to Phrase/i }));
    fireEvent.change(
      screen.getByPlaceholderText(/e\.g\., React development/i),
      { target: { value: "hello" } }
    );
    fireEvent.click(screen.getByRole("button", { name: /Find & Navigate/i }));

    expect(screen.getByText(/No video uploaded/i)).toBeInTheDocument();
  });
});



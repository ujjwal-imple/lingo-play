import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
// Build a minimal app using the actual router to test endpoint contract
import navigationRoutes from "./navigationRoutes";
import { transcriptionStore } from "../controllers/transcriptionController";

const app = express();
app.use(express.json());
app.use("/api/navigation", navigationRoutes);

describe("routes/navigationRoutes", () => {
  it("POST /timestamp returns the same timestamp when valid", async () => {
    const res = await request(app)
      .post("/api/navigation/timestamp")
      .send({ timestamp: 12.5 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.timestamp).toBe(12.5);
  });

  it("POST /timestamp validates input", async () => {
    const res = await request(app)
      .post("/api/navigation/timestamp")
      .send({ timestamp: -1 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("POST /phrase finds timestamp from transcription store", async () => {
    const videoId = "vid-123";
    transcriptionStore.set(videoId, {
      videoId,
      segments: [
        {
          text: "Hello world this is a test",
          startTime: 5,
          endTime: 10,
          confidence: 0.9,
          words: [
            { text: "Hello", startTime: 5.0, endTime: 5.3 },
            { text: "world", startTime: 5.3, endTime: 5.6 },
            { text: "this", startTime: 5.6, endTime: 5.9 },
            { text: "is", startTime: 5.9, endTime: 6.1 },
            { text: "a", startTime: 6.1, endTime: 6.2 },
            { text: "test", startTime: 6.2, endTime: 6.6 },
          ],
        },
      ],
      fullText: "Hello world this is a test",
      summary: "",
      language: "en-US",
      createdAt: new Date(),
    });

    const res = await request(app)
      .post("/api/navigation/phrase")
      .send({ videoId, phrase: "world this" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.timestamp).toBeGreaterThanOrEqual(5.3);
    expect(res.body.timestamp).toBeLessThan(6.0);
  });
});



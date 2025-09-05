# LingoPlay Backend (API Server)

Production-grade backend for the LingoPlay application. It powers:

- Video upload and storage in Google Cloud Storage (GCS)
- Speech-to-Text (STT) transcription with Google Cloud Speech-to-Text
- Transcript summarization with Google Vertex AI (Gemini family)
- Intelligent navigation by seconds and by phrase (word-timestamp aware)
- Text-to-Speech (TTS) and synthetic video generation (baseline via FFmpeg/Jimp, optional D‑ID talking avatar)
- Real-time progress updates via WebSocket

This README explains system prerequisites, environment configuration, architecture and data flow, detailed endpoint behavior, and operations. It is designed to meet the assignment’s documentation expectations for setup and technical depth.

## Prerequisites

- Node.js >= 18
- FFmpeg installed and available on PATH (required for audio extraction and video composition)
- Google Cloud project with the following APIs enabled:
  - Cloud Speech-to-Text API
  - Cloud Text-to-Speech API
  - Cloud Storage API
- A GCS bucket and a service account JSON key with access to the bucket
- Optional: Google Vertex AI access for summarization (recommended)
- Optional: D‑ID account and avatar image URL(s) for talking avatar generation

## Quick Start

1) Install dependencies

```bash
npm install
```

2) Configure environment variables (see “Environment” below). No `.env.example` file is included; define a `.env` with the keys listed in this README or set them in your shell.

3) Start in development

```bash
npm run dev
```

4) Build and run in production

```bash
npm run build
npm start
```

5) Run tests

```bash
npm test
# or watch mode
npm run test:watch
# with coverage
npm run test:coverage
```

## Testing

This project uses Vitest for unit/integration tests and Supertest for HTTP endpoint testing.

- Test runner: `vitest`
- Coverage: `@vitest/coverage-v8`
- HTTP testing: `supertest`

### Commands

```bash
# Run all tests once (CI-friendly)
npm test

# Watch mode (developer workflow)
npm run test:watch

# Coverage report (text + HTML in coverage/)
npm run test:coverage
```

### Test structure

- Co-located tests next to source when small and focused, e.g. `src/utils/text.test.ts`.
- Lightweight integration tests use an ephemeral Express app and the real router (no server boot), e.g. `src/routes/navigationRoutes.test.ts`.

Current examples:

- `src/utils/text.test.ts` – unit tests for `normalizeText`, `tokenize`, `simpleExtractiveSummary`.
- `src/utils/voice.test.ts` – unit tests for persona → TTS voice mapping.
- `src/routes/navigationRoutes.test.ts` – integration tests for navigation endpoints (`/timestamp`, `/phrase`).

### Writing tests

- Prefer pure unit tests for helpers in `utils/`.
- For route tests, build a minimal Express app and mount the router under test:

```ts
import express from "express";
import request from "supertest";
import router from "../routes/navigationRoutes";

const app = express();
app.use(express.json());
app.use("/api/navigation", router);

it("navigates by timestamp", async () => {
  const res = await request(app).post("/api/navigation/timestamp").send({ timestamp: 10 });
  expect(res.status).toBe(200);
});
```

### Mocking and isolation

- WebSockets: `broadcastMessage` is a no-op in tests unless `setWsConnections()` is called, preventing server boot during tests.
- External services (GCS, STT/TTS, Vertex, D‑ID): for unit tests, mock the service methods. For example:

```ts
vi.spyOn(googleCloudService, "transcribeAudio").mockResolvedValue({ results: [] });
```

- Avoid importing `src/server.ts` in tests; mount routers directly to keep tests fast and deterministic.

By default, the server listens on `http://localhost:3001` and exposes WebSockets at `ws://localhost:3001`. CORS is allowed for the frontend at `FRONTEND_URL` (defaults to `http://localhost:5173`).

## Environment

Required (Google Cloud):

```
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_KEY_FILE=./google-cloud-key.json     # path to your service account JSON file
GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name
```

Server configuration:

```
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

Vertex AI (recommended for high-quality summaries):

```
VERTEX_LOCATION=us-central1
VERTEX_SUMMARY_MODEL=gemini-2.0-flash-lite-001
```

D‑ID (optional for talking avatar):

```
DID_API_USERNAME=your-did-username
DID_API_PASSWORD=your-did-password
DID_AVATAR_IMAGE_URL=https://.../image.png                    # or gender-specific URLs below
DID_AVATAR_IMAGE_MALE_URL=https://.../male.png
DID_AVATAR_IMAGE_FEMALE_URL=https://.../female.png
DID_USE_TEXT=true                                             # optional; use D‑ID’s TTS instead of audio
```

Notes:

- Ensure FFmpeg is installed and on PATH.
- The service account must have read/write access to the specified bucket.
- On Windows, the `clean` script in `package.json` uses `rm -rf`; run cleanup manually if needed.

## Architecture and Flow

High-level:

- `Express` HTTP server with JSON body parsing and `express-fileupload` for multipart uploads
- Single `http.Server` hosting both HTTP and WebSocket (via `ws`)
- Controllers route requests, Services encapsulate integrations, `utils` provide cross-cutting helpers, and `types` centralize interfaces
- In-memory stores (Maps) for video metadata, transcription artifacts, and generation tasks (ephemeral by design for the assignment; easy to swap with a database later)

Key modules:

- `services/googleCloudService.ts`
  - Lazily initializes Storage, Speech-to-Text, and Text-to-Speech clients
  - Uploads files/buffers to GCS, issues signed URLs
  - Extracts WAV (mono, 16kHz) from video via FFmpeg for optimal STT accuracy
  - Runs long-running STT with robust fallback configs (LINEAR16 → FLAC → minimal)
  - Generates speech audio (MP3) for text + persona
- `services/vertexAiService.ts`
  - Generates a natural-language summary from full transcript text using Vertex AI (Gemini)
  - If Vertex is not configured/unavailable, controllers fall back to a simple heuristic summary
- `services/didService.ts` (optional)
  - Calls D‑ID REST API to create “talks” (either from uploaded audio via GCS signed URL or from text)
  - Polls until completion and uploads the result to GCS
- `utils/websocket.ts` – broadcast helper for consistent progress messages
- `utils/text.ts` – normalization/tokenization helpers and a simple extractive summarizer as fallback
- `utils/voice.ts` – persona-to-voice mapping for Google TTS

Data flows (end-to-end):

1) Upload → Transcribe → Summarize
   - Client uploads a video (`POST /api/video/upload`). The server stores the raw file in GCS and retains the original file reference temporarily for fast FFmpeg extraction.
   - Client starts transcription (`POST /api/transcription/start`) or the frontend auto-starts after upload. The server:
     - Extracts mono 16kHz WAV via FFmpeg and stores it in GCS
     - Issues an STT job (long-running recognize) against the GCS URL
     - Builds segments with start/end times and optional word timings
     - Produces a summary via Vertex AI, or a heuristic fallback
     - Broadcasts progress (`transcription_progress`) and completion (`transcription_complete`) over WebSocket
   - Client can fetch persisted results via `GET /api/transcription/:videoId`.

2) Navigation by seconds / phrase
   - By seconds: `POST /api/navigation/timestamp` returns a validated timestamp for the player to seek.
   - By phrase: `POST /api/navigation/phrase` normalizes user input, tokenizes, and searches across a flattened word timeline (spanning segments). It returns a best timestamp for the match, falling back to segment-level approximate position when word timings are missing.

3) Text → TTS → Video generation
   - Client requests generation (`POST /api/generation/create`) with text and persona.
   - Server generates TTS audio via Google, uploads audio to GCS, and composes a baseline MP4 from an image + audio using FFmpeg/Jimp (ensures success without external avatar providers).
   - If D‑ID is configured, the server attempts a higher-fidelity talking avatar video, downloading the result and storing it in GCS. If D‑ID fails/unavailable, the placeholder composition is returned.
   - Progress and completion are streamed via WebSocket (`generation_progress`, `generation_complete`). The result URLs may be signed on fetch from status endpoint.

## Endpoints

Base URL: `http://localhost:3001/api`

Video

- `POST /video/upload`
  - Multipart form-data with `video` field
  - Returns `{ success, videoId, filename, uploadUrl, message }`
- `GET /video/:videoId/status`
  - Returns stored metadata for the given video ID

Transcription

- `POST /transcription/start`
  - Body: `{ videoId: string, language?: string (default "en-US") }`
  - Starts async pipeline; progress via WebSocket; returns `{ success, message, videoId }`
- `GET /transcription/:videoId`
  - Returns `{ success, videoId, transcription: segments[], fullText, summary, message }`

Navigation

- `POST /navigation/timestamp`
  - Body: `{ timestamp: number }`
  - Returns `{ success, timestamp, message }`
- `POST /navigation/phrase`
  - Body: `{ videoId: string, phrase: string }`
  - Returns `{ success, timestamp, message, matchedText? }` or 404 if not found

Generation

- `POST /generation/create`
  - Body: `{ text: string, persona: { voice: "male"|"female", style: "professional"|"casual"|"energetic" } }`
  - Returns `{ success, generationId, message }`; progress via WebSocket
- `GET /generation/:generationId/status`
  - Returns `{ success, generationId, audioUrl?, videoUrl?, message }`

Health

- `GET /health` – returns server status, timestamp, and environment

## WebSocket

- URL: `ws://localhost:3001`
- Messages are JSON with shape: `{ type, data, timestamp }`
- Types:
  - `transcription_progress` → `{ videoId, progress, message }`
  - `transcription_complete` → `{ videoId, progress: 100, message, transcription }`
  - `generation_progress` → `{ generationId, progress, message }`
  - `generation_complete` → `{ generationId, progress: 100, message, audioUrl?, videoUrl? }`
  - `error` → `{ videoId?|generationId?, message, error? }`

## Operational Notes

- FFmpeg must be installed; verify with `ffmpeg -version`.
- The server keeps temporary files in the OS temp directory and cleans them up after use.
- In-memory stores (video metadata, transcription, generation) are ephemeral and will reset on server restart. For production, replace these Maps with a database or durable cache.
- Large media should not be proxied through the server. GCS signed URLs are used to allow clients and third-party services to access media directly for a bounded time.
- CORS is restricted to `FRONTEND_URL`. Set this to your frontend’s origin in deployments.

## Local Dev with Frontend

- Start backend: `npm run dev` (port `3001`)
- Start frontend (in `lingoPlay`): `npm run dev` (port `5173`)
- Ensure `FRONTEND_URL=http://localhost:5173` so CORS and cookies (if used later) work correctly.
- The frontend expects REST at `http://localhost:3001/api` and a WebSocket at `ws://localhost:3001`.

## Troubleshooting

- FFmpeg not found: install FFmpeg and ensure it is on PATH.
- Permission denied on GCS: verify service account role and `GOOGLE_CLOUD_KEY_FILE` path.
- STT fails intermittently: the backend automatically tries fallback configs (LINEAR16 → FLAC → minimal). Inspect logs for details.
- D‑ID errors/timeouts: the backend falls back to the placeholder composition. Check D‑ID credentials and the avatar image URL.
- CORS errors in the browser: set `FRONTEND_URL` to your frontend origin and restart the server.

## Tech Stack

- Node.js, Express, TypeScript
- `@google-cloud/storage`, `@google-cloud/speech`, `@google-cloud/text-to-speech`, `@google-cloud/vertexai`
- `ws` for WebSockets
- `express-fileupload` for uploads
- `fluent-ffmpeg` for media processing, `jimp` for image composition

## Project Structure

```
src/
  controllers/            # HTTP handlers (thin); emit progress over WebSocket
  routes/                 # Route registration per domain (video, transcription, ...)
  services/               # External integrations (GCS, STT/TTS, Vertex, D‑ID)
  utils/                  # Cross-cutting helpers (websocket, text, voice)
  types/                  # Shared TypeScript types (public API shapes, D‑ID)
  server.ts               # App bootstrap, middleware, WebSocket server
```

## Security and Privacy

- Do not commit your service account key or other secrets to version control.
- Prefer secret managers in production (GCP Secret Manager, Vault, etc.).
- Signed URLs are short-lived by design; adjust expiry window if needed.

## Future Hardening

- Replace in-memory Maps with a persistence layer (SQL/NoSQL) and/or object metadata
- Centralize structured logging and correlation IDs
- Background workers/queues for long-running jobs
- Rate limiting and authentication/authorization for endpoints

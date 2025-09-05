### LingoPlay Monorepo

LingoPlay is a video transcription, summarization, intelligent navigation, and synthetic video generation platform. This repository contains both the backend API and the React frontend in a single monorepo for streamlined development and deployment.

### Project documentation (READMEs)

- Backend README: [./lingoPlay-backend/README.md](./lingoPlay-backend/README.md)
- Frontend README: [./lingoPlay/README.md](./lingoPlay/README.md)

### Repository layout

```
lingo-play/
  lingoPlay-backend/     # Node.js + Express + TypeScript API server
  lingoPlay/             # React + TypeScript + Vite frontend
  assignment.txt         # Original assignment brief and requirements
```

### What LingoPlay delivers

- Upload a video, then automatically transcribe its audio (Speech‑to‑Text) and generate a readable summary.
- Navigate the video by entering seconds or searching for phrases; phrase search uses word timestamps when available.
- Generate a synthetic video from text and persona (male/female + professional/casual/energetic); baseline video is composed locally, with optional D‑ID talking avatar when configured.
- Real‑time progress for long‑running tasks via WebSocket (extraction → transcription → summarization, or TTS → video composition).

These features map 1:1 to the assignment requirements and are implemented with clean separation of concerns and production‑ready structure.

### Prerequisites

- Node.js 22+
- FFmpeg installed and on PATH (required by the backend for audio extraction and video composition)
- Google Cloud project and service account with access to a Storage bucket
  - Enabled APIs: Cloud Speech‑to‑Text, Cloud Text‑to‑Speech, Cloud Storage
- Optional (recommended): Google Vertex AI for high‑quality transcript summaries
- Optional: D‑ID account and avatar image URL(s) for talking avatar videos

### Environment configuration

Configure each app independently (see the app‑level READMEs for details). Typical `.env` values:

Backend (`lingoPlay-backend/.env`):

```
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_KEY_FILE=./google-cloud-key.json
GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name

# Vertex AI (optional, recommended)
VERTEX_LOCATION=us-central1
VERTEX_SUMMARY_MODEL=gemini-2.0-flash-lite-001

# D‑ID (optional)
DID_API_USERNAME=...
DID_API_PASSWORD=...
DID_AVATAR_IMAGE_URL=https://...
# or
DID_AVATAR_IMAGE_MALE_URL=https://...
DID_AVATAR_IMAGE_FEMALE_URL=https://...
DID_USE_TEXT=true
```

Frontend (`lingoPlay/.env`):

```
VITE_API_BASE_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
```

Notes:

- Ensure the backend `FRONTEND_URL` matches the frontend origin to satisfy CORS.
- Keep service account JSON keys out of version control; prefer secret managers in production.

### Local development

1) Install dependencies for both projects

```bash
cd lingoPlay-backend && npm install
cd ../lingoPlay && npm install
```

2) Configure environment files (`.env`) as above.

3) Start the backend

```bash
cd lingoPlay-backend
npm run dev
# Backend: http://localhost:3001, WebSocket: ws://localhost:3001
```

4) Start the frontend

```bash
cd ../lingoPlay
npm run dev
# Frontend: http://localhost:5173
```

### End‑to‑end user flow

- Upload a video (frontend left pane). The player previews from a local URL; the original uploads to the backend.
- The frontend auto‑starts transcription using the returned `videoId`. Progress arrives over WebSocket in phases (extract, transcribe, summarize), then transcription and summary render.
- Navigate by seconds or phrase (right‑middle pane). Phrase search snaps to the best matching timestamp via transcription word timings.
- Generate a video from text and a persona (right‑bottom pane). Progress is pushed over WebSocket; the result (audio/video) is playable and downloadable. If D‑ID is configured, a talking avatar is returned; otherwise a local placeholder composition is used.

### Build and production

- Backend
  - `npm run build && npm start` in `lingoPlay-backend`
  - Serve behind a reverse proxy (Nginx/Cloud Run/etc.). Ensure FFmpeg is available and GCP credentials are mounted securely.
  - Replace in‑memory stores with a database or durable cache for production persistence.
- Frontend
  - `npm run build` in `lingoPlay`
  - Host the static bundle on your preferred CDN/host; set `VITE_API_BASE_URL` and `VITE_WS_URL` to your backend origin, and configure backend `FRONTEND_URL` accordingly.

### Security and compliance

- Do not commit secrets (service account keys, API credentials). Use secret managers or platform‑native config.
- Signed URLs (GCS) are short‑lived to minimize exposure; adjust expirations as needed.
- In production, add authentication/authorization, rate limiting, and structured logging.

### Troubleshooting

- FFmpeg not found: install it and verify `ffmpeg -version` works on the host.
- CORS errors: ensure backend `FRONTEND_URL` matches the frontend origin.
- GCS permission errors: check service account roles and `GOOGLE_CLOUD_KEY_FILE` path.
- STT failures: the backend auto‑retries with fallback configs (LINEAR16 → FLAC → minimal). Inspect the backend logs.
- D‑ID timeouts: the backend falls back to a placeholder video; verify D‑ID credentials and avatar URL.

### Roadmap and hardening

- Persist state (video metadata, transcription, generation tasks) in a database
- Structured logs, metrics, and tracing; correlation IDs across requests and WS events
- Background workers/queues for long‑running jobs
- Authentication and RBAC

### License

MIT (see individual files and headers where applicable).



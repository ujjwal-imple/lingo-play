### LingoPlay Frontend (React + TypeScript + Vite)

This is the web frontend for LingoPlay, a video transcription, summarization, navigation, and synthetic video generation application. It provides a clean three-panel layout: a video player on the left, and on the right a stacked interface for transcription/summary, navigation (by seconds and phrase), and text-to-video generation with selectable personas.

### Prerequisites

Ensure the backend is running and accessible. The frontend expects the API at `VITE_API_BASE_URL` and the WebSocket server at `VITE_WS_URL`. You need:

- Node.js 22 or newer
- Backend server from `lingoPlay-backend` running (see its README)

### Quick start

1) Install dependencies

```bash
npm install
```

2) Configure environment variables (create `.env` in this directory)

```bash
# Frontend environment
VITE_API_BASE_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
```

3) Launch the dev server

```bash
npm run dev
```

4) Production build and preview

```bash
npm run build
npm run preview
```

### What the app does (aligned with the assignment)

This UI implements all the features requested:

- Video Player (Left Panel): upload, play, pause, and seek. The selected file is previewed immediately from a local URL while the original is uploaded to the backend.
- Transcription & Summary (Right Top): after upload, the app automatically triggers transcription. Real-time progress (extracting → transcribing → summarizing) arrives over WebSocket. When done, the transcription and an AI-generated summary are displayed.
- Navigation (Right Middle):
  - Go to Seconds: enter a number of seconds and navigate the video player.
  - Go to Phrase: search for a phrase; the backend locates it using word timestamps or a robust fallback, and the player seeks to that position.
- Video Generation (Right Bottom): enter text and select a persona (male/female voice; professional/casual/energetic style). The backend generates TTS and a baseline video; if D‑ID is configured it returns a talking avatar video. Progress/completion is shown and the resulting video/audio can be played or downloaded.

### How it works (frontend architecture)

- Top-level component `App.tsx` wires the layout, manages high-level state, connects to the WebSocket on mount, auto-starts transcription after a successful upload, and routes navigation events to the video player through a ref.
- Components:
  - `components/VideoPlayer/VideoPlayer.tsx`: handles file selection, upload to the backend, immediate local preview, basic playback controls, slider seek, and exposes an imperative `jumpToTime(seconds)` method for external navigation.
  - `components/TranscriptionSection/TranscriptionSection.tsx`: displays tabs for transcription and summary, handles optional manual “Start Transcription,” shows loading and error states.
  - `components/NavigationSection/NavigationSection.tsx`: provides “Go to Seconds” and “Go to Phrase,” validates inputs and calls the backend to resolve timestamps, then asks the player to seek.
  - `components/VideoGenerationSection/VideoGenerationSection.tsx`: collects user text and persona, starts generation, shows progress, polls status until the result URL is returned, and renders the video or audio with download buttons.
- Services and utilities:
  - `services/apiService.ts`: a small REST client. It uses centralized configuration from `utils/config.ts` so the API and WS URLs are environment-driven. It maintains the same API as before but delegates WebSocket lifecycle to `services/wsClient.ts` for clarity.
  - `services/wsClient.ts`: encapsulates the WebSocket connection, parsing messages and invoking callbacks provided by `App.tsx`.
  - `types/api.ts`: shared TypeScript interfaces for REST and WebSocket payloads (keeps types consistent across the app).
  - `utils/config.ts`: reads `VITE_API_BASE_URL` and `VITE_WS_URL` with sensible defaults.
  - `utils/time.ts`: contains `formatTime(seconds)` for player time display.
- Styling:
  - CSS Modules per component (for example, `VideoPlayer.module.css`) plus `App.module.css` for layout and `index.css` for global resets. The UI is intentionally clean and responsive.

### End-to-end flows

Upload → Transcribe → Summarize

- The user uploads a video in `VideoPlayer`. The component immediately sets a local object URL for seamless preview and sends the file to the backend. The backend responds with a `videoId` that the app stores.
- `App.tsx` detects the new `videoId` and automatically triggers `startTranscription(videoId)`. While the backend processes, the UI shows loading states.
- Backend progress messages (10% extract audio, 40% start STT, 75% summarize, 100% done) arrive over WebSocket. On completion, the app updates the transcription and summary views.

Navigate by seconds / phrase

- Go to Seconds: validate the input and call `/navigation/timestamp`; on success, directly seek the `VideoPlayer` using its imperative ref.
- Go to Phrase: ensure a transcription exists, call `/navigation/phrase` to resolve a timestamp, then seek the player. Results are shown to the user.

Text → TTS → Video generation

- The user enters text and selects a persona, then starts generation. The backend synthesizes speech and creates a baseline video (and optionally replaces it with a D‑ID talking avatar if configured). Progress is sent over WebSocket; the component also polls for status as a pragmatic fallback. When URLs are available, they are rendered and downloadable.

### Environment and configuration

- `VITE_API_BASE_URL` controls where REST calls are sent; default `http://localhost:3001/api`.
- `VITE_WS_URL` controls the WebSocket endpoint; default `ws://localhost:3001`.
- For production deployments, set these to your backend origin. Ensure the backend CORS `FRONTEND_URL` matches the frontend origin.

### Commands

- `npm run dev` – Vite dev server with React Fast Refresh.
- `npm run build` – type-checks and builds for production.
- `npm run preview` – serves the production build locally.
- `npm run lint` – runs ESLint with project rules.

### Troubleshooting

- Cannot connect to backend: verify `VITE_API_BASE_URL` and `VITE_WS_URL` match the backend host/port and protocol (http vs https; ws vs wss).
- CORS errors: set the backend’s `FRONTEND_URL` to this frontend’s origin and restart the server.
- Upload fails: ensure file size ≤ 500MB and the backend is up; check browser console for details.
- Transcription takes long: this is normal for long videos. Watch the progress in the console and UI.
- Generation times out: check backend logs; D‑ID may be unavailable. The app still shows a placeholder video if configured that way on the backend.

### Project structure

```
src/
  components/
    NavigationSection/
    TranscriptionSection/
    VideoGenerationSection/
    VideoPlayer/
  services/
    apiService.ts
    wsClient.ts
  types/
    api.ts
  utils/
    config.ts
    time.ts
  App.tsx
  main.tsx
```

### Accessibility and UX notes

- Buttons and inputs include accessible labels and aria attributes where appropriate; icons are marked `aria-hidden` when decorative.
- Time values are formatted for readability; key states (uploading, transcribing, generating) show clear progress indicators.
- The layout is responsive via CSS modules; feel free to add design tokens or a UI library if desired.
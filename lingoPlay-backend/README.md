# LingoPlay Backend API

Backend API for the LingoPlay video transcription and navigation application.

## Features

- **Video Upload**: Upload videos to Google Cloud Storage
- **Speech-to-Text**: Transcribe video audio using Google Cloud Speech API
- **Text Summarization**: Generate summaries of transcriptions
- **Smart Navigation**: Navigate by timestamp or phrase search
- **Video Generation**: Create synthetic videos with Text-to-Speech
- **Real-time Updates**: WebSocket support for progress notifications

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Google Cloud Configuration

1. Create a Google Cloud project
2. Enable the following APIs:
   - Cloud Speech-to-Text API
   - Cloud Text-to-Speech API
   - Cloud Storage API
3. Create a service account and download the JSON key file
4. Create a Cloud Storage bucket

### 3. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Update the `.env` file with your values:

```env
# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_KEY_FILE=path/to/service-account-key.json
GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name

# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### 4. Start the Server

Development mode:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm start
```

## API Endpoints

### Video Upload

- `POST /api/video/upload` - Upload video file
- `GET /api/video/:videoId/status` - Get video status

### Transcription

- `POST /api/transcription/start` - Start transcription process
- `GET /api/transcription/:videoId` - Get transcription results

### Navigation

- `POST /api/navigation/timestamp` - Navigate to timestamp
- `POST /api/navigation/phrase` - Find phrase and get timestamp

### Video Generation

- `POST /api/generation/create` - Generate video from text
- `GET /api/generation/:generationId/status` - Get generation status

### Health Check

- `GET /api/health` - Server health status

## WebSocket Events

The server provides real-time updates via WebSocket:

- `transcription_progress` - Transcription progress updates
- `transcription_complete` - Transcription completed
- `generation_progress` - Video generation progress
- `generation_complete` - Video generation completed
- `error` - Error notifications

## Project Structure

```
src/
├── controllers/         # Request handlers
├── routes/             # Route definitions
├── services/           # Google Cloud services
├── types/              # TypeScript type definitions
├── middleware/         # Express middleware
├── utils/              # Utility functions
└── server.ts           # Main server file
```

## Technologies Used

- Node.js & Express
- TypeScript
- Google Cloud APIs (Speech-to-Text, Text-to-Speech, Storage)
- WebSockets for real-time communication
- Express File Upload for handling video uploads

## Development

The server uses nodemon for development with automatic restart on file changes.

```bash
npm run dev
```

## Error Handling

All endpoints include proper error handling and return consistent JSON responses. WebSocket connections handle reconnection and error states gracefully.

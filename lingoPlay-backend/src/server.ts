import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fileUpload from "express-fileupload";
import { WebSocketServer } from "ws";
import { createServer } from "http";

// Import routes
import videoRoutes from "./routes/videoRoutes";
import transcriptionRoutes from "./routes/transcriptionRoutes";
import navigationRoutes from "./routes/navigationRoutes";
import generationRoutes from "./routes/generationRoutes";
import { setWsConnections } from "./utils/websocket";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server for WebSocket support
const server = createServer(app);

// Initialize WebSocket server
const wss = new WebSocketServer({ server });

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// File upload middleware
app.use(
  fileUpload({
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
    useTempFiles: true,
    tempFileDir: "/tmp/",
    createParentPath: true,
  })
);

// Store WebSocket connections for real-time updates
export const wsConnections = new Set<any>();
setWsConnections(wsConnections);

wss.on("connection", (ws) => {
  console.log("WebSocket client connected");
  wsConnections.add(ws);

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
    wsConnections.delete(ws);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    wsConnections.delete(ws);
  });
});

// Routes
app.use("/api/video", videoRoutes);
app.use("/api/transcription", transcriptionRoutes);
app.use("/api/navigation", navigationRoutes);
app.use("/api/generation", generationRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Error handling middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 LingoPlay Backend running on port ${PORT}`);
  console.log(
    `📱 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`
  );
  console.log(`🌐 WebSocket server ready for real-time updates`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

export default app;

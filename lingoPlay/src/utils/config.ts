// Centralized frontend configuration (API base, WS URL)

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:3001/api";
const WS_URL = (import.meta as any).env?.VITE_WS_URL || "ws://localhost:3001";

export const config = {
  apiBaseUrl: API_BASE_URL,
  wsUrl: WS_URL,
};

export default config;



import { WebSocketMessage } from "../types";

// Decouple from server import to avoid circular imports in tests.
// Server should call setWsConnections with its live set.
let connectionsRef: Set<any> | null = null;

export const setWsConnections = (set: Set<any>) => {
  connectionsRef = set;
};

export const broadcastMessage = (message: WebSocketMessage): void => {
  if (!connectionsRef || connectionsRef.size === 0) return; // no-op in tests
  const payload = JSON.stringify(message);
  connectionsRef.forEach((ws: any) => {
    try {
      if (ws.readyState === 1) {
        ws.send(payload);
      }
    } catch {}
  });
};

export default broadcastMessage;


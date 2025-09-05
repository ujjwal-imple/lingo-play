import { WebSocketMessage } from "../types";
import { wsConnections } from "../server";

export const broadcastMessage = (message: WebSocketMessage): void => {
  const payload = JSON.stringify(message);
  wsConnections.forEach((ws: any) => {
    try {
      if (ws.readyState === 1) {
        ws.send(payload);
      }
    } catch {}
  });
};

export default broadcastMessage;



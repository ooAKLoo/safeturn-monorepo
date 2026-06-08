import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";
import type { SafeTurnStore } from "./store.js";

interface RealtimeMessage {
  type: "snapshot" | "telemetry" | "alarm" | "command_ack";
  payload: unknown;
}

export function attachRealtimeServer(server: Server, store: SafeTurnStore) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  const send = (client: WebSocket, message: RealtimeMessage) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(message));
    }
  };

  const broadcast = (message: RealtimeMessage) => {
    for (const client of wss.clients) {
      send(client, message);
    }
  };

  wss.on("connection", (client) => {
    send(client, { type: "snapshot", payload: store.snapshot() });
  });

  store.on("change", (snapshot) => broadcast({ type: "snapshot", payload: snapshot }));
  store.on("telemetry", (telemetry) => broadcast({ type: "telemetry", payload: telemetry }));
  store.on("alarm", (alarm) => broadcast({ type: "alarm", payload: alarm }));
  store.on("command_ack", (ack) => broadcast({ type: "command_ack", payload: ack }));

  return wss;
}

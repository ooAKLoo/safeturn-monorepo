import type { ApiEnvelope, CommandAck, Device, LightCommand, RealtimeSnapshot } from "@safeturn/shared";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";
export const WS_BASE = API_BASE.replace(/^http/, "ws");

export async function fetchSnapshot() {
  const response = await fetch(`${API_BASE}/api/snapshot`);
  const json = (await response.json()) as ApiEnvelope<RealtimeSnapshot>;
  return json.data;
}

export async function sendLightCommand(deviceId: string, command: LightCommand, brightness?: number) {
  const response = await fetch(`${API_BASE}/api/devices/${deviceId}/commands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, brightness })
  });
  const json = (await response.json()) as ApiEnvelope<CommandAck>;
  return json.data;
}

export async function triggerSos(deviceId: string) {
  const response = await fetch(`${API_BASE}/api/alarms/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, source: "app_sos", level: "critical", impactG: 5.8 })
  });
  return response.json();
}

export function useDeviceFromSnapshot(snapshot: RealtimeSnapshot | null, deviceId: string): Device | undefined {
  return snapshot?.devices.find((device) => device.id === deviceId) ?? snapshot?.devices[0];
}

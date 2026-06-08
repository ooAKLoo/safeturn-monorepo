import type { ApiEnvelope, RealtimeSnapshot } from "@safeturn/shared";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";
export const WS_BASE = API_BASE.replace(/^http/, "ws");

export async function fetchSnapshot() {
  const response = await fetch(`${API_BASE}/api/snapshot`);
  if (!response.ok) {
    throw new Error(`Snapshot request failed: ${response.status}`);
  }
  const json = (await response.json()) as ApiEnvelope<RealtimeSnapshot>;
  return json.data;
}

export async function resolveAlarm(alarmId: string) {
  const response = await fetch(`${API_BASE}/api/alarms/${alarmId}/resolve`, { method: "POST" });
  if (!response.ok) {
    throw new Error(`Resolve alarm failed: ${response.status}`);
  }
  return response.json();
}

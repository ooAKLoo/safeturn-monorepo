import { publicServerBaseUrl, type ApiEnvelope, type RealtimeSnapshot } from "@safeturn/shared";

const configuredApiBase = import.meta.env.VITE_API_BASE?.trim();

export const API_BASE = configuredApiBase || (import.meta.env.DEV ? "" : publicServerBaseUrl);
export const WS_BASE = configuredApiBase
  ? configuredApiBase.replace(/^http/, "ws")
  : import.meta.env.DEV
    ? window.location.origin.replace(/^http/, "ws")
    : publicServerBaseUrl.replace(/^http/, "ws");

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

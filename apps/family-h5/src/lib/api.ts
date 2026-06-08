import type { AlarmRecord, ApiEnvelope, RealtimeSnapshot } from "@safeturn/shared";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export async function fetchLatestAlarm(alarmId?: string) {
  if (alarmId) {
    const response = await fetch(`${API_BASE}/api/alarms/${alarmId}`);
    const json = (await response.json()) as ApiEnvelope<AlarmRecord>;
    return json.data;
  }

  const response = await fetch(`${API_BASE}/api/snapshot`);
  const json = (await response.json()) as ApiEnvelope<RealtimeSnapshot>;
  return json.data.alarms[0];
}

export async function resolveAlarm(alarmId: string) {
  const response = await fetch(`${API_BASE}/api/alarms/${alarmId}/resolve`, { method: "POST" });
  const json = (await response.json()) as ApiEnvelope<AlarmRecord>;
  return json.data;
}

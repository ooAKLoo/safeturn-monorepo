import mqtt from "mqtt";
import { mqttTopics } from "@safeturn/shared";
import type { AlarmTriggerRequest, TelemetryIngestRequest } from "@safeturn/shared";
import type { SafeTurnStore } from "./store.js";

export function attachMqttBridge(store: SafeTurnStore) {
  const mqttUrl = process.env.MQTT_URL;
  if (!mqttUrl) {
    return undefined;
  }

  const client = mqtt.connect(mqttUrl, {
    clientId: `safeturn_server_${Math.random().toString(16).slice(2)}`,
    reconnectPeriod: 3000
  });

  client.on("connect", () => {
    client.subscribe(["helmet/+/telemetry", "helmet/+/alarm", "helmet/+/event", "helmet/+/command_ack"]);
  });

  client.on("message", (topic, rawPayload) => {
    const [, deviceId, channel] = topic.split("/");
    if (!deviceId || !channel) {
      return;
    }

    try {
      const payload = JSON.parse(rawPayload.toString()) as TelemetryIngestRequest | AlarmTriggerRequest;
      if (channel === "telemetry") {
        store.ingestTelemetry(deviceId, { ...payload, deviceId } as TelemetryIngestRequest);
      }
      if (channel === "alarm") {
        store.triggerAlarm({ deviceId, source: "helmet_fall", ...(payload as Partial<AlarmTriggerRequest>) });
      }
    } catch (error) {
      console.warn(`[mqtt] failed to parse ${topic}:`, error);
    }
  });

  store.on("command", (message) => {
    const command = message as { deviceId: string; payload: unknown };
    client.publish(mqttTopics.command(command.deviceId), JSON.stringify(command.payload), { qos: 1 });
  });

  return client;
}

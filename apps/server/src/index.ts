import http from "node:http";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { apiRoutes } from "@safeturn/shared";
import type { AlarmStatus, AlarmTriggerRequest, DeviceCommandRequest, DeviceConfigRequest, TelemetryIngestRequest } from "@safeturn/shared";
import { attachMqttBridge } from "./mqttBridge.js";
import { attachRealtimeServer } from "./realtime.js";
import { createStore } from "./store.js";

const app = express();
const server = http.createServer(app);
const store = createStore();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const ok = <T>(res: Response, data: T) => res.json({ data, requestId: store.getRequestId() });

app.get(apiRoutes.health, (_req, res) => {
  ok(res, {
    service: "safeturn-server",
    status: "ok",
    timestamp: new Date().toISOString(),
    websocket: "/ws",
    mqtt: Boolean(process.env.MQTT_URL)
  });
});

app.get(apiRoutes.snapshot, (_req, res) => ok(res, store.snapshot()));
app.get(apiRoutes.devices, (_req, res) => ok(res, store.listDevices()));

app.get("/api/devices/:deviceId", (req, res) => {
  const device = store.getDevice(req.params.deviceId);
  if (!device) {
    res.status(404).json({ error: "DEVICE_NOT_FOUND", requestId: store.getRequestId() });
    return;
  }
  ok(res, device);
});

app.post("/api/devices/:deviceId/telemetry", (req, res) => {
  const telemetry = store.ingestTelemetry(req.params.deviceId, req.body as TelemetryIngestRequest);
  ok(res, telemetry);
});

app.post("/api/devices/:deviceId/commands", (req, res) => {
  const ack = store.sendCommand(req.params.deviceId, req.body as DeviceCommandRequest);
  ok(res, ack);
});

app.patch("/api/devices/:deviceId/config", (req, res) => {
  const ack = store.updateConfig(req.params.deviceId, req.body as DeviceConfigRequest);
  ok(res, ack);
});

app.get(apiRoutes.alarms, (req, res) => {
  const status = req.query.status as AlarmStatus | undefined;
  const alarms = status ? store.listAlarms().filter((alarm) => alarm.status === status) : store.listAlarms();
  ok(res, alarms);
});

app.get("/api/alarms/:alarmId", (req, res) => {
  const alarm = store.getAlarm(req.params.alarmId);
  if (!alarm) {
    res.status(404).json({ error: "ALARM_NOT_FOUND", requestId: store.getRequestId() });
    return;
  }
  ok(res, alarm);
});

app.post(apiRoutes.triggerAlarm, (req, res) => {
  const alarm = store.triggerAlarm(req.body as AlarmTriggerRequest);
  ok(res, alarm);
});

app.post("/api/alarms/:alarmId/resolve", (req, res) => {
  const alarm = store.resolveAlarm(req.params.alarmId, "resolved");
  ok(res, alarm);
});

app.get(apiRoutes.rides, (req, res) => {
  ok(res, store.listRides(req.query.deviceId as string | undefined));
});

app.post("/api/simulator/tick", (_req, res) => {
  store.tickTelemetry();
  ok(res, store.snapshot());
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(400).json({
    error: "SAFE_TURN_API_ERROR",
    message: error.message,
    requestId: store.getRequestId()
  });
});

attachRealtimeServer(server, store);
attachMqttBridge(store);

setInterval(() => {
  store.tickTelemetry();
}, Number(process.env.SIMULATOR_INTERVAL_MS ?? 3000));

server.listen(port, () => {
  console.log(`SafeTurn server listening on http://localhost:${port}`);
});

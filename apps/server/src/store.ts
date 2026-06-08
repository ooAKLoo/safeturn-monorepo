import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type {
  AlarmRecord,
  AlarmStatus,
  AlarmTriggerRequest,
  CommandAck,
  Device,
  DeviceCommandRequest,
  DeviceConfigRequest,
  RealtimeSnapshot,
  RideSummary,
  TelemetryIngestRequest,
  TelemetryPayload,
  TrackPoint
} from "@safeturn/shared";

type StoreEvents = "change" | "telemetry" | "alarm" | "command" | "command_ack";

const FUZHOU = { lat: 26.0821, lng: 119.2965 };
const now = () => new Date().toISOString();
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const jitter = (value: number, amount: number) => Number((value + (Math.random() - 0.5) * amount).toFixed(6));
const requestId = () => `req_${randomUUID().slice(0, 8)}`;

export class SafeTurnStore extends EventEmitter {
  private devices = new Map<string, Device>();
  private alarms: AlarmRecord[] = [];
  private rides: RideSummary[] = [];
  private configs = new Map<string, DeviceConfigRequest>();

  constructor() {
    super();
    this.seed();
  }

  override emit(eventName: StoreEvents, ...args: unknown[]): boolean {
    return super.emit(eventName, ...args);
  }

  override on(eventName: StoreEvents, listener: (...args: unknown[]) => void): this {
    return super.on(eventName, listener);
  }

  getRequestId() {
    return requestId();
  }

  listDevices() {
    return [...this.devices.values()];
  }

  getDevice(deviceId: string) {
    return this.devices.get(deviceId);
  }

  listAlarms() {
    return [...this.alarms].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  }

  getAlarm(alarmId: string) {
    return this.alarms.find((alarm) => alarm.id === alarmId || alarm.alarmNo === alarmId);
  }

  listRides(deviceId?: string) {
    return this.rides.filter((ride) => !deviceId || ride.deviceId === deviceId);
  }

  snapshot(): RealtimeSnapshot {
    const devices = this.listDevices();
    const alarms = this.listAlarms();
    return {
      stats: {
        onlineDevices: devices.filter((device) => device.onlineStatus === "online").length,
        todayDistanceKm: Number(this.rides.reduce((sum, ride) => sum + ride.distanceKm, 0).toFixed(1)),
        todayAlarmCount: alarms.filter((alarm) => isToday(alarm.occurredAt)).length,
        activeSosCount: alarms.filter((alarm) => alarm.type === "sos" && alarm.status !== "resolved").length,
        batteryBuckets: [
          { label: "0-30%", value: devices.filter((device) => device.battery <= 30).length },
          { label: "31-70%", value: devices.filter((device) => device.battery > 30 && device.battery <= 70).length },
          { label: "71-100%", value: devices.filter((device) => device.battery > 70).length }
        ]
      },
      devices,
      alarms,
      latestTelemetry: devices.map((device) => device.telemetry),
      tracks: this.rides
    };
  }

  ingestTelemetry(deviceId: string, payload: TelemetryIngestRequest) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    const previous = device.telemetry;
    const telemetry: TelemetryPayload = {
      ...previous,
      ...payload,
      deviceId,
      riderName: payload.riderName ?? previous.riderName,
      location: payload.location ?? previous.location,
      battery: clamp(payload.battery ?? previous.battery, 0, 100),
      timestamp: payload.timestamp ?? now()
    };

    device.telemetry = telemetry;
    device.battery = telemetry.battery;
    device.onlineStatus = telemetry.fourGSignal === "offline" ? "offline" : "online";
    device.lastSeenAt = telemetry.timestamp;
    this.devices.set(deviceId, device);

    const ride = this.rides.find((item) => item.deviceId === deviceId);
    if (ride) {
      ride.points.push({
        id: `tp_${randomUUID().slice(0, 8)}`,
        deviceId,
        timestamp: telemetry.timestamp,
        location: telemetry.location,
        speedKmh: telemetry.speedKmh,
        altitudeM: telemetry.altitudeM,
        impactG: telemetry.impactG,
        eventType: telemetry.impactG >= 2.2 ? "impact" : undefined
      });
      if (ride.points.length > 80) {
        ride.points.splice(0, ride.points.length - 80);
      }
    }

    this.emit("telemetry", telemetry);
    this.emit("change", this.snapshot());
    return telemetry;
  }

  triggerAlarm(input: AlarmTriggerRequest) {
    const device = this.devices.get(input.deviceId);
    if (!device) {
      throw new Error(`Device ${input.deviceId} not found`);
    }

    const level = input.level ?? (input.source === "helmet_fall" ? "critical" : "high");
    const impactG = Number((input.impactG ?? Math.max(device.telemetry.impactG, 5.8)).toFixed(1));
    const alarm: AlarmRecord = {
      id: `alarm_${randomUUID().slice(0, 10)}`,
      alarmNo: `ALM-${new Date().getFullYear()}-${String(this.alarms.length + 1).padStart(5, "0")}`,
      deviceId: device.id,
      deviceSn: device.sn,
      riderName: device.riderName,
      type: input.source === "app_sos" || input.source === "helmet_button" || input.source === "voice_help" ? "sos" : "fall",
      level,
      source: input.source,
      impactG,
      location: device.telemetry.location,
      address: "福建省福州市 xx 区 xxx 路附近",
      occurredAt: now(),
      battery: device.telemetry.battery,
      temperatureC: device.telemetry.temperatureC,
      humidityPct: device.telemetry.humidityPct,
      altitudeM: device.telemetry.altitudeM,
      status: "pending",
      contactNotifyStatus: "sent"
    };

    device.telemetry = {
      ...device.telemetry,
      helmetStatus: "sos",
      impactG,
      timestamp: alarm.occurredAt
    };
    device.lastSeenAt = alarm.occurredAt;
    this.devices.set(device.id, device);
    this.alarms.unshift(alarm);

    const ride = this.rides.find((item) => item.deviceId === device.id);
    ride?.points.push({
      id: `tp_${randomUUID().slice(0, 8)}`,
      deviceId: device.id,
      timestamp: alarm.occurredAt,
      location: alarm.location,
      speedKmh: device.telemetry.speedKmh,
      altitudeM: alarm.altitudeM,
      impactG,
      eventType: alarm.type
    });

    this.emit("alarm", alarm);
    this.emit("change", this.snapshot());
    return alarm;
  }

  resolveAlarm(alarmId: string, status: AlarmStatus = "resolved") {
    const alarm = this.getAlarm(alarmId);
    if (!alarm) {
      throw new Error(`Alarm ${alarmId} not found`);
    }
    alarm.status = status;
    alarm.handledAt = now();
    this.emit("change", this.snapshot());
    return alarm;
  }

  sendCommand(deviceId: string, payload: DeviceCommandRequest): CommandAck {
    if (!this.devices.has(deviceId)) {
      throw new Error(`Device ${deviceId} not found`);
    }
    const ack: CommandAck = {
      deviceId,
      command: payload.command,
      success: true,
      message: `已下发 ${payload.command}${payload.brightness ? `，亮度 ${payload.brightness}%` : ""}`,
      timestamp: now()
    };
    this.emit("command", { deviceId, payload });
    this.emit("command_ack", ack);
    return ack;
  }

  updateConfig(deviceId: string, payload: DeviceConfigRequest): CommandAck {
    if (!this.devices.has(deviceId)) {
      throw new Error(`Device ${deviceId} not found`);
    }
    this.configs.set(deviceId, { ...this.configs.get(deviceId), ...payload });
    const ack: CommandAck = {
      deviceId,
      command: "CONFIG",
      success: true,
      message: "设备配置已保存并等待头盔确认",
      timestamp: now()
    };
    this.emit("command", { deviceId, payload: { command: "CONFIG", config: payload } });
    this.emit("command_ack", ack);
    return ack;
  }

  tickTelemetry() {
    for (const device of this.devices.values()) {
      if (device.onlineStatus === "offline") {
        continue;
      }
      const heading = device.telemetry.yaw + (Math.random() - 0.48) * 8;
      const speed = clamp(device.telemetry.speedKmh + (Math.random() - 0.45) * 2, 8, 32);
      this.ingestTelemetry(device.id, {
        location: {
          lat: jitter(device.telemetry.location.lat, 0.0012),
          lng: jitter(device.telemetry.location.lng, 0.0012)
        },
        speedKmh: Number(speed.toFixed(1)),
        battery: Number(clamp(device.telemetry.battery - Math.random() * 0.15, 8, 100).toFixed(0)),
        altitudeM: Number((device.telemetry.altitudeM + (Math.random() - 0.45) * 2).toFixed(1)),
        ambientLightLux: Math.round(clamp(device.telemetry.ambientLightLux + (Math.random() - 0.5) * 12, 20, 360)),
        impactG: Number(clamp(0.7 + Math.random() * 1.5, 0.5, 2.8).toFixed(1)),
        roll: Number((Math.sin(Date.now() / 9000) * 8).toFixed(1)),
        pitch: Number((Math.cos(Date.now() / 10000) * 6).toFixed(1)),
        yaw: Number((heading % 360).toFixed(1)),
        helmetStatus: Math.random() > 0.94 ? "impact" : "normal",
        timestamp: now()
      });
    }
  }

  private seed() {
    const baseDevices: Array<Pick<Device, "id" | "sn" | "name" | "riderName" | "bluetoothMac" | "imei" | "simStatus" | "firmwareVersion"> & { offset: number; battery: number; status?: "online" | "offline" }> = [
      { id: "ST-0001", sn: "ST20240524001", name: "SafeTurn-001", riderName: "张三", bluetoothMac: "A4:C1:38:10:90:01", imei: "864812060000001", simStatus: "active", firmwareVersion: "v1.2.3", offset: 0, battery: 78 },
      { id: "ST-0002", sn: "ST20240524002", name: "SafeTurn-002", riderName: "李四", bluetoothMac: "A4:C1:38:10:90:02", imei: "864812060000002", simStatus: "active", firmwareVersion: "v1.2.1", offset: 0.009, battery: 63 },
      { id: "ST-0003", sn: "ST20240524003", name: "SafeTurn-003", riderName: "王五", bluetoothMac: "A4:C1:38:10:90:03", imei: "864812060000003", simStatus: "active", firmwareVersion: "v1.1.9", offset: -0.011, battery: 92 },
      { id: "ST-0004", sn: "ST20240524004", name: "SafeTurn-004", riderName: "赵六", bluetoothMac: "A4:C1:38:10:90:04", imei: "864812060000004", simStatus: "inactive", firmwareVersion: "v1.1.0", offset: 0.018, battery: 21, status: "offline" }
    ];

    baseDevices.forEach((item, index) => {
      const telemetry: TelemetryPayload = {
        deviceId: item.id,
        riderName: item.riderName,
        battery: item.battery,
        fourGSignal: item.status === "offline" ? "offline" : index === 1 ? "medium" : "strong",
        gpsStatus: item.status === "offline" ? "lost" : "fixed",
        location: { lat: FUZHOU.lat + item.offset, lng: FUZHOU.lng + item.offset * 0.7 },
        speedKmh: item.status === "offline" ? 0 : 18.5 + index * 2.3,
        satelliteCount: item.status === "offline" ? 0 : 12 - index,
        altitudeM: 45.2 + index * 8,
        pressureHpa: 1008.2 - index,
        temperatureC: 28.5 + index,
        humidityPct: 60 - index * 4,
        ambientLightLux: 120 + index * 35,
        impactG: 0.8 + index * 0.3,
        roll: 1.2 + index,
        pitch: 2.8 - index * 0.4,
        yaw: 120 + index * 30,
        helmetStatus: "normal",
        timestamp: now()
      };

      const device: Device = {
        ...item,
        battery: item.battery,
        onlineStatus: item.status ?? "online",
        lastSeenAt: now(),
        telemetry
      };
      this.devices.set(item.id, device);
      this.rides.push(makeRide(item.id, index));
    });

    this.alarms = [
      makeAlarm(1, this.devices.get("ST-0001")!, "fall", "critical", "pending", 5.8),
      makeAlarm(2, this.devices.get("ST-0002")!, "impact", "medium", "notified", 2.6),
      makeAlarm(3, this.devices.get("ST-0003")!, "abnormal_posture", "low", "resolved", 1.8)
    ];
  }
}

function makeRide(deviceId: string, index: number): RideSummary {
  const points: TrackPoint[] = Array.from({ length: 28 }).map((_, pointIndex) => ({
    id: `tp_${deviceId}_${pointIndex}`,
    deviceId,
    timestamp: new Date(Date.now() - (28 - pointIndex) * 90_000).toISOString(),
    location: {
      lat: FUZHOU.lat + index * 0.008 + pointIndex * 0.00045,
      lng: FUZHOU.lng + index * 0.005 + Math.sin(pointIndex / 3) * 0.004
    },
    speedKmh: Number((14 + Math.sin(pointIndex / 3) * 5 + index).toFixed(1)),
    altitudeM: Number((32 + pointIndex * 1.2 + Math.cos(pointIndex / 4) * 8).toFixed(1)),
    impactG: pointIndex === 18 && index === 0 ? 5.8 : Number((0.8 + Math.random() * 1.2).toFixed(1)),
    eventType: pointIndex === 18 && index === 0 ? "fall" : pointIndex === 11 && index === 1 ? "impact" : pointIndex === 7 && index === 2 ? "brake" : undefined
  }));

  return {
    id: `ride_${deviceId}`,
    deviceId,
    date: new Date().toISOString().slice(0, 10),
    startAddress: "福建省福州市鼓楼区起点",
    endAddress: "福建省福州市台江区终点",
    distanceKm: Number((18.4 + index * 6.1).toFixed(1)),
    averageSpeedKmh: Number((17.8 + index).toFixed(1)),
    maxSpeedKmh: Number((31.2 + index * 2).toFixed(1)),
    elevationGainM: 86 + index * 34,
    points
  };
}

function makeAlarm(
  sequence: number,
  device: Device,
  type: AlarmRecord["type"],
  level: AlarmRecord["level"],
  status: AlarmRecord["status"],
  impactG: number
): AlarmRecord {
  return {
    id: `alarm_seed_${sequence}`,
    alarmNo: `ALM-${new Date().getFullYear()}-${String(sequence).padStart(5, "0")}`,
    deviceId: device.id,
    deviceSn: device.sn,
    riderName: device.riderName,
    type,
    level,
    source: type === "fall" ? "helmet_fall" : "app_sos",
    impactG,
    location: device.telemetry.location,
    address: "福建省福州市 xx 区 xxx 路附近",
    occurredAt: new Date(Date.now() - sequence * 52 * 60_000).toISOString(),
    battery: device.battery,
    temperatureC: device.telemetry.temperatureC,
    humidityPct: device.telemetry.humidityPct,
    altitudeM: device.telemetry.altitudeM,
    status,
    contactNotifyStatus: status === "pending" ? "waiting" : "sent",
    handledAt: status === "resolved" ? new Date(Date.now() - sequence * 34 * 60_000).toISOString() : undefined
  };
}

function isToday(timestamp: string) {
  const date = new Date(timestamp);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export function createStore() {
  return new SafeTurnStore();
}

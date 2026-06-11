export type DeviceOnlineStatus = "online" | "offline";
export type GpsStatus = "fixed" | "searching" | "lost";
export type FourGSignal = "strong" | "medium" | "weak" | "offline";
export type HelmetStatus = "normal" | "impact" | "fall_suspected" | "sos";
export type AlarmType = "fall" | "sos" | "impact" | "abnormal_posture";
export type AlarmLevel = "low" | "medium" | "high" | "critical";
export type AlarmStatus = "pending" | "notified" | "rider_cancelled" | "resolved";
export type LightCommand = "LEFT" | "RIGHT" | "DOUBLE" | "STOP" | "SOS" | "CANCEL";
export type AlarmSource = "helmet_fall" | "app_sos" | "helmet_button" | "voice_help";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface TelemetryPayload {
  deviceId: string;
  riderName: string;
  battery: number;
  fourGSignal: FourGSignal;
  gpsStatus: GpsStatus;
  location: Coordinates;
  speedKmh: number;
  satelliteCount: number;
  altitudeM: number;
  pressureHpa: number;
  temperatureC: number;
  humidityPct: number;
  ambientLightLux: number;
  impactG: number;
  roll: number;
  pitch: number;
  yaw: number;
  helmetStatus: HelmetStatus;
  timestamp: string;
}

export interface Device {
  id: string;
  sn: string;
  name: string;
  riderName: string;
  bluetoothMac: string;
  imei: string;
  simStatus: "active" | "inactive" | "unknown";
  firmwareVersion: string;
  battery: number;
  onlineStatus: DeviceOnlineStatus;
  lastSeenAt: string;
  telemetry: TelemetryPayload;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
  priority: 1 | 2 | 3;
  smsEnabled: boolean;
}

export interface AlarmRecord {
  id: string;
  alarmNo: string;
  deviceId: string;
  deviceSn: string;
  riderName: string;
  type: AlarmType;
  level: AlarmLevel;
  source: AlarmSource;
  impactG: number;
  location: Coordinates;
  address: string;
  occurredAt: string;
  battery: number;
  temperatureC: number;
  humidityPct: number;
  altitudeM: number;
  status: AlarmStatus;
  contactNotifyStatus: "waiting" | "sent" | "failed";
  handledAt?: string;
}

export interface TrackPoint {
  id: string;
  deviceId: string;
  timestamp: string;
  location: Coordinates;
  speedKmh: number;
  altitudeM: number;
  impactG: number;
  eventType?: AlarmType | "brake";
}

export interface RideSummary {
  id: string;
  deviceId: string;
  date: string;
  startAddress: string;
  endAddress: string;
  distanceKm: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
  elevationGainM: number;
  points: TrackPoint[];
}

export interface DashboardStats {
  onlineDevices: number;
  todayDistanceKm: number;
  todayAlarmCount: number;
  activeSosCount: number;
  batteryBuckets: Array<{ label: string; value: number }>;
}

export interface CommandAck {
  deviceId: string;
  command: LightCommand | "CONFIG";
  success: boolean;
  message: string;
  timestamp: string;
}

export interface ApiEnvelope<T> {
  data: T;
  requestId: string;
}

export interface RealtimeSnapshot {
  stats: DashboardStats;
  devices: Device[];
  alarms: AlarmRecord[];
  latestTelemetry: TelemetryPayload[];
  tracks: RideSummary[];
}

export interface AlarmTriggerRequest {
  deviceId: string;
  source: AlarmSource;
  level?: AlarmLevel;
  impactG?: number;
}

export interface TelemetryIngestRequest extends Partial<TelemetryPayload> {
  deviceId?: string;
}

export interface DeviceCommandRequest {
  command: LightCommand;
  brightness?: number;
}

export interface DeviceConfigRequest {
  fallSensitivity?: "low" | "medium" | "high";
  autoAlarmCountdownSec?: 10 | 15 | 30;
  nightAutoLight?: boolean;
  turnPromptDistanceM?: 30 | 50 | 80;
  sosSmsEnabled?: boolean;
  alarmSoundEnabled?: boolean;
  vibrationEnabled?: boolean;
}

export const publicServerBaseUrl = "http://120.55.195.100:4000";

export const mqttTopics = {
  telemetry: (deviceId: string) => `helmet/${deviceId}/telemetry`,
  alarm: (deviceId: string) => `helmet/${deviceId}/alarm`,
  event: (deviceId: string) => `helmet/${deviceId}/event`,
  command: (deviceId: string) => `helmet/${deviceId}/command`,
  commandAck: (deviceId: string) => `helmet/${deviceId}/command_ack`
};

export const apiRoutes = {
  health: "/health",
  snapshot: "/api/snapshot",
  devices: "/api/devices",
  alarms: "/api/alarms",
  rides: "/api/rides",
  telemetry: (deviceId: string) => `/api/devices/${deviceId}/telemetry`,
  command: (deviceId: string) => `/api/devices/${deviceId}/commands`,
  config: (deviceId: string) => `/api/devices/${deviceId}/config`,
  triggerAlarm: "/api/alarms/trigger",
  resolveAlarm: (alarmId: string) => `/api/alarms/${alarmId}/resolve`
};

import { AlertTriangle, Bike, CircleDot, MapPin } from "lucide-react";
import type { AlarmRecord, Device, RideSummary } from "@safeturn/shared";

interface LiveMapProps {
  devices: Device[];
  alarms: AlarmRecord[];
  tracks: RideSummary[];
  selectedDeviceId: string;
  onSelectDevice: (deviceId: string) => void;
}

const bounds = {
  minLat: 26.06,
  maxLat: 26.12,
  minLng: 119.25,
  maxLng: 119.35
};

const project = (lat: number, lng: number) => {
  const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
  const y = (1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100;
  return { x: Math.max(3, Math.min(97, x)), y: Math.max(3, Math.min(97, y)) };
};

const statusClass = {
  online: "bg-emerald-400 text-emerald-950 ring-emerald-300/50",
  offline: "bg-slate-500 text-white ring-slate-300/30"
};

export function LiveMap({ devices, alarms, tracks, selectedDeviceId, onSelectDevice }: LiveMapProps) {
  const selectedTrack = tracks.find((track) => track.deviceId === selectedDeviceId) ?? tracks[0];
  const path = selectedTrack?.points.map((point) => project(point.location.lat, point.location.lng));

  return (
    <section className="relative h-[430px] overflow-hidden rounded-lg border border-white/10 bg-[#071520] shadow-panel">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.09)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="absolute inset-0 opacity-70">
        <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 22 C15 18 22 30 38 26 C54 22 61 5 80 12 C89 15 95 21 100 28" className="map-road" />
          <path d="M4 68 C20 58 35 62 48 54 C61 45 70 40 96 44" className="map-road" />
          <path d="M18 0 C24 18 21 36 31 50 C41 65 52 75 55 100" className="map-road muted" />
          <path d="M72 0 C68 18 79 35 76 51 C73 65 65 79 70 100" className="map-river" />
          {path && path.length > 1 ? (
            <polyline points={path.map((point) => `${point.x},${point.y}`).join(" ")} className="map-track" />
          ) : null}
        </svg>
      </div>

      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-md border border-white/10 bg-slate-950/75 px-3 py-2 text-xs text-slate-300">
        <CircleDot className="h-4 w-4 text-emerald-300" /> 正常
        <CircleDot className="h-4 w-4 text-amber-300" /> 异常震动
        <CircleDot className="h-4 w-4 text-red-300" /> SOS 报警
        <CircleDot className="h-4 w-4 text-slate-400" /> 离线
      </div>

      {selectedTrack?.points
        .filter((point) => point.eventType)
        .map((point) => {
          const pos = project(point.location.lat, point.location.lng);
          const tone = point.eventType === "fall" || point.eventType === "sos" ? "bg-red-500" : point.eventType === "impact" ? "bg-amber-400" : "bg-yellow-300";
          return (
            <span
              key={point.id}
              className={`absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full ${tone} text-slate-950 shadow-lg ring-4 ring-black/30`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              title={`${point.eventType} ${point.impactG}g`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
          );
        })}

      {alarms.slice(0, 4).map((alarm) => {
        const pos = project(alarm.location.lat, alarm.location.lng);
        return (
          <span
            key={alarm.id}
            className="absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-red-500 text-white shadow-[0_0_22px_rgba(239,68,68,0.65)] ring-4 ring-red-500/20"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            title={`${alarm.riderName} ${alarm.impactG}g`}
          >
            <MapPin className="h-4 w-4" />
          </span>
        );
      })}

      {devices.map((device) => {
        const pos = project(device.telemetry.location.lat, device.telemetry.location.lng);
        const active = selectedDeviceId === device.id;
        const statusTone = device.telemetry.helmetStatus === "sos" ? "bg-red-500 text-white ring-red-300/40" : statusClass[device.onlineStatus];
        return (
          <button
            key={device.id}
            type="button"
            onClick={() => onSelectDevice(device.id)}
            className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ring-4 transition ${statusTone} ${
              active ? "scale-125 shadow-[0_0_30px_rgba(56,189,248,0.55)]" : "shadow-lg"
            }`}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            title={`${device.id} ${device.riderName}`}
          >
            <Bike className="h-5 w-5" />
          </button>
        );
      })}

      <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {devices.map((device) => (
          <button
            key={device.id}
            type="button"
            onClick={() => onSelectDevice(device.id)}
            className={`rounded-md border px-3 py-2 text-left transition ${
              selectedDeviceId === device.id ? "border-sky-300/50 bg-sky-400/10" : "border-white/10 bg-slate-950/70 hover:bg-white/5"
            }`}
          >
            <div className="text-xs text-slate-400">{device.id}</div>
            <div className="mt-1 flex items-center justify-between gap-2 text-sm text-white">
              <span>{device.riderName}</span>
              <span className={device.onlineStatus === "online" ? "text-emerald-300" : "text-slate-400"}>{device.battery}%</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

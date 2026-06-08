import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  BatteryMedium,
  Bike,
  Clock3,
  Gauge,
  LayoutDashboard,
  MapPinned,
  RadioTower,
  Route,
  ShieldCheck,
  Siren,
  Wrench
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AlarmRecord, Device, RealtimeSnapshot } from "@safeturn/shared";
import { fetchSnapshot, resolveAlarm, WS_BASE } from "./lib/api";
import { LiveMap } from "./components/LiveMap";
import { MetricCard } from "./components/MetricCard";

const navItems = [
  { label: "实时大屏", icon: LayoutDashboard },
  { label: "报警中心", icon: Siren },
  { label: "设备管理", icon: RadioTower },
  { label: "轨迹回放", icon: Route }
];

function App() {
  const [snapshot, setSnapshot] = useState<RealtimeSnapshot | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState("ST-0001");
  const [connection, setConnection] = useState<"connecting" | "online" | "offline">("connecting");

  useEffect(() => {
    fetchSnapshot().then(setSnapshot).catch(() => setConnection("offline"));

    const ws = new WebSocket(`${WS_BASE}/ws`);
    ws.onopen = () => setConnection("online");
    ws.onclose = () => setConnection("offline");
    ws.onerror = () => setConnection("offline");
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as { type: string; payload: RealtimeSnapshot };
      if (message.type === "snapshot") {
        setSnapshot(message.payload);
      }
    };
    return () => ws.close();
  }, []);

  const devices = snapshot?.devices ?? [];
  const alarms = snapshot?.alarms ?? [];
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? devices[0];
  const selectedTrack = snapshot?.tracks.find((track) => track.deviceId === selectedDevice?.id);

  const alarmRows = alarms.slice(0, 6);
  const curveData = useMemo(
    () =>
      (selectedTrack?.points ?? []).slice(-18).map((point, index) => ({
        name: `${index + 1}`,
        speed: point.speedKmh,
        altitude: point.altitudeM,
        impact: point.impactG
      })),
    [selectedTrack]
  );

  if (!snapshot) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#07111d] text-slate-100">
        <div className="rounded-lg border border-white/10 bg-slate-950/70 px-6 py-5 text-sm text-slate-300">正在连接 SafeTurn Server...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07111d] text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r border-white/10 bg-[#091827] p-5 lg:block">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-sky-400 text-slate-950">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">SafeTurn</h1>
              <p className="text-xs text-slate-400">管理后台</p>
            </div>
          </div>
          <nav className="mt-8 space-y-2">
            {navItems.map((item, index) => (
              <button
                key={item.label}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm transition ${index === 0 ? "bg-sky-500/16 text-sky-200 ring-1 ring-sky-300/20" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#091827]/80 px-5 py-4 backdrop-blur">
            <div>
              <p className="text-xs text-slate-400">实时监控中心</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-normal">智能头盔外部后台大屏</h2>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${connection === "online" ? "bg-emerald-400" : connection === "connecting" ? "bg-amber-300" : "bg-red-400"}`} />
              <span className="text-slate-300">{connection === "online" ? "WebSocket 已连接" : connection === "connecting" ? "正在连接" : "连接中断"}</span>
              <span className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-slate-400">{new Date().toLocaleString("zh-CN")}</span>
            </div>
          </header>

          <div className="grid flex-1 gap-4 p-4 xl:grid-cols-[1fr_300px]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard icon={Bike} label="在线设备数" value={snapshot.stats.onlineDevices} accent="green" />
                <MetricCard icon={Route} label="今日骑行里程" value={snapshot.stats.todayDistanceKm} suffix="km" accent="blue" />
                <MetricCard icon={AlertCircle} label="今日报警次数" value={snapshot.stats.todayAlarmCount} accent="amber" />
                <MetricCard icon={Siren} label="当前 SOS 数量" value={snapshot.stats.activeSosCount} accent="red" />
              </div>

              <LiveMap devices={devices} alarms={alarms} tracks={snapshot.tracks} selectedDeviceId={selectedDevice?.id ?? selectedDeviceId} onSelectDevice={setSelectedDeviceId} />

              <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                <section className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-panel">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold">最新报警记录</h3>
                    <button className="rounded-md border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">导出记录</button>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[780px] text-left text-sm">
                      <thead className="text-xs text-slate-500">
                        <tr>
                          <th className="py-2">报警时间</th>
                          <th>设备编号</th>
                          <th>骑手姓名</th>
                          <th>报警类型</th>
                          <th>冲击 G 值</th>
                          <th>位置</th>
                          <th>处理状态</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/8">
                        {alarmRows.map((alarm) => (
                          <AlarmRow key={alarm.id} alarm={alarm} onResolve={resolveAlarm} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-panel">
                  <h3 className="text-base font-semibold">速度/海拔/冲击曲线</h3>
                  <div className="mt-4 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={curveData}>
                        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                        <XAxis dataKey="name" stroke="#64748b" tickLine={false} />
                        <YAxis stroke="#64748b" tickLine={false} />
                        <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8 }} />
                        <Line type="monotone" dataKey="speed" stroke="#38bdf8" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="altitude" stroke="#f59e0b" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="impact" stroke="#ef4444" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>
            </div>

            <aside className="space-y-4">
              <section className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-panel">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold">设备状态</h3>
                  <span className="text-xs text-slate-500">{selectedDevice?.id}</span>
                </div>
                {selectedDevice ? <DeviceDetail device={selectedDevice} /> : null}
              </section>

              <section className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-panel">
                <h3 className="text-base font-semibold">电量分布</h3>
                <div className="mt-4 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={snapshot.stats.batteryBuckets}>
                      <CartesianGrid vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="label" stroke="#64748b" tickLine={false} />
                      <YAxis allowDecimals={false} stroke="#64748b" tickLine={false} />
                      <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8 }} />
                      <Bar dataKey="value" fill="#34d399" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-lg border border-red-400/20 bg-red-950/20 p-4 shadow-panel">
                <div className="flex items-center gap-2 text-red-200">
                  <Siren className="h-5 w-5" />
                  <h3 className="text-base font-semibold">待处理警情</h3>
                </div>
                <div className="mt-3 space-y-3">
                  {alarms
                    .filter((alarm) => alarm.status === "pending")
                    .slice(0, 3)
                    .map((alarm) => (
                      <div key={alarm.id} className="rounded-md border border-red-400/20 bg-red-500/10 p-3">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-medium text-white">{alarm.riderName}</span>
                          <span className="text-red-200">{alarm.impactG}g</span>
                        </div>
                        <p className="mt-1 text-xs text-red-100/80">{alarm.address}</p>
                      </div>
                    ))}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function AlarmRow({ alarm, onResolve }: { alarm: AlarmRecord; onResolve: (alarmId: string) => Promise<unknown> }) {
  const statusClass = alarm.status === "pending" ? "text-red-300" : alarm.status === "notified" ? "text-amber-300" : "text-emerald-300";
  return (
    <tr className="text-slate-300">
      <td className="py-3 text-slate-400">{new Date(alarm.occurredAt).toLocaleTimeString("zh-CN")}</td>
      <td>{alarm.deviceId}</td>
      <td>{alarm.riderName}</td>
      <td>{alarm.type === "fall" ? "严重跌倒" : alarm.type === "sos" ? "SOS 求救" : "异常震动"}</td>
      <td>{alarm.impactG} g</td>
      <td className="max-w-[220px] truncate">{alarm.address}</td>
      <td className={statusClass}>{alarm.status === "pending" ? "待处理" : alarm.status === "notified" ? "已通知" : "已处理"}</td>
      <td>
        <button onClick={() => onResolve(alarm.id)} className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/5">
          标记已处理
        </button>
      </td>
    </tr>
  );
}

function DeviceDetail({ device }: { device: Device }) {
  const rows = [
    { icon: BatteryMedium, label: "电量", value: `${device.battery}%` },
    { icon: RadioTower, label: "4G 信号", value: signalText(device.telemetry.fourGSignal) },
    { icon: MapPinned, label: "GPS", value: gpsText(device.telemetry.gpsStatus) },
    { icon: Gauge, label: "当前速度", value: `${device.telemetry.speedKmh} km/h` },
    { icon: Activity, label: "温湿度", value: `${device.telemetry.temperatureC}℃ / ${device.telemetry.humidityPct}%` },
    { icon: Wrench, label: "环境光", value: `${device.telemetry.ambientLightLux} lux` },
    { icon: Route, label: "海拔", value: `${device.telemetry.altitudeM} m` },
    { icon: Clock3, label: "最后上报", value: new Date(device.lastSeenAt).toLocaleTimeString("zh-CN") }
  ];
  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
        <div className="text-sm font-medium text-white">{device.riderName}</div>
        <div className="mt-1 text-xs text-slate-500">
          {device.sn} · {device.firmwareVersion}
        </div>
      </div>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3 border-b border-white/8 pb-2 text-sm">
          <span className="flex items-center gap-2 text-slate-400">
            <row.icon className="h-4 w-4" />
            {row.label}
          </span>
          <span className="text-slate-100">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function signalText(signal: Device["telemetry"]["fourGSignal"]) {
  return signal === "strong" ? "强" : signal === "medium" ? "中" : signal === "weak" ? "弱" : "离线";
}

function gpsText(status: Device["telemetry"]["gpsStatus"]) {
  return status === "fixed" ? "已定位" : status === "searching" ? "搜索中" : "丢失";
}

export default App;

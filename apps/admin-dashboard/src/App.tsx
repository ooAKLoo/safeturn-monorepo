import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BatteryMedium,
  Bell,
  Bike,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Cpu,
  Download,
  Gauge,
  LayoutDashboard,
  MapPinned,
  Navigation,
  Power,
  RadioTower,
  Route,
  Search,
  Settings2,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Smartphone,
  Thermometer,
  Wrench,
  Zap
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AlarmRecord, Device, RealtimeSnapshot, RideSummary } from "@safeturn/shared";
import { fetchSnapshot, resolveAlarm, WS_BASE } from "./lib/api";
import { LiveMap } from "./components/LiveMap";
import { MetricCard } from "./components/MetricCard";

type ViewKey = "dashboard" | "alarms" | "devices" | "tracks";

const navItems: Array<{ key: ViewKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: "dashboard", label: "实时大屏", icon: LayoutDashboard },
  { key: "alarms", label: "报警中心", icon: Siren },
  { key: "devices", label: "设备管理", icon: RadioTower },
  { key: "tracks", label: "轨迹回放", icon: Route }
];

const viewMeta: Record<ViewKey, { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: "实时监控中心", title: "智能头盔外部后台大屏" },
  alarms: { eyebrow: "警情调度中心", title: "报警中心" },
  devices: { eyebrow: "设备资产与配置", title: "设备管理" },
  tracks: { eyebrow: "骑行轨迹分析", title: "轨迹回放" }
};

function App() {
  const [snapshot, setSnapshot] = useState<RealtimeSnapshot | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState("ST-0001");
  const [connection, setConnection] = useState<"connecting" | "online" | "offline">("connecting");
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");

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

  if (!snapshot) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#07111d] text-slate-100">
        <div className="rounded-lg border border-white/10 bg-slate-950/70 px-6 py-5 text-sm text-slate-300">正在连接 SafeTurn Server...</div>
      </main>
    );
  }

  const devices = snapshot.devices;
  const alarms = snapshot.alarms;
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? devices[0];
  const selectedTrack = snapshot.tracks.find((track) => track.deviceId === selectedDevice?.id) ?? snapshot.tracks[0];
  const meta = viewMeta[activeView];

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
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveView(item.key)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm transition ${
                  activeView === item.key ? "bg-sky-500/16 text-sky-200 ring-1 ring-sky-300/20" : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
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
              <p className="text-xs text-slate-400">{meta.eyebrow}</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-normal">{meta.title}</h2>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${connection === "online" ? "bg-emerald-400" : connection === "connecting" ? "bg-amber-300" : "bg-red-400"}`} />
              <span className="text-slate-300">{connection === "online" ? "WebSocket 已连接" : connection === "connecting" ? "正在连接" : "连接中断"}</span>
              <span className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-slate-400">{new Date().toLocaleString("zh-CN")}</span>
            </div>
          </header>

          {activeView === "dashboard" ? (
            <DashboardView snapshot={snapshot} selectedDevice={selectedDevice} selectedDeviceId={selectedDevice?.id ?? selectedDeviceId} onSelectDevice={setSelectedDeviceId} />
          ) : null}
          {activeView === "alarms" ? <AlarmCenterView alarms={alarms} devices={devices} /> : null}
          {activeView === "devices" ? <DeviceManageView devices={devices} selectedDeviceId={selectedDevice?.id ?? selectedDeviceId} onSelectDevice={setSelectedDeviceId} /> : null}
          {activeView === "tracks" ? (
            <TrackReplayView tracks={snapshot.tracks} devices={devices} selectedDeviceId={selectedDevice?.id ?? selectedDeviceId} selectedTrack={selectedTrack} onSelectDevice={setSelectedDeviceId} />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function DashboardView({
  snapshot,
  selectedDevice,
  selectedDeviceId,
  onSelectDevice
}: {
  snapshot: RealtimeSnapshot;
  selectedDevice?: Device;
  selectedDeviceId: string;
  onSelectDevice: (deviceId: string) => void;
}) {
  const devices = snapshot.devices;
  const alarms = snapshot.alarms;
  const selectedTrack = snapshot.tracks.find((track) => track.deviceId === selectedDevice?.id);
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

  return (
    <div className="grid flex-1 gap-4 p-4 xl:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Bike} label="在线设备数" value={snapshot.stats.onlineDevices} accent="green" />
          <MetricCard icon={Route} label="今日骑行里程" value={snapshot.stats.todayDistanceKm} suffix="km" accent="blue" />
          <MetricCard icon={AlertCircle} label="今日报警次数" value={snapshot.stats.todayAlarmCount} accent="amber" />
          <MetricCard icon={Siren} label="当前 SOS 数量" value={snapshot.stats.activeSosCount} accent="red" />
        </div>

        <LiveMap devices={devices} alarms={alarms} tracks={snapshot.tracks} selectedDeviceId={selectedDeviceId} onSelectDevice={onSelectDevice} />

        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <section className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">最新报警记录</h3>
              <button className="rounded-md border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">导出记录</button>
            </div>
            <AlarmTable alarms={alarmRows} compact />
          </section>

          <CurvePanel title="速度/海拔/冲击曲线" data={curveData} />
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

        <BatteryPanel snapshot={snapshot} />

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
  );
}

function AlarmCenterView({ alarms, devices }: { alarms: AlarmRecord[]; devices: Device[] }) {
  const pending = alarms.filter((alarm) => alarm.status === "pending");
  const notified = alarms.filter((alarm) => alarm.status === "notified");
  const resolved = alarms.filter((alarm) => alarm.status === "resolved");
  const levelData = [
    { name: "低", value: alarms.filter((alarm) => alarm.level === "low").length },
    { name: "中", value: alarms.filter((alarm) => alarm.level === "medium").length },
    { name: "高", value: alarms.filter((alarm) => alarm.level === "high").length },
    { name: "严重", value: alarms.filter((alarm) => alarm.level === "critical").length }
  ];

  return (
    <div className="flex-1 space-y-4 p-4">
      <div className="grid gap-4 md:grid-cols-4">
        <StatPanel icon={Siren} label="待处理" value={pending.length} tone="red" />
        <StatPanel icon={Bell} label="已通知联系人" value={notified.length} tone="amber" />
        <StatPanel icon={CheckCircle2} label="已处理" value={resolved.length} tone="green" />
        <StatPanel icon={RadioTower} label="覆盖设备" value={devices.length} tone="blue" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <section className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold">报警列表</h3>
            <div className="flex flex-wrap gap-2 text-sm">
              <button className="inline-flex items-center gap-2 rounded-md border border-sky-300/30 bg-sky-400/10 px-3 py-2 text-sky-100">
                <SlidersHorizontal className="h-4 w-4" />
                全部状态
              </button>
              <button className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-slate-300 hover:bg-white/5">
                <Search className="h-4 w-4" />
                设备/骑手
              </button>
              <button className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-slate-300 hover:bg-white/5">
                <Download className="h-4 w-4" />
                导出
              </button>
            </div>
          </div>
          <AlarmTable alarms={alarms} />
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-panel">
            <h3 className="text-base font-semibold">报警等级分布</h3>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={levelData}>
                  <CartesianGrid vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" tickLine={false} />
                  <YAxis allowDecimals={false} stroke="#64748b" tickLine={false} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8 }} />
                  <Bar dataKey="value" fill="#f43f5e" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-panel">
            <h3 className="text-base font-semibold">处置流程</h3>
            <div className="mt-4 space-y-3">
              {["报警接入", "短信/电话通知", "后台确认位置", "标记处理结果"].map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-sky-400/15 text-sky-200">{index + 1}</span>
                  <span className="text-slate-200">{step}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function DeviceManageView({ devices, selectedDeviceId, onSelectDevice }: { devices: Device[]; selectedDeviceId: string; onSelectDevice: (deviceId: string) => void }) {
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? devices[0];
  const firmwareRows = [
    { version: "v1.2.4", range: "ST-0001 / ST-0002", status: "灰度中" },
    { version: "v1.2.3", range: "ST-0003", status: "稳定版" },
    { version: "v1.1.0", range: "ST-0004", status: "待升级" }
  ];

  return (
    <div className="grid flex-1 gap-4 p-4 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <StatPanel icon={RadioTower} label="设备总数" value={devices.length} tone="blue" />
          <StatPanel icon={Power} label="在线设备" value={devices.filter((device) => device.onlineStatus === "online").length} tone="green" />
          <StatPanel icon={BatteryMedium} label="低电量设备" value={devices.filter((device) => device.battery <= 30).length} tone="amber" />
          <StatPanel icon={Cpu} label="待升级设备" value={devices.filter((device) => device.firmwareVersion !== "v1.2.3").length} tone="red" />
        </div>

        <section className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold">设备资产</h3>
            <div className="flex gap-2">
              <button className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">
                <Search className="h-4 w-4" />
                搜索设备
              </button>
              <button className="inline-flex items-center gap-2 rounded-md border border-sky-300/30 bg-sky-400/10 px-3 py-2 text-sm text-sky-100">
                <Settings2 className="h-4 w-4" />
                批量配置
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {devices.map((device) => (
              <button
                key={device.id}
                type="button"
                onClick={() => onSelectDevice(device.id)}
                className={`rounded-lg border p-4 text-left transition ${
                  selectedDevice?.id === device.id ? "border-sky-300/50 bg-sky-400/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Smartphone className="h-4 w-4 text-sky-300" />
                      {device.id}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{device.sn}</p>
                  </div>
                  <span className={`rounded-md px-2 py-1 text-xs ${device.onlineStatus === "online" ? "bg-emerald-400/10 text-emerald-200" : "bg-slate-400/10 text-slate-300"}`}>
                    {device.onlineStatus === "online" ? "在线" : "离线"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <InfoCell label="骑手" value={device.riderName} />
                  <InfoCell label="电量" value={`${device.battery}%`} />
                  <InfoCell label="固件" value={device.firmwareVersion} />
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">设备详情</h3>
            <span className="text-xs text-slate-500">{selectedDevice?.id}</span>
          </div>
          {selectedDevice ? <DeviceDetail device={selectedDevice} /> : null}
        </section>

        <section className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-panel">
          <h3 className="text-base font-semibold">远程配置</h3>
          <div className="mt-4 space-y-3 text-sm">
            <ConfigRow label="跌倒灵敏度" value="中" />
            <ConfigRow label="自动报警倒计时" value="15 秒" />
            <ConfigRow label="夜间自动灯带" value="开启" />
            <ConfigRow label="转向提示距离" value="50 m" />
          </div>
          <button className="mt-4 w-full rounded-md bg-sky-400 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-sky-300">保存配置</button>
        </section>

        <section className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-panel">
          <h3 className="text-base font-semibold">固件批次</h3>
          <div className="mt-4 space-y-3">
            {firmwareRows.map((row) => (
              <div key={row.version} className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-white">{row.version}</span>
                  <span className="text-xs text-slate-400">{row.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{row.range}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function TrackReplayView({
  tracks,
  devices,
  selectedDeviceId,
  selectedTrack,
  onSelectDevice
}: {
  tracks: RideSummary[];
  devices: Device[];
  selectedDeviceId: string;
  selectedTrack?: RideSummary;
  onSelectDevice: (deviceId: string) => void;
}) {
  const curveData = (selectedTrack?.points ?? []).map((point, index) => ({
    name: `${index + 1}`,
    speed: point.speedKmh,
    altitude: point.altitudeM,
    impact: point.impactG
  }));
  const replayAlarms = (selectedTrack?.points ?? [])
    .filter((point) => point.eventType)
    .map((point, index) => ({
      id: point.id,
      label: point.eventType === "fall" ? "跌倒事件" : point.eventType === "impact" ? "冲击事件" : "急刹事件",
      time: point.timestamp,
      value: `${point.impactG} g`,
      index: index + 1
    }));

  return (
    <div className="grid flex-1 gap-4 p-4 xl:grid-cols-[340px_1fr]">
      <aside className="space-y-4">
        <section className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-panel">
          <h3 className="text-base font-semibold">轨迹选择</h3>
          <div className="mt-4 space-y-3">
            {tracks.map((track) => {
              const device = devices.find((item) => item.id === track.deviceId);
              const active = selectedDeviceId === track.deviceId;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => onSelectDevice(track.deviceId)}
                  className={`w-full rounded-md border p-3 text-left transition ${active ? "border-sky-300/50 bg-sky-400/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white">{device?.riderName ?? track.deviceId}</span>
                    <span className="text-xs text-slate-400">{track.date}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <InfoCell label="里程" value={`${track.distanceKm}km`} />
                    <InfoCell label="均速" value={`${track.averageSpeedKmh}`} />
                    <InfoCell label="点位" value={track.points.length} />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-panel">
          <h3 className="text-base font-semibold">关键事件</h3>
          <div className="mt-4 space-y-3">
            {replayAlarms.length > 0 ? (
              replayAlarms.map((event) => (
                <div key={event.id} className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white">{event.label}</span>
                    <span className="text-amber-200">{event.value}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{new Date(event.time).toLocaleTimeString("zh-CN")} · 第 {event.index} 段</p>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-400">该轨迹暂无异常事件</p>
            )}
          </div>
        </section>
      </aside>

      <div className="space-y-4">
        <section className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">轨迹回放地图</h3>
              <p className="mt-1 text-xs text-slate-500">
                {selectedTrack?.startAddress} → {selectedTrack?.endAddress}
              </p>
            </div>
            <div className="flex gap-2 text-sm">
              <button className="inline-flex items-center gap-2 rounded-md border border-sky-300/30 bg-sky-400/10 px-3 py-2 text-sky-100">
                <Navigation className="h-4 w-4" />
                播放
              </button>
              <button className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-slate-300 hover:bg-white/5">
                <CalendarClock className="h-4 w-4" />
                今天
              </button>
            </div>
          </div>
          <div className="mt-4">
            <LiveMap devices={devices} alarms={[]} tracks={tracks} selectedDeviceId={selectedDeviceId} onSelectDevice={onSelectDevice} />
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <CurvePanel title="回放数据曲线" data={curveData} />
          <section className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-panel">
            <h3 className="text-base font-semibold">本次骑行</h3>
            <div className="mt-4 grid gap-3 text-sm">
              <InfoLine icon={Route} label="总里程" value={`${selectedTrack?.distanceKm ?? 0} km`} />
              <InfoLine icon={Gauge} label="平均速度" value={`${selectedTrack?.averageSpeedKmh ?? 0} km/h`} />
              <InfoLine icon={Zap} label="最高速度" value={`${selectedTrack?.maxSpeedKmh ?? 0} km/h`} />
              <InfoLine icon={MapPinned} label="累计爬升" value={`${selectedTrack?.elevationGainM ?? 0} m`} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function AlarmTable({ alarms }: { alarms: AlarmRecord[]; compact?: boolean }) {
  return (
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
          {alarms.map((alarm) => (
            <AlarmRow key={alarm.id} alarm={alarm} onResolve={resolveAlarm} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlarmRow({ alarm, onResolve }: { alarm: AlarmRecord; onResolve: (alarmId: string) => Promise<unknown> }) {
  const statusClass = alarm.status === "pending" ? "text-red-300" : alarm.status === "notified" ? "text-amber-300" : "text-emerald-300";
  return (
    <tr className="text-slate-300">
      <td className="py-3 text-slate-400">{new Date(alarm.occurredAt).toLocaleTimeString("zh-CN")}</td>
      <td>{alarm.deviceId}</td>
      <td>{alarm.riderName}</td>
      <td>{alarm.type === "fall" ? "严重跌倒" : alarm.type === "sos" ? "SOS 求救" : alarm.type === "impact" ? "异常震动" : "姿态异常"}</td>
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
    { icon: Thermometer, label: "温湿度", value: `${device.telemetry.temperatureC}℃ / ${device.telemetry.humidityPct}%` },
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

function BatteryPanel({ snapshot }: { snapshot: RealtimeSnapshot }) {
  return (
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
  );
}

function CurvePanel({ title, data }: { title: string; data: Array<{ name: string; speed: number; altitude: number; impact: number }> }) {
  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-panel">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
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
  );
}

function StatPanel({ icon: Icon, label, value, tone }: { icon: typeof LayoutDashboard; label: string; value: number | string; tone: "blue" | "green" | "amber" | "red" }) {
  const toneClass = {
    blue: "text-sky-300 bg-sky-400/10 border-sky-300/20",
    green: "text-emerald-300 bg-emerald-400/10 border-emerald-300/20",
    amber: "text-amber-300 bg-amber-400/10 border-amber-300/20",
    red: "text-red-300 bg-red-400/10 border-red-300/20"
  }[tone];

  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/70 p-4 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-400">{label}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-md border ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-4 text-3xl font-semibold text-white">{value}</div>
    </section>
  );
}

function InfoCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm text-slate-100">{value}</div>
    </div>
  );
}

function InfoLine({ icon: Icon, label, value }: { icon: typeof LayoutDashboard; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-2">
      <span className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className="text-white">{value}</span>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-100">{value}</span>
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

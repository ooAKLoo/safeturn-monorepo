import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Battery,
  Bluetooth,
  ChevronLeft,
  CloudSun,
  Compass,
  Gauge,
  Home,
  Lightbulb,
  LocateFixed,
  Map,
  MapPinned,
  Navigation,
  Phone,
  RadioTower,
  RotateCcw,
  Route,
  Settings,
  ShieldAlert,
  Siren,
  Thermometer,
  Waves,
  Zap
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Device, LightCommand, RealtimeSnapshot } from "@safeturn/shared";
import { fetchSnapshot, sendLightCommand, triggerSos, useDeviceFromSnapshot, WS_BASE } from "./lib/api";
import { MetricTile } from "./components/MetricTile";
import { PhoneShell } from "./components/PhoneShell";

type Tab = "home" | "nav" | "safety" | "history" | "mine";

const tabs: Array<{ id: Tab; label: string; icon: typeof Home }> = [
  { id: "home", label: "首页", icon: Home },
  { id: "nav", label: "导航", icon: Navigation },
  { id: "safety", label: "监测", icon: ShieldAlert },
  { id: "history", label: "记录", icon: Route },
  { id: "mine", label: "我的", icon: Settings }
];

function App() {
  const [snapshot, setSnapshot] = useState<RealtimeSnapshot | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [brightness, setBrightness] = useState(80);
  const [toast, setToast] = useState("");
  const [sosProgress, setSosProgress] = useState(0);
  const device = useDeviceFromSnapshot(snapshot, "ST-0001");
  const ride = snapshot?.tracks.find((item) => item.deviceId === device?.id);

  useEffect(() => {
    fetchSnapshot().then(setSnapshot);
    const ws = new WebSocket(`${WS_BASE}/ws`);
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as { type: string; payload: RealtimeSnapshot };
      if (message.type === "snapshot") {
        setSnapshot(message.payload);
      }
    };
    return () => ws.close();
  }, []);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2000);
  };

  const runCommand = async (command: LightCommand) => {
    if (!device) return;
    const ack = await sendLightCommand(device.id, command, brightness);
    notify(ack.message);
  };

  const runSos = async () => {
    if (!device) return;
    navigator.vibrate?.([120, 80, 120]);
    await sendLightCommand(device.id, "SOS");
    await triggerSos(device.id);
    notify("SOS 已触发，正在通知紧急联系人");
  };

  return (
    <PhoneShell>
      <div className="relative flex min-h-[840px] flex-col">
        {toast ? <div className="absolute left-4 right-4 top-12 z-20 rounded-lg bg-slate-900/95 px-4 py-3 text-center text-sm text-white shadow-lg ring-1 ring-white/10">{toast}</div> : null}
        <StatusBar />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24">
          {tab === "home" && device ? <HomePage device={device} brightness={brightness} onBrightness={setBrightness} onCommand={runCommand} onSos={runSos} sosProgress={sosProgress} setSosProgress={setSosProgress} /> : null}
          {tab === "nav" && device ? <NavigationPage device={device} onCommand={runCommand} /> : null}
          {tab === "safety" && device ? <SafetyPage device={device} /> : null}
          {tab === "history" && ride ? <HistoryPage ride={ride} /> : null}
          {tab === "mine" && device ? <MinePage device={device} /> : null}
        </div>
        <nav className="absolute bottom-0 left-0 right-0 grid h-[72px] grid-cols-5 border-t border-white/10 bg-[#091827]/96 px-2">
          {tabs.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)} className={`flex flex-col items-center justify-center gap-1 text-xs ${tab === item.id ? "text-blue-300" : "text-slate-500"}`}>
              <item.icon className="h-5 w-5" />
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </PhoneShell>
  );
}

function StatusBar() {
  return (
    <div className="flex h-10 items-center justify-between px-5 text-xs text-slate-300">
      <span>9:41</span>
      <span className="flex items-center gap-1">
        <RadioTower className="h-3.5 w-3.5" />
        <Battery className="h-4 w-4" />
      </span>
    </div>
  );
}

function HomePage({
  device,
  brightness,
  onBrightness,
  onCommand,
  onSos,
  sosProgress,
  setSosProgress
}: {
  device: Device;
  brightness: number;
  onBrightness: (value: number) => void;
  onCommand: (command: LightCommand) => void;
  onSos: () => Promise<void>;
  sosProgress: number;
  setSosProgress: (value: number) => void;
}) {
  const timerRef = useRef<number>();
  const intervalRef = useRef<number>();

  const startSos = () => {
    setSosProgress(0);
    const startedAt = Date.now();
    intervalRef.current = window.setInterval(() => {
      setSosProgress(Math.min(100, Math.round(((Date.now() - startedAt) / 3000) * 100)));
    }, 80);
    timerRef.current = window.setTimeout(() => {
      stopSos();
      onSos();
    }, 3000);
  };

  const stopSos = () => {
    window.clearTimeout(timerRef.current);
    window.clearInterval(intervalRef.current);
    setSosProgress(0);
  };

  const telemetry = device.telemetry;
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">SafeTurn</h1>
          <p className="mt-1 text-xs text-slate-400">{device.name}</p>
        </div>
        <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">已连接</span>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <MetricTile icon={Bluetooth} label="蓝牙" value="已连接" tone="blue" />
        <MetricTile icon={RadioTower} label="4G" value={telemetry.fourGSignal === "strong" ? "在线" : "弱"} tone="green" />
        <MetricTile icon={LocateFixed} label="GPS" value={telemetry.gpsStatus === "fixed" ? "已定位" : "搜索"} tone="blue" />
        <MetricTile icon={Battery} label="电量" value={`${telemetry.battery}%`} tone="green" />
        <MetricTile icon={Gauge} label="速度" value={`${telemetry.speedKmh}`} />
        <MetricTile icon={Waves} label="海拔" value={`${telemetry.altitudeM}m`} />
        <MetricTile icon={Thermometer} label="温度" value={`${telemetry.temperatureC}℃`} />
        <MetricTile icon={CloudSun} label="湿度" value={`${telemetry.humidityPct}%`} />
        <MetricTile icon={Lightbulb} label="环境光" value={`${telemetry.ambientLightLux}`} />
      </div>

      <div className="rounded-lg border border-emerald-300/15 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">状态：正常骑行</div>

      <section className="rounded-lg border border-white/10 bg-slate-900/78 p-4">
        <h2 className="text-base font-semibold">灯带控制</h2>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <CommandButton icon={ChevronLeft} label="左转" onClick={() => onCommand("LEFT")} tone="amber" />
          <CommandButton icon={Navigation} label="右转" onClick={() => onCommand("RIGHT")} tone="amber" />
          <CommandButton icon={AlertTriangle} label="双闪" onClick={() => onCommand("DOUBLE")} tone="red" />
          <CommandButton icon={RotateCcw} label="停止" onClick={() => onCommand("STOP")} tone="slate" />
        </div>
        <label className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-300">
          <span>亮度</span>
          <input className="h-2 flex-1 accent-blue-400" type="range" min="10" max="100" value={brightness} onChange={(event) => onBrightness(Number(event.target.value))} />
          <span className="w-10 text-right">{brightness}%</span>
        </label>
      </section>

      <button
        className="relative h-[118px] w-full overflow-hidden rounded-xl bg-red-600 text-white shadow-[0_18px_42px_rgba(220,38,38,0.42)] ring-1 ring-red-300/30"
        onPointerDown={startSos}
        onPointerUp={stopSos}
        onPointerCancel={stopSos}
        onPointerLeave={stopSos}
      >
        <span className="absolute inset-y-0 left-0 bg-red-300/25 transition-[width]" style={{ width: `${sosProgress}%` }} />
        <span className="relative flex items-center justify-center gap-4">
          <span className="grid h-20 w-20 place-items-center rounded-full border-2 border-white text-2xl font-bold">SOS</span>
          <span className="text-left">
            <span className="block text-xl font-semibold">长按3秒 紧急求救</span>
            <span className="mt-1 block text-sm text-red-100">触发蜂鸣器、红色爆闪并上传云端</span>
          </span>
        </span>
      </button>
    </section>
  );
}

function CommandButton({ icon: Icon, label, onClick, tone }: { icon: typeof Home; label: string; onClick: () => void; tone: "amber" | "red" | "slate" }) {
  const cls = tone === "amber" ? "bg-amber-400/12 text-amber-200 border-amber-300/20" : tone === "red" ? "bg-red-400/12 text-red-200 border-red-300/20" : "bg-slate-800 text-slate-200 border-white/10";
  return (
    <button onClick={onClick} className={`min-h-[72px] rounded-lg border ${cls} text-sm`}>
      <Icon className="mx-auto mb-2 h-6 w-6" />
      {label}
    </button>
  );
}

function NavigationPage({ device, onCommand }: { device: Device; onCommand: (command: LightCommand) => void }) {
  return (
    <section className="space-y-4">
      <header className="rounded-lg border border-white/10 bg-slate-900 p-4">
        <p className="text-sm text-slate-400">前方 50 米</p>
        <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold">
          <ChevronLeft className="h-9 w-9 text-white" />
          左转
        </h1>
      </header>
      <div className="relative h-[320px] overflow-hidden rounded-lg border border-white/10 bg-[#0d1e2c]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.12)_1px,transparent_1px)] bg-[size:42px_42px]" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M18 100 L18 80 C18 64 36 64 36 48 L36 32 C36 20 55 22 72 16" className="nav-route" />
        </svg>
        <div className="absolute bottom-20 left-[28%] grid h-10 w-10 place-items-center rounded-full bg-emerald-400 text-slate-950 ring-4 ring-emerald-300/30">
          <Navigation className="h-6 w-6" />
        </div>
        <button onClick={() => onCommand("LEFT")} className="absolute right-4 top-4 rounded-full bg-slate-950/80 p-3 text-white ring-1 ring-white/10">
          <Lightbulb className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MetricTile icon={Gauge} label="当前速度" value={`${device.telemetry.speedKmh}`} tone="blue" />
        <MetricTile icon={Route} label="剩余距离" value="2.3km" />
        <MetricTile icon={Compass} label="预计到达" value="12分" />
      </div>
      <div className="rounded-lg border border-white/10 bg-slate-900 p-4 text-sm text-slate-300">
        下一步：前方 50 米 <span className="font-semibold text-amber-300">左转</span>，头盔左侧灯带将提前流水提示
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MetricTile icon={Waves} label="当前海拔" value={`${device.telemetry.altitudeM}m`} />
        <MetricTile icon={Route} label="累计爬升" value="12m" tone="green" />
      </div>
    </section>
  );
}

function SafetyPage({ device }: { device: Device }) {
  const t = device.telemetry;
  const rows = [
    ["BNO055", "九轴姿态融合正常"],
    ["冲击 G 值", `${t.impactG} g`],
    ["Pitch", `${t.pitch}°`],
    ["Roll", `${t.roll}°`],
    ["Yaw", `${t.yaw}°`],
    ["气压", `${t.pressureHpa} hPa`],
    ["卫星数量", `${t.satelliteCount}`],
    ["头盔状态", t.helmetStatus === "normal" ? "正常" : "异常"]
  ];
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">安全监测</h1>
      <div className="rounded-xl border border-blue-300/15 bg-blue-400/10 p-5">
        <p className="text-sm text-blue-200">BNO055 九轴姿态传感器</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">集成加速度计、陀螺仪、磁力计和姿态融合算法，实时输出 Pitch、Roll、Yaw 与冲击数据。</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MetricTile icon={Zap} label="冲击强度" value={`${t.impactG}g`} tone={t.impactG > 2 ? "amber" : "green"} />
        <MetricTile icon={Thermometer} label="温度" value={`${t.temperatureC}℃`} />
        <MetricTile icon={CloudSun} label="湿度" value={`${t.humidityPct}%`} />
        <MetricTile icon={Lightbulb} label="环境光" value={`${t.ambientLightLux}`} />
      </div>
      <div className="rounded-lg border border-white/10 bg-slate-900">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 text-sm last:border-b-0">
            <span className="text-slate-400">{label}</span>
            <span className="font-medium text-white">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function HistoryPage({ ride }: { ride: NonNullable<RealtimeSnapshot["tracks"][number]> }) {
  const chartData = useMemo(() => ride.points.slice(-24).map((point, index) => ({ name: index + 1, altitude: point.altitudeM, speed: point.speedKmh })), [ride]);
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">历史轨迹</h1>
      <div className="relative h-64 overflow-hidden rounded-lg border border-white/10 bg-[#0c1b28]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,.1)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.1)_1px,transparent_1px)] bg-[size:38px_38px]" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M8 76 C20 58 34 70 45 50 S70 36 88 20" className="nav-route" />
        </svg>
        <span className="absolute left-[9%] top-[73%] rounded-full bg-emerald-400 px-2 py-1 text-xs text-slate-950">起</span>
        <span className="absolute left-[82%] top-[16%] rounded-full bg-blue-400 px-2 py-1 text-xs text-slate-950">终</span>
        <span className="absolute left-[48%] top-[48%] grid h-7 w-7 place-items-center rounded-full bg-red-500 text-white ring-4 ring-red-300/20">
          <AlertTriangle className="h-4 w-4" />
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MetricTile icon={Route} label="骑行距离" value={`${ride.distanceKm}km`} tone="blue" />
        <MetricTile icon={Gauge} label="平均速度" value={`${ride.averageSpeedKmh}`} />
        <MetricTile icon={Gauge} label="最高速度" value={`${ride.maxSpeedKmh}`} />
        <MetricTile icon={Waves} label="累计爬升" value={`${ride.elevationGainM}m`} tone="green" />
      </div>
      <section className="h-56 rounded-lg border border-white/10 bg-slate-900 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <XAxis dataKey="name" stroke="#64748b" tickLine={false} />
            <YAxis stroke="#64748b" tickLine={false} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8 }} />
            <Area type="monotone" dataKey="altitude" stroke="#38bdf8" fill="#38bdf833" />
            <Area type="monotone" dataKey="speed" stroke="#f59e0b" fill="#f59e0b22" />
          </AreaChart>
        </ResponsiveContainer>
      </section>
    </section>
  );
}

function MinePage({ device }: { device: Device }) {
  const settings = [
    ["跌倒灵敏度", "中"],
    ["自动报警倒计时", "15秒"],
    ["转向灯提前距离", "50米"],
    ["SOS 短信通知", "开启"],
    ["报警声音", "开启"],
    ["震动提醒", "开启"]
  ];
  const contacts = [
    ["张妈妈", "138****1234", "母亲"],
    ["李先生", "139****5678", "父亲"],
    ["王小明", "137****9012", "朋友"]
  ];
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-900 p-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-800 ring-1 ring-white/10">
          <MapPinned className="h-8 w-8 text-blue-300" />
        </div>
        <div>
          <h1 className="font-semibold">{device.name}</h1>
          <p className="mt-1 text-xs text-slate-400">SN: {device.sn}</p>
          <p className="mt-1 text-xs text-slate-400">固件版本：{device.firmwareVersion}</p>
        </div>
      </div>
      <section className="rounded-lg border border-white/10 bg-slate-900">
        {settings.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 text-sm last:border-b-0">
            <span className="text-slate-400">{label}</span>
            <span className="text-white">{value}</span>
          </div>
        ))}
      </section>
      <section className="rounded-lg border border-white/10 bg-slate-900 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">紧急联系人</h2>
          <button className="text-sm text-blue-300">添加</button>
        </div>
        <div className="mt-3 space-y-2">
          {contacts.map(([name, phone, relation], index) => (
            <div key={name} className="flex items-center justify-between rounded-md bg-white/[0.04] px-3 py-3 text-sm">
              <div>
                <span className="text-white">{index + 1}. {name}</span>
                <p className="mt-1 text-xs text-slate-500">{phone} · {relation}</p>
              </div>
              {index === 0 ? <span className="rounded-full bg-blue-400/15 px-2 py-1 text-xs text-blue-200">第一联系人</span> : null}
            </div>
          ))}
        </div>
      </section>
      <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-white">
        <Phone className="h-4 w-4" />
        拨打第一联系人
      </button>
    </section>
  );
}

export default App;

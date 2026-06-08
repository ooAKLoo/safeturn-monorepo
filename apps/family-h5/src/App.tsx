import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Battery, CheckCircle2, Clock3, MapPinned, MessageSquare, Navigation, Phone, Route, ShieldAlert, Zap } from "lucide-react";
import type { AlarmRecord } from "@safeturn/shared";
import { fetchLatestAlarm, resolveAlarm } from "./lib/api";

function App() {
  const [alarm, setAlarm] = useState<AlarmRecord | null>(null);
  const [handled, setHandled] = useState(false);
  const alarmId = useMemo(() => new URLSearchParams(window.location.search).get("alarmId") ?? undefined, []);

  useEffect(() => {
    fetchLatestAlarm(alarmId).then(setAlarm);
  }, [alarmId]);

  const markHandled = async () => {
    if (!alarm) return;
    const next = await resolveAlarm(alarm.id);
    setAlarm(next);
    setHandled(true);
  };

  if (!alarm) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 px-4 text-slate-800">
        <div className="rounded-lg bg-white px-5 py-4 text-sm shadow-sm">正在加载报警信息...</div>
      </main>
    );
  }

  const mapUrl = `https://uri.amap.com/marker?position=${alarm.location.lng},${alarm.location.lat}&name=SafeTurn报警位置`;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-4 text-slate-900">
      <section className="mx-auto max-w-[430px] overflow-hidden rounded-[22px] bg-white shadow-xl">
        <header className="bg-red-600 px-5 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-white/16 ring-1 ring-white/20">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm text-red-100">紧急报警</p>
              <h1 className="text-xl font-semibold">骑手疑似发生跌倒</h1>
            </div>
          </div>
        </header>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <InfoCard icon={Clock3} label="发生时间" value={new Date(alarm.occurredAt).toLocaleString("zh-CN")} />
            <InfoCard icon={Zap} label="冲击强度" value={`${alarm.impactG} g`} accent="red" />
            <InfoCard icon={Battery} label="当前电量" value={`${alarm.battery}%`} />
            <InfoCard icon={ShieldAlert} label="处理状态" value={statusText(alarm.status)} accent={alarm.status === "resolved" ? "green" : "red"} />
          </div>

          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <MapPinned className="mt-0.5 h-5 w-5 text-red-600" />
              <div>
                <h2 className="font-semibold">当前位置</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{alarm.address}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {alarm.location.lat.toFixed(5)}, {alarm.location.lng.toFixed(5)}
                </p>
              </div>
            </div>
          </section>

          <section className="relative h-64 overflow-hidden rounded-lg border border-slate-200 bg-[#e8edf3]">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(100,116,139,.22)_1px,transparent_1px),linear-gradient(90deg,rgba(100,116,139,.22)_1px,transparent_1px)] bg-[size:36px_36px]" />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M12 78 C24 64 36 68 48 52 C59 37 74 38 88 22" className="family-route" />
            </svg>
            <span className="absolute left-[14%] top-[73%] rounded-full bg-emerald-500 px-2 py-1 text-xs text-white">当前位置</span>
            <span className="absolute left-[50%] top-[46%] grid h-10 w-10 place-items-center rounded-full bg-red-600 text-white shadow-lg ring-4 ring-red-200">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <span className="absolute left-[78%] top-[18%] rounded-full bg-blue-600 px-2 py-1 text-xs text-white">最近轨迹</span>
          </section>

          <div className="grid grid-cols-3 gap-2">
            <ActionButton as="a" href={mapUrl} icon={Navigation} label="查看地图" />
            <ActionButton as="a" href="tel:13800001234" icon={Phone} label="拨打电话" />
            <ActionButton as="a" href="sms:13800001234" icon={MessageSquare} label="发送短信" />
          </div>

          <button
            onClick={markHandled}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:border-emerald-500 disabled:text-emerald-600"
            disabled={alarm.status === "resolved"}
          >
            <CheckCircle2 className="h-4 w-4" />
            {handled || alarm.status === "resolved" ? "已标记处理" : "标记已处理"}
          </button>

          <p className="text-center text-xs text-slate-500">请保持冷静，等待救援或联系骑手确认情况</p>
        </div>
      </section>
    </main>
  );
}

function InfoCard({ icon: Icon, label, value, accent = "slate" }: { icon: typeof Route; label: string; value: string; accent?: "slate" | "red" | "green" }) {
  const tone = accent === "red" ? "text-red-600" : accent === "green" ? "text-emerald-600" : "text-slate-600";
  return (
    <div className="min-h-[96px] rounded-lg border border-slate-200 bg-white p-3">
      <div className={`flex items-center gap-2 text-xs ${tone}`}>
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-semibold leading-5 text-slate-900">{value}</div>
    </div>
  );
}

function ActionButton({ as, href, icon: Icon, label }: { as: "a"; href: string; icon: typeof Route; label: string }) {
  return (
    <a href={href} className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-lg bg-blue-600 px-2 text-center text-sm font-medium text-white">
      <Icon className="h-5 w-5" />
      {label}
    </a>
  );
}

function statusText(status: AlarmRecord["status"]) {
  return status === "pending" ? "待处理" : status === "notified" ? "已通知" : status === "rider_cancelled" ? "骑手取消" : "已处理";
}

export default App;

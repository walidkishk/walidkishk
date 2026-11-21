import { useEffect, useState } from 'react';
import { Clock, Gauge, Server, Users } from 'lucide-react';
import type { PingProbeResponse, ServerDetailResponse } from '../types.ts';

interface ServerMetricsStripProps {
  serverData: ServerDetailResponse | null;
  pingData: PingProbeResponse | null;
  loading: boolean;
}

function formatDurationSeconds(totalSec: number): string {
  const safe = Math.max(0, totalSec);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
}

function getPingStatusLabelAr(ping: PingProbeResponse | null): { text: string; colorClass: string } {
  if (!ping || ping.bestLatencyMs === null) {
    return { text: 'غير متاح حالياً', colorClass: 'text-rose-600 dark:text-rose-400' };
  }
  if (ping.bestLatencyMs <= 45) {
    return { text: 'استجابة ممتازة', colorClass: 'text-emerald-600 dark:text-emerald-400' };
  }
  if (ping.bestLatencyMs <= 110) {
    return { text: 'استجابة جيدة', colorClass: 'text-sky-600 dark:text-sky-400' };
  }
  return { text: 'استجابة متوسطة', colorClass: 'text-amber-600 dark:text-amber-400' };
}

export function ServerMetricsStrip({ serverData, pingData, loading }: ServerMetricsStripProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  useEffect(() => {
    if (!serverData?.resetAtIso) return;
    const update = () => {
      const diff = Math.max(0, Math.floor((Date.parse(serverData.resetAtIso) - Date.now()) / 1000));
      setRemainingSeconds(diff);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [serverData?.resetAtIso]);

  if (loading && !serverData) {
    return (
      <section aria-label="إحصائيات الخادم" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="h-[112px] animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#09090b]"
          />
        ))}
      </section>
    );
  }

  const pingStatus = getPingStatusLabelAr(pingData);
  const activeServer = serverData?.server;
  const activeServicesCount = activeServer
    ? Object.values(activeServer.services).filter((s) => s === 'UP').length
    : 0;

  return (
    <section aria-label="إحصائيات الخادم الحية" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#09090b]">
        <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-zinc-400">
          <span>بينج السيرفر الفوري</span>
          <Gauge className="h-4 w-4 text-zinc-500" aria-hidden="true" />
        </div>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-semibold text-slate-950 tabular-nums dark:text-white">
            {pingData?.bestLatencyMs !== null && pingData?.bestLatencyMs !== undefined
              ? `${pingData.bestLatencyMs} ms`
              : '--'}
          </span>
          <span className={`text-xs font-medium ${pingStatus.colorClass}`}>{pingStatus.text}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
          <span>المتوسط: {pingData?.avgLatencyMs ?? '--'} ms</span>
          <span aria-hidden="true">·</span>
          <span>التذبذب: {pingData?.jitterMs ?? '--'} ms</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#09090b]">
        <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-zinc-400">
          <span>المتصلون الآن والحمل</span>
          <Users className="h-4 w-4 text-zinc-500" aria-hidden="true" />
        </div>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-semibold text-slate-950 tabular-nums dark:text-white">
            {activeServer?.estimatedConnectedUsers ?? 0}
          </span>
          <span className="text-xs text-slate-600 dark:text-zinc-300">متصل مقدّر</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
          <span>إشغال السيرفر: {activeServer?.accountUsagePercent ?? 0}%</span>
          <span aria-hidden="true">·</span>
          <span>اليوم: +{serverData?.siteStats.accountsCreatedToday ?? 0} حساب</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#09090b]">
        <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-zinc-400">
          <span>إعادة ضبط السيرفر اليومية</span>
          <Clock className="h-4 w-4 text-zinc-500" aria-hidden="true" />
        </div>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-semibold text-slate-950 tabular-nums dark:text-white" dir="ltr">
            {formatDurationSeconds(remainingSeconds)}
          </span>
          <span className="text-xs text-slate-500 dark:text-zinc-400">متبقي</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
          <span>موعد التصفير: {serverData?.resetClock ?? '06:00:00 pm'}</span>
          <span aria-hidden="true">·</span>
          <span>GMT+7</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#09090b]">
        <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-zinc-400">
          <span>حالة الخادم والخدمات</span>
          <Server className="h-4 w-4 text-zinc-500" aria-hidden="true" />
        </div>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span
            className={`text-xl font-semibold ${
              activeServer?.status === 'Online'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {activeServer?.status === 'Online' ? 'متصل Online' : 'متوقف Offline'}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
          <span>{activeServicesCount} / 5 خدمات نشطة</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">{activeServer?.host ?? 'de-2.stunnel.cc'}</span>
        </div>
      </div>
    </section>
  );
}

import { useState, type FormEvent } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Gauge,
  Globe,
  Play,
  Radar,
  SearchCheck,
} from 'lucide-react';
import type { HostDiscoveryResponse, HostProbeResult, PingProbeResponse } from '../types.ts';
import { AdSenseBanner } from './AdSenseBanner.tsx';

interface NetworkToolsPanelProps {
  serverHost: string;
  serverPing: PingProbeResponse | null;
  onUseSniHost: (host: string) => void;
}

type SpeedPhase = 'idle' | 'ping' | 'download' | 'upload' | 'done';

export function NetworkToolsPanel({
  serverHost,
  serverPing,
  onUseSniHost,
}: NetworkToolsPanelProps) {
  // Speed Test state
  const [speedPhase, setSpeedPhase] = useState<SpeedPhase>('idle');
  const [speedProgress, setSpeedProgress] = useState<number>(0);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [jitterMs, setJitterMs] = useState<number | null>(null);
  const [downloadMbps, setDownloadMbps] = useState<number | null>(null);
  const [uploadMbps, setUploadMbps] = useState<number | null>(null);
  const [speedError, setSpeedError] = useState<string | null>(null);

  // Host Tester state
  const [hostsInput, setHostsInput] = useState<string>(
    'creativecommons.org\nzoom.us\ncloudflare.com\n' + serverHost,
  );
  const [testingHosts, setTestingHosts] = useState<boolean>(false);
  const [hostResults, setHostResults] = useState<HostProbeResult[]>([]);
  const [hostTestError, setHostTestError] = useState<string | null>(null);

  // Host Discovery state
  const [discoverDomain, setDiscoverDomain] = useState<string>('creativecommons.org');
  const [discovering, setDiscovering] = useState<boolean>(false);
  const [discoveryData, setDiscoveryData] = useState<HostDiscoveryResponse | null>(null);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [appliedSni, setAppliedSni] = useState<string | null>(null);

  const handleApplySni = (host: string) => {
    onUseSniHost(host);
    setAppliedSni(host);
    setTimeout(() => setAppliedSni(null), 2000);
  };

  const runSpeedTest = async () => {
    setSpeedError(null);
    setSpeedProgress(0);
    setPingMs(null);
    setJitterMs(null);
    setDownloadMbps(null);
    setUploadMbps(null);

    try {
      // 1. Ping & Jitter
      setSpeedPhase('ping');
      const rtts: number[] = [];
      for (let i = 0; i < 5; i += 1) {
        const t0 = performance.now();
        await fetch(`/api/speedtest/ping?i=${i}&t=${Date.now()}`, { cache: 'no-store' });
        const dt = Math.max(1, Math.round(performance.now() - t0));
        rtts.push(dt);
        setSpeedProgress(Math.round(((i + 1) / 5) * 20));
      }
      const avgPing = Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length);
      const avgJitter = Math.round(
        rtts.map((v) => Math.abs(v - avgPing)).reduce((a, b) => a + b, 0) / rtts.length,
      );
      setPingMs(avgPing);
      setJitterMs(avgJitter);

      // 2. Download Speed (6 MB stream)
      setSpeedPhase('download');
      const dlMb = 6;
      const dlStart = performance.now();
      const dlRes = await fetch(`/api/speedtest/download?mb=${dlMb}&t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!dlRes.ok || !dlRes.body) {
        throw new Error('تعذر بدء اختبار التحميل');
      }
      const reader = dlRes.body.getReader();
      let receivedBytes = 0;
      const expectedBytes = dlMb * 1024 * 1024;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          receivedBytes += value.byteLength;
          const elapsedSec = Math.max(0.05, (performance.now() - dlStart) / 1000);
          const mbps = Number(((receivedBytes * 8) / (elapsedSec * 1_000_000)).toFixed(2));
          setDownloadMbps(mbps);
          setSpeedProgress(20 + Math.min(40, Math.round((receivedBytes / expectedBytes) * 40)));
        }
      }

      // 3. Upload Speed (3 MB payload)
      setSpeedPhase('upload');
      const uploadBytes = 3 * 1024 * 1024;
      const payload = new Uint8Array(uploadBytes);
      for (let i = 0; i < uploadBytes; i += 4096) {
        payload[i] = i & 0xff;
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const ulStart = performance.now();
        xhr.open('POST', `/api/speedtest/upload?t=${Date.now()}`);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');

        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable && ev.total > 0) {
            const elapsedSec = Math.max(0.05, (performance.now() - ulStart) / 1000);
            const mbps = Number(((ev.loaded * 8) / (elapsedSec * 1_000_000)).toFixed(2));
            setUploadMbps(mbps);
            setSpeedProgress(60 + Math.min(40, Math.round((ev.loaded / ev.total) * 40)));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const elapsedSec = Math.max(0.05, (performance.now() - ulStart) / 1000);
            const mbps = Number(((uploadBytes * 8) / (elapsedSec * 1_000_000)).toFixed(2));
            setUploadMbps(mbps);
            setSpeedProgress(100);
            resolve();
          } else {
            reject(new Error('فشل اختبار الرفع'));
          }
        };
        xhr.onerror = () => reject(new Error('تعذر الاتصال أثناء اختبار الرفع'));
        xhr.send(payload);
      });

      setSpeedPhase('done');
    } catch (err) {
      setSpeedError(err instanceof Error ? err.message : 'تعذر إتمام اختبار السرعة');
      setSpeedPhase('idle');
    }
  };

  const handleTestHosts = async (e: FormEvent) => {
    e.preventDefault();
    setHostTestError(null);
    const list = hostsInput
      .split(/[\n,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length === 0) {
      setHostTestError('أدخل هوست واحد على الأقل للاختبار.');
      return;
    }

    setTestingHosts(true);
    try {
      const res = await fetch('/api/hosts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hosts: list }),
      });
      const json = (await res.json()) as { results?: HostProbeResult[]; error?: string };
      if (!res.ok || !json.results) {
        throw new Error(json.error || 'فشل فحص الهوستات');
      }
      setHostResults(json.results);
    } catch (err) {
      setHostTestError(err instanceof Error ? err.message : 'حدث خطأ أثناء الفحص');
    } finally {
      setTestingHosts(false);
    }
  };

  const handleDiscoverHosts = async (e: FormEvent) => {
    e.preventDefault();
    setDiscoverError(null);
    if (!discoverDomain.trim()) {
      setDiscoverError('أدخل نطاقاً مثل creativecommons.org');
      return;
    }

    setDiscovering(true);
    try {
      const res = await fetch('/api/hosts/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: discoverDomain.trim() }),
      });
      const json = (await res.json()) as HostDiscoveryResponse & { error?: string };
      if (!res.ok || !json.hosts) {
        throw new Error(json.error || 'تعذر اكتشاف الهوستات');
      }
      setDiscoveryData(json);
    } catch (err) {
      setDiscoverError(err instanceof Error ? err.message : 'حدث خطأ أثناء الاكتشاف');
    } finally {
      setDiscovering(false);
    }
  };

  const isSpeedRunning = speedPhase === 'ping' || speedPhase === 'download' || speedPhase === 'upload';

  return (
    <div className="space-y-6">
      {/* 1. Internet Speed Test */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#09090b]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              اختبار سرعة الإنترنت والاتصال الفعلي
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              قياس فعلي لسرعة التحميل والرفع والبينج بين جهازك وخادم التطبيق مع استجابة خادم {serverHost}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void runSpeedTest()}
            disabled={isSpeedRunning}
            className="inline-flex min-h-[42px] items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            <span>{isSpeedRunning ? 'جارٍ الاختبار...' : 'بدء اختبار السرعة'}</span>
          </button>
        </div>

        {(isSpeedRunning || speedPhase === 'done') && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
              <span>
                {speedPhase === 'ping' && 'المرحلة 1/3: قياس البينج والتذبذب...'}
                {speedPhase === 'download' && 'المرحلة 2/3: قياس سرعة التحميل...'}
                {speedPhase === 'upload' && 'المرحلة 3/3: قياس سرعة الرفع...'}
                {speedPhase === 'done' && 'اكتمل اختبار السرعة'}
              </span>
              <span className="font-mono tabular-nums">{speedProgress}%</span>
            </div>
            <progress
              value={speedProgress}
              max={100}
              className="h-2 w-full overflow-hidden rounded-full accent-emerald-600 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-100 dark:[&::-webkit-progress-bar]:bg-zinc-900 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-emerald-600"
            />
          </div>
        )}

        {speedError && (
          <p role="alert" className="mt-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {speedError}
          </p>
        )}

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-black">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
              <span>سرعة التحميل</span>
              <ArrowDownToLine className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-slate-950 tabular-nums dark:text-white">
              {downloadMbps !== null ? `${downloadMbps} Mbps` : '--'}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-black">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
              <span>سرعة الرفع</span>
              <ArrowUpFromLine className="h-4 w-4 text-sky-500" aria-hidden="true" />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-slate-950 tabular-nums dark:text-white">
              {uploadMbps !== null ? `${uploadMbps} Mbps` : '--'}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-black">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
              <span>بينج وتذبذب الشبكة</span>
              <Gauge className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-slate-950 tabular-nums dark:text-white">
              {pingMs !== null ? `${pingMs} ms` : '--'}
            </div>
            <div className="mt-1 text-xs text-slate-500 tabular-nums dark:text-zinc-400">
              التذبذب: {jitterMs !== null ? `${jitterMs} ms` : '--'}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-black">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
              <span>بينج سيرفر {serverHost}</span>
              <Activity className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-slate-950 tabular-nums dark:text-white">
              {serverPing?.bestLatencyMs !== null && serverPing?.bestLatencyMs !== undefined
                ? `${serverPing.bestLatencyMs} ms`
                : '--'}
            </div>
            <div className="mt-1 text-xs text-slate-500 tabular-nums dark:text-zinc-400">
              فقدان الحزم: {serverPing?.packetLossPercent ?? 0}%
            </div>
          </div>
        </div>
      </section>

      <AdSenseBanner key="ad-middle-tools" placement="middle" />

      {/* 2. Host Tester & 3. Host Discovery */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Host Tester */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#09090b] lg:col-span-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-zinc-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                اختبار الهوستات (SNI / Bug Host Tester)
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                فحص DNS ومنافذ 80 / 443 ومصافحة TLS SNI وكشف شبكات CDN (حتى 12 هوست دفعة واحدة)
              </p>
            </div>
            <SearchCheck className="h-5 w-5 text-slate-400 dark:text-zinc-500" aria-hidden="true" />
          </div>

          <form onSubmit={handleTestHosts} className="mt-4 space-y-4">
            <div>
              <label htmlFor="hosts-textarea" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                أدخل الهوستات (كل هوست في سطر أو مفصولة بفاصلة)
              </label>
              <textarea
                id="hosts-textarea"
                rows={4}
                dir="ltr"
                value={hostsInput}
                onChange={(e) => setHostsInput(e.target.value)}
                placeholder="creativecommons.org&#10;zoom.us&#10;cdn.cloudflare.net"
                className="w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
              />
            </div>

            {hostTestError && (
              <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {hostTestError}
              </p>
            )}

            <button
              type="submit"
              disabled={testingHosts}
              className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-black dark:hover:bg-white"
            >
              <SearchCheck className="h-4 w-4" aria-hidden="true" />
              <span>{testingHosts ? 'جارٍ فحص الهوستات...' : 'فحص الهوستات الآن'}</span>
            </button>
          </form>

          {hostResults.length > 0 && (
            <div className="mt-5 overflow-x-auto border-t border-slate-200 pt-4 dark:border-zinc-800">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="py-2 pl-3">الهوست / IP</th>
                    <th className="py-2 pl-3">المنافذ</th>
                    <th className="py-2 pl-3">HTTP / CDN</th>
                    <th className="py-2 text-left">تطبيق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-900">
                  {hostResults.map((item) => (
                    <tr key={item.host}>
                      <td className="py-2.5 pl-3">
                        <div className="font-mono font-semibold text-slate-900 dark:text-white" dir="ltr">
                          {item.host}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 dark:text-zinc-400" dir="ltr">
                          {item.resolvedIp ?? item.errorReason ?? '--'}
                        </div>
                      </td>
                      <td className="py-2.5 pl-3 font-mono tabular-nums">
                        <div className={item.port443Open ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
                          443: {item.port443Open ? `${item.port443Ms}ms` : 'مغلق'}
                        </div>
                        <div className={item.port80Open ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500'}>
                          80: {item.port80Open ? `${item.port80Ms}ms` : 'مغلق'}
                        </div>
                      </td>
                      <td className="py-2.5 pl-3">
                        <div className="font-mono font-medium text-slate-800 dark:text-zinc-200">
                          {item.httpStatus ? `HTTP ${item.httpStatus}` : item.tlsSniSupported ? 'TLS SNI OK' : '--'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                          {item.cdnDetected || item.serverHeader || 'مباشر'}
                        </div>
                      </td>
                      <td className="py-2.5 text-left">
                        <button
                          type="button"
                          disabled={item.status === 'unreachable' || item.status === 'blocked'}
                          onClick={() => handleApplySni(item.host)}
                          className="inline-flex min-h-[32px] items-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                        >
                          {appliedSni === item.host ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                              <span>تم التعيين</span>
                            </>
                          ) : (
                            <span>استخدام SNI</span>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Host Discovery */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#09090b] lg:col-span-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-zinc-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                اكتشاف الهوستات والنطاقات الفرعية
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                مسح تلقائي لـ 20 نطاقاً فرعياً شائعاً (cdn, ws, api, edge, stream...) واكتشاف الهوستات العاملة
              </p>
            </div>
            <Radar className="h-5 w-5 text-slate-400 dark:text-zinc-500" aria-hidden="true" />
          </div>

          <form onSubmit={handleDiscoverHosts} className="mt-4 space-y-4">
            <div>
              <label htmlFor="discover-domain" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                النطاق الأساسي للبحث والاكتشاف
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="discover-domain"
                    type="text"
                    dir="ltr"
                    value={discoverDomain}
                    onChange={(e) => setDiscoverDomain(e.target.value)}
                    placeholder="creativecommons.org"
                    className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={discovering}
                  className="inline-flex min-h-[42px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
                >
                  <Radar className={`h-4 w-4 ${discovering ? 'animate-spin' : ''}`} aria-hidden="true" />
                  <span>{discovering ? 'جارٍ المسح...' : 'اكتشاف الهوستات'}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-500 dark:text-zinc-400">نطاقات سريعة:</span>
              {['creativecommons.org', 'stunnel.cc', 'cloudflare.com', 'zoom.us'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDiscoverDomain(preset)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700 hover:bg-slate-100 dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  {preset}
                </button>
              ))}
            </div>

            {discoverError && (
              <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {discoverError}
              </p>
            )}
          </form>

          {discoveryData && (
            <div className="mt-5 border-t border-slate-200 pt-4 dark:border-zinc-800">
              <div className="mb-3 flex items-center justify-between text-xs text-slate-600 dark:text-zinc-300">
                <span>
                  تم اكتشاف <strong className="font-mono text-emerald-600 dark:text-emerald-400">{discoveryData.discoveredCount}</strong> هوست عامل من أصل {discoveryData.scannedCount}
                </span>
                <span className="font-mono text-[11px] text-slate-400" dir="ltr">
                  {discoveryData.rootDomain}
                </span>
              </div>

              {discoveryData.hosts.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-500 dark:text-zinc-400">
                  لم يتم العثور على نطاقات فرعية مستجيبة لهذا النطاق.
                </p>
              ) : (
                <div className="max-h-72 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                        <th className="py-2 pl-3">الهوست المكتشف</th>
                        <th className="py-2 pl-3">الاستجابة</th>
                        <th className="py-2 pl-3">CDN / الحالة</th>
                        <th className="py-2 text-left">تعيين</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-900">
                      {discoveryData.hosts.map((item) => (
                        <tr key={item.host}>
                          <td className="py-2.5 pl-3">
                            <div className="font-mono font-semibold text-slate-900 dark:text-white" dir="ltr">
                              {item.host}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500 dark:text-zinc-400" dir="ltr">
                              {item.resolvedIp}
                            </div>
                          </td>
                          <td className="py-2.5 pl-3 font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                            {item.port443Ms ? `${item.port443Ms}ms (443)` : item.port80Ms ? `${item.port80Ms}ms (80)` : '--'}
                          </td>
                          <td className="py-2.5 pl-3">
                            <div className="font-medium text-slate-800 dark:text-zinc-200">
                              {item.cdnDetected || (item.tlsSniSupported ? 'TLS SNI' : 'HTTP')}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                              {item.wsReady ? 'جاهز للـ WebSocket/SNI' : 'منفذ مفتوح'}
                            </div>
                          </td>
                          <td className="py-2.5 text-left">
                            <button
                              type="button"
                              onClick={() => handleApplySni(item.host)}
                              className="inline-flex min-h-[32px] items-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            >
                              {appliedSni === item.host ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                                  <span>تم</span>
                                </>
                              ) : (
                                <span>تعيين SNI</span>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

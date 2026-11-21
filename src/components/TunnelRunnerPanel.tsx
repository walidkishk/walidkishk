import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  Globe,
  Play,
  RefreshCw,
  ShieldCheck,
  Square,
  Terminal,
  Trash2,
  Wifi,
  XCircle,
} from 'lucide-react';
import type {
  FormatCheckResult,
  ProtocolFormatId,
  SavedVpnAccount,
  ServerDetailResponse,
  TunnelConnectionStatus,
  TunnelConnectPayload,
  TunnelHeartbeatResponse,
  TunnelLogEntry,
  TunnelSessionMetrics,
  TunnelTrafficTestResult,
} from '../types.ts';
import { getProtocolLabelAr } from '../utils/configGenerators.ts';
import { parseTunnelConfigInput } from '../utils/tunnelConfigParser.ts';
import { AdSenseBanner } from './AdSenseBanner.tsx';

interface TunnelRunnerPanelProps {
  serverData: ServerDetailResponse | null;
  accounts: SavedVpnAccount[];
  defaultSni: string;
}

const PROTOCOL_OPTIONS: Array<{
  id: ProtocolFormatId;
  shortLabel: string;
  defaultPort: number;
  quickPorts: number[];
}> = [
  { id: 'ssh_ws', shortLabel: 'SSH WebSocket', defaultPort: 80, quickPorts: [80, 443, 8880, 2052, 2082, 2095] },
  { id: 'ssh_ssl', shortLabel: 'SSH SSL / TLS', defaultPort: 443, quickPorts: [443, 110, 587] },
  { id: 'ssh_dropbear', shortLabel: 'SSH Dropbear', defaultPort: 143, quickPorts: [143, 444, 5555] },
  { id: 'v2ray_vless', shortLabel: 'V2Ray VLESS', defaultPort: 443, quickPorts: [443, 8443, 2053, 2083, 2096, 80] },
  { id: 'v2ray_vmess', shortLabel: 'V2Ray VMess', defaultPort: 443, quickPorts: [443, 8443, 2053, 2083, 80] },
  { id: 'slowdns', shortLabel: 'SlowDNS (DNSTT)', defaultPort: 53, quickPorts: [53] },
  { id: 'wireguard', shortLabel: 'WireGuard', defaultPort: 51820, quickPorts: [51820] },
  { id: 'noobzvpn', shortLabel: 'NoobzVpn', defaultPort: 2053, quickPorts: [2053, 2083] },
  { id: 'squid', shortLabel: 'Squid Proxy', defaultPort: 8080, quickPorts: [8080, 3128, 8000] },
];

const DEFAULT_WS_PAYLOAD =
  'GET / HTTP/1.1[crlf]Host: [sni][crlf]Upgrade: websocket[crlf]Connection: Upgrade[crlf][crlf]';

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${Math.max(0, bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDurationClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = String(Math.floor(s / 3600)).padStart(2, '0');
  const mins = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const secs = String(s % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

export function TunnelRunnerPanel({
  serverData,
  accounts,
  defaultSni,
}: TunnelRunnerPanelProps) {
  const initialServer = serverData?.server;
  const [protocol, setProtocol] = useState<ProtocolFormatId>('ssh_ws');
  const [host, setHost] = useState<string>(initialServer?.host || 'de-2.stunnel.cc');
  const [port, setPort] = useState<number>(80);
  const [sni, setSni] = useState<string>(defaultSni || 'creativecommons.org');
  const [wsPath, setWsPath] = useState<string>('/');
  const [useTls, setUseTls] = useState<boolean>(false);
  const [customPayload, setCustomPayload] = useState<string>(DEFAULT_WS_PAYLOAD);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [uuid, setUuid] = useState<string>('');
  const [v2rayTransport, setV2rayTransport] = useState<'ws' | 'tcp' | 'grpc'>('ws');
  const [v2raySecurity, setV2raySecurity] = useState<'tls' | 'reality' | 'none'>('tls');
  const [slowDnsHost, setSlowDnsHost] = useState<string>(initialServer?.slowDnsHost || '');
  const [dnsResolver, setDnsResolver] = useState<string>('1.1.1.1');
  const [wireguardPrivateKey, setWireguardPrivateKey] = useState<string>('');
  const [wireguardPublicKey, setWireguardPublicKey] = useState<string>('');

  const [selectedSavedId, setSelectedSavedId] = useState<string>('');
  const [showImportBox, setShowImportBox] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const [status, setStatus] = useState<TunnelConnectionStatus>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<TunnelSessionMetrics | null>(null);
  const [liveLatencyMs, setLiveLatencyMs] = useState<number | null>(null);
  const [bytesSent, setBytesSent] = useState<number>(0);
  const [bytesReceived, setBytesReceived] = useState<number>(0);
  const [uptimeSec, setUptimeSec] = useState<number>(0);
  const [logs, setLogs] = useState<TunnelLogEntry[]>([]);
  const [trafficTesting, setTrafficTesting] = useState<boolean>(false);
  const [trafficResult, setTrafficResult] = useState<TunnelTrafficTestResult | null>(null);
  const [probingAllFormats, setProbingAllFormats] = useState<boolean>(false);
  const [allFormatChecks, setAllFormatChecks] = useState<FormatCheckResult[]>([]);
  const [copiedLog, setCopiedLog] = useState<boolean>(false);

  const logBoxRef = useRef<HTMLDivElement | null>(null);
  const activeSessionRef = useRef<string | null>(null);

  useEffect(() => {
    activeSessionRef.current = sessionId;
  }, [sessionId]);

  // Clean up live backend tunnel session when component unmounts
  useEffect(() => {
    return () => {
      if (activeSessionRef.current) {
        void fetch('/api/tunnel/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: activeSessionRef.current }),
        }).catch(() => undefined);
      }
    };
  }, []);

  // Auto-scroll tunnel logs cleanly inside the log container
  useEffect(() => {
    const el = logBoxRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  // Live uptime counter while connected
  useEffect(() => {
    if (status !== 'connected') {
      setUptimeSec(0);
      return;
    }
    const timer = setInterval(() => {
      setUptimeSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  const appendClientLog = useCallback(
    (stage: TunnelLogEntry['stage'], level: TunnelLogEntry['level'], message: string) => {
      setLogs((prev) => [
        ...prev.slice(-140),
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          ts: new Date().toISOString(),
          stage,
          level,
          message,
        },
      ]);
    },
    [],
  );

  // Live real heartbeat every 5s while connected
  useEffect(() => {
    if (status !== 'connected' || !sessionId) return;
    const interval = setInterval(() => {
      void fetch('/api/tunnel/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
        .then(async (res) => {
          if (!res.ok) return;
          const hb = (await res.json()) as TunnelHeartbeatResponse;
          setBytesSent(hb.bytesSent);
          setBytesReceived(hb.bytesReceived);
          if (hb.alive) {
            setLiveLatencyMs(hb.latencyMs);
          } else {
            appendClientLog('TUNNEL', 'error', hb.detailAr || 'انقطع نبض النفق');
            setStatus('failed');
            setSessionId(null);
          }
        })
        .catch(() => {
          // ignore transient browser poll drop
        });
    }, 5000);
    return () => clearInterval(interval);
  }, [appendClientLog, sessionId, status]);

  const activeProtoSpec = useMemo(
    () => PROTOCOL_OPTIONS.find((p) => p.id === protocol) || PROTOCOL_OPTIONS[0],
    [protocol],
  );

  const handleSelectProtocol = (nextProto: ProtocolFormatId) => {
    setProtocol(nextProto);
    const spec = PROTOCOL_OPTIONS.find((p) => p.id === nextProto);
    if (spec) {
      setPort(spec.defaultPort);
      setUseTls(
        nextProto === 'ssh_ssl' ||
          nextProto === 'v2ray_vless' ||
          nextProto === 'v2ray_vmess' ||
          spec.defaultPort === 443 ||
          spec.defaultPort === 2083,
      );
    }
    if (nextProto === 'v2ray_vmess' && (!wsPath || wsPath === '/' || wsPath === '/vless')) {
      setWsPath('/vmess');
    } else if (nextProto === 'v2ray_vless' && (!wsPath || wsPath === '/' || wsPath === '/vmess')) {
      setWsPath('/vless');
    } else if (nextProto === 'ssh_ws' && (wsPath === '/vless' || wsPath === '/vmess')) {
      setWsPath('/');
    }
  };

  const applyParsedConfig = (parsed: Partial<TunnelConnectPayload>) => {
    if (parsed.protocol) setProtocol(parsed.protocol);
    if (parsed.host) setHost(parsed.host);
    if (typeof parsed.port === 'number' && parsed.port > 0) setPort(parsed.port);
    if (parsed.sni) setSni(parsed.sni);
    if (parsed.wsPath) setWsPath(parsed.wsPath);
    if (typeof parsed.useTls === 'boolean') setUseTls(parsed.useTls);
    if (parsed.username !== undefined) setUsername(parsed.username);
    if (parsed.password !== undefined) setPassword(parsed.password);
    if (parsed.uuid !== undefined) setUuid(parsed.uuid);
    if (parsed.v2rayTransport) setV2rayTransport(parsed.v2rayTransport);
    if (parsed.v2raySecurity) setV2raySecurity(parsed.v2raySecurity);
    if (parsed.slowDnsHost) setSlowDnsHost(parsed.slowDnsHost);
    if (parsed.dnsResolver) setDnsResolver(parsed.dnsResolver);
    if (parsed.wireguardPrivateKey) setWireguardPrivateKey(parsed.wireguardPrivateKey);
    if (parsed.wireguardPublicKey) setWireguardPublicKey(parsed.wireguardPublicKey);
  };

  const handleLoadSavedAccount = (accountId: string) => {
    setSelectedSavedId(accountId);
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) return;
    setProtocol(acc.protocol);
    setHost(acc.host);
    setPort(acc.port);
    setSni(acc.sni || acc.host);
    setUsername(acc.username);
    setPassword(acc.password);
    setUuid(acc.uuid || '');
    setSlowDnsHost(acc.slowDnsHost || `dns.${acc.host}`);
    setWireguardPrivateKey(acc.wireguardPrivateKey || '');
    setWireguardPublicKey(acc.wireguardPublicKey || '');
    setUseTls(
      acc.protocol === 'ssh_ssl' ||
        acc.protocol === 'v2ray_vless' ||
        acc.protocol === 'v2ray_vmess' ||
        acc.port === 443 ||
        acc.port === 2083 ||
        acc.port === 8443,
    );
    if (acc.protocol === 'v2ray_vmess') setWsPath('/vmess');
    else if (acc.protocol === 'v2ray_vless') setWsPath('/vless');
    else setWsPath('/');
    appendClientLog(
      'TUNNEL',
      'info',
      `تم تحميل بيانات الحساب (${acc.customName || acc.username}) على ${acc.host}:${acc.port} (${getProtocolLabelAr(acc.protocol)}).`,
    );
  };

  const handleParseImport = () => {
    setImportNotice(null);
    const parsed = parseTunnelConfigInput(importText);
    if (!parsed) {
      setImportNotice('تعذر التعرف على تنسيق الرابط أو الملف — ادعم vless:// و vmess:// و ssh:// و http:// و WireGuard .conf و JSON.');
      return;
    }
    applyParsedConfig(parsed);
    setImportNotice('تم استيراد جميع بيانات الإعداد بنجاح — اضغط «تشغيل النفق» الآن.');
    setShowImportBox(false);
    setImportText('');
    appendClientLog('TUNNEL', 'success', `تم استيراد إعداد ${parsed.protocol ? getProtocolLabelAr(parsed.protocol) : ''} -> ${parsed.host}:${parsed.port || '--'}`);
  };

  const handleConnect = async () => {
    if (!host.trim()) {
      appendClientLog('DNS', 'error', 'يرجى إدخال عنوان الخادم (Host أو IP) أولاً.');
      setStatus('failed');
      return;
    }
    if (sessionId) {
      await fetch('/api/tunnel/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).catch(() => undefined);
    }

    setStatus('connecting');
    setSessionId(null);
    setMetrics(null);
    setTrafficResult(null);
    setLiveLatencyMs(null);
    setBytesSent(0);
    setBytesReceived(0);
    setLogs([]);
    appendClientLog('TUNNEL', 'info', `بدء تشغيل النفق (${getProtocolLabelAr(protocol)}) -> ${host.trim()}:${port}`);

    try {
      const payload: TunnelConnectPayload = {
        protocol,
        host: host.trim(),
        port: Number(port) || activeProtoSpec.defaultPort,
        sni: sni.trim() || host.trim(),
        wsPath: wsPath.trim() || '/',
        customPayload: protocol === 'ssh_ws' ? customPayload : undefined,
        username: username.trim(),
        password: password.trim(),
        uuid: uuid.trim(),
        v2rayTransport,
        v2raySecurity,
        slowDnsHost: slowDnsHost.trim() || `dns.${host.trim()}`,
        dnsResolver: dnsResolver.trim() || '1.1.1.1',
        wireguardPrivateKey: wireguardPrivateKey.trim(),
        wireguardPublicKey: wireguardPublicKey.trim(),
        useTls,
      };

      const res = await fetch('/api/tunnel/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as TunnelSessionMetrics & { error?: string };

      if (Array.isArray(json.logs) && json.logs.length > 0) {
        setLogs(json.logs);
      }
      setMetrics(json);
      setBytesSent(json.bytesSent || 0);
      setBytesReceived(json.bytesReceived || 0);

      if (res.ok && json.connected && json.sessionId) {
        setSessionId(json.sessionId);
        setLiveLatencyMs(json.handshakeMs ?? json.tcpMs ?? json.dnsMs);
        setStatus('connected');
      } else {
        setSessionId(null);
        setStatus('failed');
        if (json.error && (!json.logs || json.logs.length === 0)) {
          appendClientLog('TUNNEL', 'error', json.error);
        }
      }
    } catch (err) {
      setStatus('failed');
      appendClientLog(
        'TUNNEL',
        'error',
        err instanceof Error ? err.message : 'تعذر الاتصال بمحرك النفق على الخادم',
      );
    }
  };

  const handleDisconnect = async () => {
    const idToClose = sessionId;
    setStatus('disconnected');
    setSessionId(null);
    if (idToClose) {
      const res = await fetch('/api/tunnel/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: idToClose }),
      }).catch(() => null);
      if (res && res.ok) {
        const sum = (await res.json()) as { bytesSent: number; bytesReceived: number };
        setBytesSent(sum.bytesSent || bytesSent);
        setBytesReceived(sum.bytesReceived || bytesReceived);
      }
    }
    appendClientLog('TUNNEL', 'info', 'تم إيقاف اتصال النفق وإغلاق الجلسة.');
  };

  const handleTestTraffic = async () => {
    if (!sessionId || status !== 'connected') return;
    setTrafficTesting(true);
    try {
      const res = await fetch('/api/tunnel/test-traffic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const json = (await res.json()) as TunnelTrafficTestResult;
      setTrafficResult(json);
      setBytesSent(json.bytesSent);
      setBytesReceived(json.bytesReceived);
      if (json.latencyMs !== null) setLiveLatencyMs(json.latencyMs);
      if (Array.isArray(json.logs)) {
        setLogs((prev) => [...prev.slice(-120), ...json.logs]);
      }
    } catch (err) {
      appendClientLog(
        'TUNNEL',
        'error',
        err instanceof Error ? err.message : 'فشل اختبار تمرير التصفح',
      );
    } finally {
      setTrafficTesting(false);
    }
  };

  const handleManualHeartbeat = async () => {
    if (!sessionId || status !== 'connected') return;
    try {
      const res = await fetch('/api/tunnel/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) return;
      const hb = (await res.json()) as TunnelHeartbeatResponse;
      setBytesSent(hb.bytesSent);
      setBytesReceived(hb.bytesReceived);
      if (hb.alive) {
        setLiveLatencyMs(hb.latencyMs);
        appendClientLog('TUNNEL', 'success', hb.detailAr);
      } else {
        setStatus('failed');
        setSessionId(null);
        appendClientLog('TUNNEL', 'error', hb.detailAr);
      }
    } catch {
      // ignore
    }
  };

  const handleProbeAllProtocols = async () => {
    if (!host.trim()) return;
    setProbingAllFormats(true);
    setAllFormatChecks([]);
    appendClientLog('TUNNEL', 'info', `بدء فحص جاهزية جميع البروتوكولات التسعة على (${host.trim()})...`);
    try {
      const res = await fetch('/api/accounts/verify-formats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId: '15',
          host: host.trim(),
          slowDnsHost: slowDnsHost.trim() || `dns.${host.trim()}`,
          sni: sni.trim() || host.trim(),
          username: username.trim() || 'check',
          password: password.trim() || 'check',
          uuid: uuid.trim() || undefined,
          wireguardPrivateKey: wireguardPrivateKey.trim() || undefined,
          wireguardPublicKey: wireguardPublicKey.trim() || undefined,
        }),
      });
      const json = (await res.json()) as {
        formatChecks?: FormatCheckResult[];
        error?: string;
      };
      if (res.ok && json.formatChecks) {
        setAllFormatChecks(json.formatChecks);
        const workingCount = json.formatChecks.filter((c) => c.reachable).length;
        appendClientLog(
          'TUNNEL',
          workingCount > 0 ? 'success' : 'warn',
          `اكتمل فحص البروتوكولات التسعة: ${workingCount} من 9 بروتوكولات مستجيبة على ${host.trim()}.`,
        );
      } else {
        appendClientLog('TUNNEL', 'error', json.error || 'تعذر إتمام فحص البروتوكولات التسعة.');
      }
    } catch (err) {
      appendClientLog(
        'TUNNEL',
        'error',
        err instanceof Error ? err.message : 'فشل الاتصال بنقطة فحص البروتوكولات',
      );
    } finally {
      setProbingAllFormats(false);
    }
  };

  const handleCopyLogs = async () => {
    const text = logs
      .map((l) => `[${new Date(l.ts).toLocaleTimeString('en-GB')}] [${l.stage}] ${l.message}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLog(true);
      setTimeout(() => setCopiedLog(false), 1600);
    } catch {
      // ignore
    }
  };

  const needsSni =
    protocol === 'ssh_ws' ||
    protocol === 'ssh_ssl' ||
    protocol === 'v2ray_vmess' ||
    protocol === 'v2ray_vless' ||
    protocol === 'noobzvpn';
  const needsUserPass =
    protocol === 'ssh_ws' ||
    protocol === 'ssh_ssl' ||
    protocol === 'ssh_dropbear' ||
    protocol === 'noobzvpn' ||
    protocol === 'squid' ||
    protocol === 'slowdns';
  const isV2Ray = protocol === 'v2ray_vmess' || protocol === 'v2ray_vless';

  return (
    <section className="space-y-5">
      {/* Main Tunnel Workspace Container */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-[#09090b]">
        {/* Header & Quick Loaders */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-slate-950 sm:text-lg dark:text-white">
              تشغيل وتجربة الحسابات مباشرة (محرك النفق متعدد البروتوكولات)
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              فحص وتشغيل فعلي لجميع البروتوكولات التسعة (DNS · TLS/SNI · HTTP Upgrade · SSH Auth · Proxy · SlowDNS · WireGuard) كما في تطبيقات الـ Tunnel
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {accounts.length > 0 && (
              <select
                value={selectedSavedId}
                onChange={(e) => handleLoadSavedAccount(e.target.value)}
                aria-label="تحميل حساب محفوظ"
                className="min-h-[40px] max-w-[240px] rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
              >
                <option value="">تحميل من الحسابات المحفوظة...</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {(acc.customName || acc.username)} · {getProtocolLabelAr(acc.protocol)} ({acc.host})
                  </option>
                ))}
              </select>
            )}

            {serverData?.allServers && serverData.allServers.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const srv = serverData.allServers.find((s) => s.serverId === e.target.value);
                  if (srv) {
                    setHost(srv.host);
                    setSlowDnsHost(srv.slowDnsHost || `dns.${srv.host}`);
                    appendClientLog('TUNNEL', 'info', `تم تحديد السيرفر الحي: ${srv.name} (${srv.host})`);
                  }
                }}
                aria-label="اختيار سيرفر من القائمة"
                className="min-h-[40px] max-w-[220px] rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
              >
                <option value="">اختيار سيرفر حي من الموقع...</option>
                {serverData.allServers.slice(0, 60).map((srv) => (
                  <option key={srv.serverId} value={srv.serverId}>
                    {srv.countryAr} · {srv.name} ({srv.host})
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => {
                setShowImportBox((v) => !v);
                setImportNotice(null);
              }}
              className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
              <span>لصق رابط / ملف إعداد</span>
            </button>
          </div>
        </div>

        {/* Paste Raw URI / .conf Importer Drawer */}
        {showImportBox && (
          <div className="mt-4 space-y-2.5 border-b border-slate-200 pb-4 dark:border-zinc-800">
            <label
              htmlFor="tunnel-import-raw"
              className="block text-xs font-semibold text-slate-700 dark:text-zinc-200"
            >
              الصق رابط (vless:// / vmess:// / ssh:// / http:// / noobz:// / dns://) أو محتوى ملف WireGuard (.conf) أو JSON:
            </label>
            <textarea
              id="tunnel-import-raw"
              rows={3}
              dir="ltr"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="vless://uuid@host:443?type=ws&security=tls&sni=creativecommons.org&path=%2Fvless#Name"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                يستخرج المضيف والمنفذ و UUID وكلمة المرور والـ SNI تلقائياً بدون إرسال أي بيانات خارجية.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportBox(false)}
                  className="min-h-[36px] rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  onClick={handleParseImport}
                  className="min-h-[36px] rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  استيراد وتعبئة الحقول
                </button>
              </div>
            </div>
          </div>
        )}

        {importNotice && (
          <div className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            {importNotice}
          </div>
        )}

        {/* All 9 Protocols Selector */}
        <div className="mt-4">
          <span className="mb-2 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
            اختر البروتوكول المطلوب تشغيله واختباره (جميع البروتوكولات التسعة مدعومة):
          </span>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-9">
            {PROTOCOL_OPTIONS.map((opt) => {
              const active = protocol === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectProtocol(opt.id)}
                  className={`flex min-h-[40px] items-center justify-center rounded-lg border px-2 py-2 text-center text-xs font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900'
                  }`}
                >
                  <span className="truncate">{opt.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main 2-Column Tunnel Workspace */}
        <div className="mt-5 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
          {/* Left Column: Protocol Configuration & Controls */}
          <div className="space-y-4 lg:col-span-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label
                  htmlFor="tunnel-host"
                  className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                >
                  المضيف أو IP الخادم (Host / IP):
                </label>
                <input
                  id="tunnel-host"
                  type="text"
                  dir="ltr"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="de-2.stunnel.cc"
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                />
              </div>

              <div>
                <label
                  htmlFor="tunnel-port"
                  className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                >
                  المنفذ (Port):
                </label>
                <input
                  id="tunnel-port"
                  type="number"
                  min={1}
                  max={65535}
                  dir="ltr"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value) || activeProtoSpec.defaultPort)}
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 tabular-nums focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                />
              </div>
            </div>

            {/* Quick Port Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-slate-500 dark:text-zinc-400">منافذ شائعة:</span>
              {activeProtoSpec.quickPorts.map((qp) => (
                <button
                  key={qp}
                  type="button"
                  onClick={() => {
                    setPort(qp);
                    if (protocol === 'ssh_ws' || protocol === 'noobzvpn') {
                      setUseTls(qp === 443 || qp === 2083 || qp === 8443 || qp === 2053);
                    }
                  }}
                  className={`rounded-md border px-2 py-1 font-mono font-semibold tabular-nums transition-colors ${
                    port === qp
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900'
                  }`}
                >
                  :{qp}
                </button>
              ))}

              {(protocol === 'ssh_ws' || protocol === 'noobzvpn') && (
                <label className="mr-auto inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={useTls}
                    onChange={(e) => setUseTls(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>تفعيل طبقة SSL/TLS</span>
                </label>
              )}
            </div>

            {needsSni && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="tunnel-sni"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                  >
                    SNI / Bug Host (الهوست):
                  </label>
                  <input
                    id="tunnel-sni"
                    type="text"
                    dir="ltr"
                    value={sni}
                    onChange={(e) => setSni(e.target.value)}
                    placeholder="creativecommons.org"
                    className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                  />
                </div>

                {(protocol === 'ssh_ws' || (isV2Ray && v2rayTransport === 'ws')) && (
                  <div>
                    <label
                      htmlFor="tunnel-wspath"
                      className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                    >
                      مسار WebSocket (Path):
                    </label>
                    <input
                      id="tunnel-wspath"
                      type="text"
                      dir="ltr"
                      value={wsPath}
                      onChange={(e) => setWsPath(e.target.value)}
                      placeholder="/"
                      className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                    />
                  </div>
                )}
              </div>
            )}

            {isV2Ray && (
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="tunnel-uuid"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                  >
                    معرف UUID الخاص بـ {protocol === 'v2ray_vmess' ? 'VMess' : 'VLESS'}:
                  </label>
                  <input
                    id="tunnel-uuid"
                    type="text"
                    dir="ltr"
                    value={uuid}
                    onChange={(e) => setUuid(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
                    className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="tunnel-v2-net"
                      className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                    >
                      نوع النقل (Transport):
                    </label>
                    <select
                      id="tunnel-v2-net"
                      value={v2rayTransport}
                      onChange={(e) => setV2rayTransport(e.target.value as 'ws' | 'tcp' | 'grpc')}
                      className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                    >
                      <option value="ws">WebSocket (ws)</option>
                      <option value="tcp">TCP مباشر</option>
                      <option value="grpc">gRPC (HTTP/2)</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="tunnel-v2-sec"
                      className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                    >
                      التشفير (Security):
                    </label>
                    <select
                      id="tunnel-v2-sec"
                      value={v2raySecurity}
                      onChange={(e) => {
                        const val = e.target.value as 'tls' | 'reality' | 'none';
                        setV2raySecurity(val);
                        setUseTls(val !== 'none');
                      }}
                      className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                    >
                      <option value="tls">TLS</option>
                      <option value="reality">Reality</option>
                      <option value="none">بدون تشفير (None)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {needsUserPass && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="tunnel-user"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                  >
                    اسم المستخدم (Username){protocol === 'squid' ? ' — اختياري' : ''}:
                  </label>
                  <input
                    id="tunnel-user"
                    type="text"
                    dir="ltr"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="tunnel-pass"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                  >
                    كلمة المرور (Password){protocol === 'squid' ? ' — اختياري' : ''}:
                  </label>
                  <input
                    id="tunnel-pass"
                    type="text"
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="password"
                    className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                  />
                </div>
              </div>
            )}

            {protocol === 'ssh_ws' && (
              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="tunnel-payload"
                    className="text-xs font-semibold text-slate-700 dark:text-zinc-300"
                  >
                    بايلود الحقن (HTTP Payload — يدعم [crlf] و [sni]):
                  </label>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setCustomPayload(DEFAULT_WS_PAYLOAD)}
                      className="rounded border border-slate-200 px-2 py-0.5 text-slate-600 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      WS قياسي
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCustomPayload(
                          'GET / HTTP/1.1[crlf]Host: [sni][crlf]X-Online-Host: [sni][crlf]Upgrade: websocket[crlf]Connection: Upgrade[crlf][crlf]',
                        )
                      }
                      className="rounded border border-slate-200 px-2 py-0.5 text-slate-600 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      CDN Host
                    </button>
                  </div>
                </div>
                <textarea
                  id="tunnel-payload"
                  rows={2}
                  dir="ltr"
                  value={customPayload}
                  onChange={(e) => setCustomPayload(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                />
              </div>
            )}

            {protocol === 'slowdns' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="tunnel-ns"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                  >
                    نطاق الأسماء (Nameserver / NS):
                  </label>
                  <input
                    id="tunnel-ns"
                    type="text"
                    dir="ltr"
                    value={slowDnsHost}
                    onChange={(e) => setSlowDnsHost(e.target.value)}
                    placeholder={`dns.${host || 'example.com'}`}
                    className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="tunnel-resolver"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                  >
                    خادم DNS Resolver:
                  </label>
                  <input
                    id="tunnel-resolver"
                    type="text"
                    dir="ltr"
                    value={dnsResolver}
                    onChange={(e) => setDnsResolver(e.target.value)}
                    placeholder="1.1.1.1"
                    className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                  />
                </div>
              </div>
            )}

            {protocol === 'wireguard' && (
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="tunnel-wg-priv"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                  >
                    المفتاح الخاص للعميل (Interface PrivateKey):
                  </label>
                  <input
                    id="tunnel-wg-priv"
                    type="text"
                    dir="ltr"
                    value={wireguardPrivateKey}
                    onChange={(e) => setWireguardPrivateKey(e.target.value)}
                    placeholder="Base64 32-byte PrivateKey"
                    className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="tunnel-wg-pub"
                    className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                  >
                    المفتاح العام للسيرفر (Peer PublicKey):
                  </label>
                  <input
                    id="tunnel-wg-pub"
                    type="text"
                    dir="ltr"
                    value={wireguardPublicKey}
                    onChange={(e) => setWireguardPublicKey(e.target.value)}
                    placeholder="Base64 32-byte PublicKey"
                    className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                  />
                </div>
              </div>
            )}

            {/* Primary Connect / Disconnect + All-9-Protocol Check */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              {status === 'connected' ? (
                <button
                  type="button"
                  onClick={() => void handleDisconnect()}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-500"
                >
                  <Square className="h-4 w-4" aria-hidden="true" />
                  <span>إيقاف النفق (Disconnect)</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={status === 'connecting' || !host.trim()}
                  onClick={() => void handleConnect()}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
                >
                  {status === 'connecting' ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>جارٍ الاتصال والمصافحة...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" aria-hidden="true" />
                      <span>تشغيل النفق الآن (Connect)</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                disabled={probingAllFormats || !host.trim()}
                onClick={() => void handleProbeAllProtocols()}
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                <ShieldCheck
                  className={`h-4 w-4 ${probingAllFormats ? 'animate-pulse text-emerald-500' : ''}`}
                  aria-hidden="true"
                />
                <span>{probingAllFormats ? 'جارٍ الفحص...' : 'فحص كل البروتوكولات'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Live Tunnel Status, Telemetry & Console Log */}
          <div className="flex flex-col justify-between space-y-4 border-t border-slate-200 pt-4 lg:col-span-6 lg:border-t-0 lg:border-r lg:pt-0 lg:pr-6 dark:border-zinc-800">
            {/* Connection State & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                {status === 'connected' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />
                ) : status === 'connecting' ? (
                  <RefreshCw className="h-5 w-5 animate-spin text-sky-500" aria-hidden="true" />
                ) : status === 'failed' ? (
                  <XCircle className="h-5 w-5 text-rose-500" aria-hidden="true" />
                ) : (
                  <Wifi className="h-5 w-5 text-slate-400" aria-hidden="true" />
                )}
                <div>
                  <span
                    className={`text-sm font-bold ${
                      status === 'connected'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : status === 'connecting'
                        ? 'text-sky-600 dark:text-sky-400'
                        : status === 'failed'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-700 dark:text-zinc-200'
                    }`}
                  >
                    {status === 'connected'
                      ? 'متصل — النفق يعمل مباشرة'
                      : status === 'connecting'
                      ? 'جارٍ بناء النفق والتحقق...'
                      : status === 'failed'
                      ? 'تعذر تشغيل النفق'
                      : 'غير متصل (جاهز للتشغيل)'}
                  </span>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                    {metrics?.transportSummary || getProtocolLabelAr(protocol)}
                  </div>
                </div>
              </div>

              {status === 'connected' && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={trafficTesting}
                    onClick={() => void handleTestTraffic()}
                    className="inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    <Globe className={`h-3.5 w-3.5 ${trafficTesting ? 'animate-spin' : ''}`} aria-hidden="true" />
                    <span>{trafficTesting ? 'جارٍ الاختبار...' : 'اختبار التصفح عبر النفق'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleManualHeartbeat()}
                    title="قياس البينج اللحظي"
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>نبض</span>
                  </button>
                </div>
              )}
            </div>

            {/* Live Metrics Strip (tabular-nums) */}
            <div className="grid grid-cols-2 gap-3 border-b border-slate-200 pb-3 sm:grid-cols-4 dark:border-zinc-800">
              <div>
                <span className="block text-[11px] text-slate-500 dark:text-zinc-400">البينج الحي</span>
                <span
                  dir="ltr"
                  className="mt-0.5 block font-mono text-sm font-bold text-slate-900 tabular-nums dark:text-white"
                >
                  {liveLatencyMs !== null ? `${liveLatencyMs} ms` : '-- ms'}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-500 dark:text-zinc-400">وقت التشغيل</span>
                <span
                  dir="ltr"
                  className="mt-0.5 block font-mono text-sm font-bold text-slate-900 tabular-nums dark:text-white"
                >
                  {formatDurationClock(uptimeSec)}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-500 dark:text-zinc-400">TX / RX الفعلي</span>
                <span
                  dir="ltr"
                  className="mt-0.5 block font-mono text-xs font-bold text-emerald-700 tabular-nums dark:text-emerald-400"
                >
                  ↑{formatBytes(bytesSent)} / ↓{formatBytes(bytesReceived)}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-500 dark:text-zinc-400">IP المستجيب</span>
                <span
                  dir="ltr"
                  className="mt-0.5 block truncate font-mono text-xs font-bold text-slate-900 tabular-nums dark:text-white"
                >
                  {metrics?.resolvedIp ? `${metrics.resolvedIp}:${metrics.port}` : '--'}
                </span>
              </div>
            </div>

            {/* Unboxed Metadata Details Row */}
            {metrics && (
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-600 dark:text-zinc-400">
                {metrics.dnsMs !== null && (
                  <span className="font-mono tabular-nums">DNS: {metrics.dnsMs}ms</span>
                )}
                {metrics.tlsVersion && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{metrics.tlsVersion} ({metrics.tlsCipher})</span>
                  </>
                )}
                {metrics.sshBanner && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{metrics.sshBanner}</span>
                  </>
                )}
                {metrics.httpUpgradeStatus !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">HTTP {metrics.httpUpgradeStatus}</span>
                  </>
                )}
                {metrics.authVerified !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        metrics.authVerified
                          ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                          : 'font-semibold text-rose-600 dark:text-rose-400'
                      }
                    >
                      {metrics.authVerified ? 'المصادقة ناجحة' : 'فشل المصادقة'}
                    </span>
                  </>
                )}
              </div>
            )}

            {trafficResult && (
              <div
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                  trafficResult.ok
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
                }`}
              >
                {trafficResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span>{trafficResult.detailAr}</span>
              </div>
            )}

            {/* Real-Time Tunnel Console Log */}
            <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-950 dark:border-zinc-800">
              <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 text-[11px] text-zinc-400">
                <div className="flex items-center gap-1.5 font-semibold text-zinc-200">
                  <Terminal className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <span>سجل التشغيل المباشر (Live Tunnel Log)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleCopyLogs()}
                    disabled={logs.length === 0}
                    className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                  >
                    {copiedLog ? (
                      <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3 w-3" aria-hidden="true" />
                    )}
                    <span>{copiedLog ? 'نُسخ' : 'نسخ'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogs([])}
                    disabled={logs.length === 0}
                    className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                    <span>مسح</span>
                  </button>
                </div>
              </div>

              <div
                ref={logBoxRef}
                dir="ltr"
                className="h-64 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed"
              >
                {logs.length === 0 ? (
                  <p className="text-zinc-500">
                    Ready. Enter host, port, and protocol credentials or import a config, then press &quot;تشغيل النفق الآن&quot;.
                  </p>
                ) : (
                  logs.map((entry) => (
                    <div key={entry.id} className="mb-1 flex items-start gap-2">
                      <span className="shrink-0 text-zinc-500 tabular-nums">
                        [{new Date(entry.ts).toLocaleTimeString('en-GB')}]
                      </span>
                      <span
                        className={`shrink-0 font-bold ${
                          entry.level === 'success'
                            ? 'text-emerald-400'
                            : entry.level === 'error'
                            ? 'text-rose-400'
                            : entry.level === 'warn'
                            ? 'text-amber-400'
                            : 'text-sky-400'
                        }`}
                      >
                        [{entry.stage}]
                      </span>
                      <span
                        className={`break-words ${
                          entry.level === 'error'
                            ? 'text-rose-200'
                            : entry.level === 'success'
                            ? 'text-emerald-100'
                            : 'text-zinc-200'
                        }`}
                      >
                        {entry.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* All 9 Protocols Readiness Matrix (when tested) */}
      {allFormatChecks.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-[#09090b]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              نتائج فحص جاهزية جميع البروتوكولات التسعة على ({host})
            </h3>
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              اضغط على أي بروتوكول مستجيب لاختياره وتشغيله مباشرة
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {allFormatChecks.map((chk) => {
              const selected = protocol === chk.protocol;
              return (
                <button
                  key={chk.protocol}
                  type="button"
                  onClick={() => {
                    handleSelectProtocol(chk.protocol);
                    setPort(chk.port);
                  }}
                  className={`rounded-lg border p-3 text-right transition-colors ${
                    selected
                      ? 'border-emerald-600 bg-emerald-50/70 dark:border-emerald-500 dark:bg-emerald-950/30'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-zinc-800 dark:bg-black'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {chk.nameEn} <span className="font-mono">:{chk.port}</span>
                    </span>
                    <span
                      className={`text-[11px] font-semibold tabular-nums ${
                        chk.reachable
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {chk.reachable ? `${chk.latencyMs ?? '--'} ms` : 'غير متاح'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                    {chk.detailAr}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <AdSenseBanner key="ad-middle-tunnel" placement="middle" />
    </section>
  );
}

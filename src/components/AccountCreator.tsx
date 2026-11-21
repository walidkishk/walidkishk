import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Clock,
  ExternalLink,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Wand2,
  XCircle,
  Zap,
} from 'lucide-react';
import { useInAppBrowser } from '../context/InAppBrowserContext.tsx';
import type {
  CreateAccountPayload,
  FormatCheckResult,
  ProtocolFormatId,
  SavedVpnAccount,
  ServerDetailResponse,
  VerifyAccountPayload,
  VerifyAccountResponse,
} from '../types.ts';
import { parseAnyVpnAccountText } from '../utils/accountParser.ts';
import {
  addDaysToDatetimeLocal,
  datetimeLocalToIso,
  getExpiryCounterDetails,
  toDatetimeLocalValue,
} from '../utils/expiryUtils.ts';

interface AccountCreatorProps {
  serverData: ServerDetailResponse | null;
  selectedServerId: string;
  onSelectServer: (serverId: string) => void;
  onRefreshStrongest?: () => void;
  serverLoading?: boolean;
  sessionCookie: string;
  onSessionCookieChange: (cookie: string) => void;
  sniValue?: string;
  onSniChange?: (sni: string) => void;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  onCreateAccount: (payload: CreateAccountPayload) => Promise<SavedVpnAccount | null>;
  onVerifyAccount: (payload: VerifyAccountPayload) => Promise<VerifyAccountResponse | null>;
  creating: boolean;
}

const DURATION_OPTIONS = [
  { days: 1, label: 'يوم واحد (24 ساعة)' },
  { days: 3, label: '3 أيام (افتراضي)' },
  { days: 7, label: '7 أيام' },
  { days: 14, label: '14 يوماً' },
];

function parsePortChoices(portsText: string, defaultPort: number): number[] {
  const nums = portsText
    .split(/[^0-9]+/)
    .map((s) => Number(s))
    .filter((n) => n > 0 && n <= 65535);
  if (nums.length === 0) return [defaultPort];
  return Array.from(new Set(nums));
}

function randomToken(prefix: string, len: number): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = prefix;
  for (let i = 0; i < len; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function AccountCreator({
  serverData,
  selectedServerId,
  onSelectServer,
  onRefreshStrongest,
  serverLoading = false,
  sessionCookie,
  onSessionCookieChange,
  sniValue,
  onSniChange,
  isAuthenticated,
  onRequireAuth,
  onCreateAccount,
  onVerifyAccount,
  creating,
}: AccountCreatorProps) {
  const { openInAppUrl } = useInAppBrowser();
  const protocols = serverData?.protocols ?? [];
  const [protocolsMenuOpen, setProtocolsMenuOpen] = useState<boolean>(false);
  const [creatorMode, setCreatorMode] = useState<'verify' | 'create'>('verify');
  const [protocol, setProtocol] = useState<ProtocolFormatId>('ssh_ws');
  const [port, setPort] = useState<number>(80);
  const [customHost, setCustomHost] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [recaptchaToken, setRecaptchaToken] = useState<string>('');
  const [customUuid, setCustomUuid] = useState<string>('');
  const [wgPrivateKey, setWgPrivateKey] = useState<string>('');
  const [wgPublicKey, setWgPublicKey] = useState<string>('');
  const [rawPasteText, setRawPasteText] = useState<string>('');
  const [parseNotice, setParseNotice] = useState<string | null>(null);

  const [localSni, setLocalSni] = useState<string>('creativecommons.org');
  const sni = sniValue !== undefined ? sniValue : localSni;
  const setSni = (next: string) => {
    setLocalSni(next);
    onSniChange?.(next);
  };

  const [durationDays, setDurationDays] = useState<number>(3);
  const [manualExpiryLocal, setManualExpiryLocal] = useState<string>('');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [autoRenew, setAutoRenew] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [formatChecks, setFormatChecks] = useState<FormatCheckResult[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeProtoSpec = protocols.find((p) => p.id === protocol);
  const portChoices = activeProtoSpec
    ? parsePortChoices(activeProtoSpec.ports, activeProtoSpec.defaultPort)
    : [port];

  useEffect(() => {
    if (activeProtoSpec) {
      const choices = parsePortChoices(activeProtoSpec.ports, activeProtoSpec.defaultPort);
      if (!choices.includes(port)) {
        setPort(activeProtoSpec.defaultPort || choices[0]);
      }
    }
  }, [protocol, activeProtoSpec, port]);

  const handleSmartParse = () => {
    setErrorMsg(null);
    setParseNotice(null);
    const parsed = parseAnyVpnAccountText(rawPasteText, serverData?.allServers ?? []);
    if (!parsed) {
      setErrorMsg('لم يتم التعرف على صيغة صالحة في النص الملصق. تأكد من نسخ الرابط (vmess:// أو vless:// أو ssh://) أو ملف .conf أو بيانات الحساب.');
      return;
    }

    if (parsed.serverId && parsed.serverId !== selectedServerId) {
      onSelectServer(parsed.serverId);
    }
    if (parsed.host) {
      const matchedServer = (serverData?.allServers ?? []).find(
        (s) => s.host.toLowerCase() === parsed.host?.toLowerCase(),
      );
      setCustomHost(matchedServer ? '' : parsed.host);
    }
    if (parsed.protocol) setProtocol(parsed.protocol);
    if (parsed.port) setPort(parsed.port);
    if (parsed.username) setUsername(parsed.username);
    if (parsed.password) setPassword(parsed.password);
    if (parsed.uuid) setCustomUuid(parsed.uuid);
    if (parsed.wireguardPrivateKey) setWgPrivateKey(parsed.wireguardPrivateKey);
    if (parsed.wireguardPublicKey) setWgPublicKey(parsed.wireguardPublicKey);
    if (parsed.sni) setSni(parsed.sni);
    if (parsed.realExpiresAt) {
      setManualExpiryLocal(toDatetimeLocalValue(parsed.realExpiresAt));
    }

    setParseNotice(
      `تم استخراج البيانات تلقائياً (${parsed.detectedFormatLabelAr})${parsed.realExpiresAt ? ' · متضمناً تاريخ الانتهاء' : ''}. يمكنك تعديل تاريخ الانتهاء أدناه ثم الضغط «التحقق من الحساب بكل الصيغ وحفظه».`,
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isAuthenticated) {
      setErrorMsg('يرجى تسجيل الدخول أولاً حتى يتم حفظ حساباتك الحقيقية في السحابة وعدم حذفها.');
      onRequireAuth();
      return;
    }

    try {
      if (creatorMode === 'create') {
        if (username.trim().length < 3 || password.trim().length < 3) {
          setErrorMsg('يرجى إدخال اسم مستخدم وكلمة مرور من 3 أحرف على الأقل.');
          return;
        }
        if (!sessionCookie.trim()) {
          setErrorMsg(
            'خادم ssh-tunnel.net يتطلب كوكيز جلسة صالحة (PHPSESSID) لإنشاء حساب حقيقي مباشر — لن يتم إنشاء أي حساب وهمي. يمكنك التبديل إلى «حفظ والتحقق بكل الصيغ» لاستيراد وحفظ حسابك الحقيقي.',
          );
          return;
        }
        const created = await onCreateAccount({
          serverId: selectedServerId,
          protocol,
          port,
          username: username.trim(),
          customName: customName.trim() || undefined,
          password: password.trim(),
          sni: sni.trim() || 'creativecommons.org',
          durationDays,
          autoRenew,
          sessionCookie: sessionCookie.trim(),
          recaptchaToken: recaptchaToken.trim() || undefined,
        });
        if (created) {
          setSuccessMsg(`تم إنشاء الحساب الحقيقي (${created.customName || created.username}) عبر خادم الموقع وحفظه في السحابة بنجاح.`);
          setCustomName('');
        }
      } else {
        const manualIso = datetimeLocalToIso(manualExpiryLocal) || undefined;
        const result = await onVerifyAccount({
          serverId: selectedServerId,
          customHost: customHost.trim() || undefined,
          protocol,
          port,
          username: username.trim(),
          customName: customName.trim() || undefined,
          password: password.trim(),
          sni: sni.trim() || 'creativecommons.org',
          durationDays,
          autoRenew,
          uuid: customUuid.trim() || undefined,
          wireguardPrivateKey: wgPrivateKey.trim() || undefined,
          wireguardPublicKey: wgPublicKey.trim() || undefined,
          manualExpiresAt: manualIso,
        });
        if (result) {
          setFormatChecks(result.formatChecks);
          setSuccessMsg(`تم التحقق وحفظ الحساب (${result.account.customName || result.account.username}): ${result.upstreamMessage}`);
          setCustomName('');
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر إتمام العملية');
    }
  };

  const activePageUrl = serverData?.sourceUrl ?? 'https://www.ssh-tunnel.net/europe-africa/server-15/';
  const activeProviderName = serverData?.server.providerName ?? 'ssh-tunnel.net';
  const activeProviderObj = serverData?.providers?.find(
    (p) => p.providerId === serverData.server.providerId,
  );
  const protocolDirectUrls: Partial<Record<ProtocolFormatId, string>> =
    serverData?.server.protocolCreateUrls ?? activeProviderObj?.protocolCreateUrls ?? {};
  const isV2ray = protocol === 'v2ray_vmess' || protocol === 'v2ray_vless';
  const isWireguard = protocol === 'wireguard';

  return (
    <section id="create-account">
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#09090b]">
        {/* Dynamic Strongest Server & Site Selector (re-evaluates on every refresh/activation) */}
        {(() => {
          const strongest = serverData?.strongestServer;
          const isOnStrongest = Boolean(
            strongest &&
              (strongest.serverId === selectedServerId ||
                (strongest.host === serverData?.server.host &&
                  strongest.providerId === serverData?.server.providerId)),
          );

          return (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-zinc-800 dark:bg-black">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600/15 px-2 py-0.5 font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                      <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>أقوى موقع سيرفرات الآن</span>
                    </span>
                    {strongest ? (
                      <span className="font-bold text-slate-900 dark:text-white">
                        {strongest.providerName} · {strongest.code}
                      </span>
                    ) : (
                      <span className="font-medium text-slate-500 dark:text-zinc-400">
                        {serverLoading ? 'جارٍ قياس سرعة واستجابة جميع المواقع...' : activeProviderName}
                      </span>
                    )}
                    {strongest && !isOnStrongest && (
                      <button
                        type="button"
                        onClick={() => onSelectServer(strongest.serverId)}
                        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                      >
                        تفعيل الأقوى
                      </button>
                    )}
                  </div>

                  {strongest && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-zinc-400">
                      <span dir="ltr" className="font-mono text-slate-800 dark:text-zinc-200">
                        {strongest.host}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{strongest.countryAr}</span>
                      <span aria-hidden="true">·</span>
                      <span dir="ltr" className="font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {strongest.latencyMs > 0 ? `${strongest.latencyMs} ms` : 'Online'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{strongest.protocolsCount} صيغ</span>
                      <span aria-hidden="true">·</span>
                      <span>حمل {strongest.accountUsagePercent}%</span>
                      <span aria-hidden="true">·</span>
                      <span>فُحص {strongest.testedCandidatesCount} خادم</span>
                    </div>
                  )}
                </div>

                {onRefreshStrongest && (
                  <button
                    type="button"
                    onClick={onRefreshStrongest}
                    disabled={serverLoading}
                    className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${serverLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                    <span>{serverLoading ? 'جارٍ التنشيط...' : 'تنشيط الأقوى'}</span>
                  </button>
                )}
              </div>

              {strongest && strongest.topCandidates && strongest.topCandidates.length > 1 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-200 pt-2.5 dark:border-zinc-800">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                    أقوى المواقع بالترتيب:
                  </span>
                  {strongest.topCandidates.map((cand, idx) => {
                    const isCurrent = cand.serverId === selectedServerId || cand.host === serverData?.server.host;
                    return (
                      <button
                        key={cand.serverId}
                        type="button"
                        onClick={() => onSelectServer(cand.serverId)}
                        title={`${cand.providerName} — ${cand.host} (${cand.countryAr})`}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          isCurrent
                            ? 'border-emerald-600 bg-emerald-600/15 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-200'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-500/60 dark:border-zinc-800 dark:bg-[#09090b] dark:text-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <span className="font-mono text-[10px] text-slate-400 dark:text-zinc-500">#{idx + 1}</span>
                        <span className="font-semibold">{cand.providerName}</span>
                        <span className="text-[10px] text-slate-500 dark:text-zinc-400">({cand.code})</span>
                        <span dir="ltr" className="font-mono text-[10px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {cand.latencyMs > 0 ? `${cand.latencyMs}ms` : 'UP'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-zinc-800">
          <div>
            <h1 className="text-balance text-xl font-bold text-slate-950 dark:text-white">
              حفظ والتحقق من الحساب الحقيقي بكل الصيغ — {serverData?.server.code ?? 'DE 2'}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
              <span>
                الموقع: <strong className="text-slate-700 dark:text-zinc-200">{serverData?.server.providerName ?? 'ssh-tunnel.net'}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => openInAppUrl(activePageUrl, { title: activeProviderName })}
                className="inline-flex items-center gap-1 font-mono text-emerald-600 hover:underline dark:text-emerald-400"
                dir="ltr"
              >
                <span>{activePageUrl}</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </button>
            </p>
          </div>
          <div className="w-full sm:w-auto">
            <label htmlFor="server-select" className="sr-only">
              اختر الموقع والسيرفر
            </label>
            <select
              id="server-select"
              value={selectedServerId}
              onChange={(e) => onSelectServer(e.target.value)}
              className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100 sm:w-64"
            >
              {(serverData?.providers && serverData.providers.length > 0) ? (
                serverData.providers.map((provider) => (
                  <optgroup
                    key={provider.providerId}
                    label={`${provider.name} (${provider.servers.length} سيرفر · ${provider.validityDaysLabelAr})`}
                  >
                    {provider.servers.map((srv) => (
                      <option key={srv.serverId} value={srv.serverId}>
                        {srv.code} — {srv.countryAr} ({srv.host})
                      </option>
                    ))}
                  </optgroup>
                ))
              ) : (
                <>
                  {(serverData?.allServers ?? []).map((srv) => (
                    <option key={srv.serverId} value={srv.serverId}>
                      {srv.code} — {srv.location} ({srv.host})
                    </option>
                  ))}
                  {(!serverData || serverData.allServers.length === 0) && (
                    <option value="15">DE 2 — Frankfurt (de-2.stunnel.cc)</option>
                  )}
                </>
              )}
            </select>
          </div>
        </div>

        {/* Step 1: Collapsible 9-protocol selector & direct site launcher */}
        <div className="mt-4 rounded-xl border border-emerald-500/35 bg-emerald-500/[0.04] dark:border-emerald-500/30 dark:bg-emerald-950/20">
          <button
            type="button"
            onClick={() => setProtocolsMenuOpen((prev) => !prev)}
            aria-expanded={protocolsMenuOpen}
            className="flex w-full items-center justify-between gap-3 p-4 text-right transition-colors hover:bg-emerald-500/[0.05]"
          >
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-bold text-slate-900 dark:text-white">
                1. اختر الصيغة المطلوبة للتحويل المباشر داخل موقع {activeProviderName}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                الصيغة المحددة حالياً:{' '}
                <strong className="text-emerald-700 dark:text-emerald-300">
                  {activeProtoSpec?.nameEn ?? protocol}
                </strong>{' '}
                ·{' '}
                <span dir="ltr" className="font-mono">
                  {serverData?.server.code ?? 'DE 2'} · {serverData?.server.host ?? 'de-2.stunnel.cc'}
                </span>
              </p>
            </div>

            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-500/40 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 dark:bg-black dark:text-emerald-300">
              <span>{protocolsMenuOpen ? 'إخفاء الصيغ' : 'عرض الصيغ (9)'}</span>
              {protocolsMenuOpen ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </span>
          </button>

          {protocolsMenuOpen && (
            <div className="border-t border-emerald-500/25 px-4 pb-4 pt-3">
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                اختر أي صيغة من الصيغ التسعة قبل دخولك للموقع لتتحول فوراً إلى رابط إنشاء الحساب الخاص بتلك الصيغة.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {protocols.map((item) => {
                  const selected = protocol === item.id;
                  const protoUrl = protocolDirectUrls[item.id] || activePageUrl;
                  return (
                    <div
                      key={item.id}
                      className={`flex min-h-[44px] items-center justify-between gap-1 rounded-lg border px-2.5 py-1.5 transition-colors ${
                        selected
                          ? 'border-emerald-600 bg-emerald-600/15 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-200'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setProtocol(item.id)}
                        className="flex min-w-0 flex-1 flex-col items-start text-right"
                      >
                        <span className="w-full truncate text-xs font-semibold">{item.nameEn}</span>
                        <span
                          className={`text-[10px] font-semibold ${
                            item.status === 'DOWN'
                              ? 'text-rose-500'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {item.status === 'DOWN' ? 'متوقف' : 'متاح'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProtocol(item.id);
                          openInAppUrl(protoUrl, { title: `${item.nameEn} · ${activeProviderName}` });
                        }}
                        title={`الدخول المباشر لإنشاء حساب ${item.nameEn} في ${activeProviderName} داخل التطبيق`}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:border-emerald-500 hover:text-emerald-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-emerald-400 dark:hover:text-emerald-300"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {activeProtoSpec && (
                <p className="mt-2.5 text-[11px] text-slate-600 dark:text-zinc-400">
                  <strong className="text-slate-800 dark:text-zinc-200">{activeProtoSpec.nameAr}:</strong>{' '}
                  {activeProtoSpec.notesAr}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-slate-100 p-1 dark:border dark:border-zinc-800 dark:bg-black">
          <button
            type="button"
            onClick={() => {
              setCreatorMode('verify');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
              creatorMode === 'verify'
                ? 'bg-white text-slate-950 shadow-sm dark:bg-zinc-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>حفظ والتحقق من حساب حقيقي بكل الصيغ</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCreatorMode('create');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
              creatorMode === 'create'
                ? 'bg-white text-slate-950 shadow-sm dark:bg-zinc-900 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            <span>إنشاء مباشر عبر الموقع (Cookie + reCAPTCHA)</span>
          </button>
        </div>

        {creatorMode === 'verify' && (
          <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-zinc-800 dark:bg-black">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="smart-paste-box"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                <ClipboardPaste className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                <span>لصق تلقائي بأي صيغة (vmess://، vless://، ssh://، WireGuard .conf، أو نص الموقع)</span>
              </label>
              <button
                type="button"
                onClick={handleSmartParse}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>استخراج البيانات تلقائياً</span>
              </button>
            </div>
            <textarea
              id="smart-paste-box"
              rows={2}
              dir="ltr"
              value={rawPasteText}
              onChange={(e) => setRawPasteText(e.target.value)}
              placeholder="vmess://... أو vless://... أو ssh://user:pass@de-2.stunnel.cc:80 أو نص الحساب المنسوخ..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-[#09090b] dark:text-zinc-100"
            />
            {parseNotice && (
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {parseNotice}
              </p>
            )}
          </div>
        )}

        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50/70 p-3 text-xs text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          <p className="leading-relaxed">
            {creatorMode === 'verify'
              ? 'بعد إنشاء حسابك من الرابط المباشر أعلاه، الصق بياناته أو أدخلها هنا ليتم فحصها عبر الخادم وحفظها في Firebase بكل الصيغ التسعة.'
              : 'يتصل مباشرة بخادم ssh-tunnel.net/core.json باستخدام كوكيز جلستك ورمز reCAPTCHA — إذا رفض الموقع الطلب فلن يتم إنشاء أي حساب وهمي.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div>
            <label htmlFor="vpn-custom-name" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
              تخصيص اسم للحساب (اختياري لتمييزه بسهولة في قائمة حساباتك)
            </label>
            <input
              id="vpn-custom-name"
              type="text"
              maxLength={80}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
              placeholder="مثال: حساب هاتفي الأساسي · نت سريع الإمارات · ألعاب"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="vpn-username" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                اسم المستخدم الحقيقي {isV2ray || isWireguard ? '(اختياري لهذه الصيغة)' : '(Username)'}
              </label>
              <div className="flex gap-2">
                <input
                  id="vpn-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  dir="ltr"
                  required={!isV2ray && !isWireguard}
                  className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                  placeholder={creatorMode === 'verify' ? 'username الحقيقي' : 'de2_user'}
                />
                {creatorMode === 'create' && (
                  <button
                    type="button"
                    onClick={() => setUsername(randomToken('de2_', 5))}
                    title="اقتراح اسم مستخدم"
                    className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-lg border border-slate-300 px-3 text-slate-600 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    <Wand2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="vpn-password" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                كلمة المرور الحقيقية {isV2ray || isWireguard ? '(اختياري لهذه الصيغة)' : '(Password)'}
              </label>
              <div className="flex gap-2">
                <input
                  id="vpn-password"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  required={!isV2ray && !isWireguard}
                  className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                  placeholder="password"
                />
                {creatorMode === 'create' && (
                  <button
                    type="button"
                    onClick={() => setPassword(randomToken('vpn', 7))}
                    title="اقتراح كلمة مرور"
                    className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-lg border border-slate-300 px-3 text-slate-600 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {creatorMode === 'verify' && (isV2ray || customUuid) && (
            <div>
              <label htmlFor="custom-uuid" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                معرف V2Ray UUID (مطلوب للتحقق من VMess / VLESS)
              </label>
              <input
                id="custom-uuid"
                type="text"
                value={customUuid}
                onChange={(e) => setCustomUuid(e.target.value)}
                dir="ltr"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
              />
            </div>
          )}

          {creatorMode === 'verify' && (isWireguard || wgPrivateKey) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="wg-priv" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  WireGuard PrivateKey
                </label>
                <input
                  id="wg-priv"
                  type="text"
                  value={wgPrivateKey}
                  onChange={(e) => setWgPrivateKey(e.target.value)}
                  dir="ltr"
                  placeholder="Base64 32-byte PrivateKey"
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                />
              </div>
              <div>
                <label htmlFor="wg-pub" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  WireGuard Peer PublicKey
                </label>
                <input
                  id="wg-pub"
                  type="text"
                  value={wgPublicKey}
                  onChange={(e) => setWgPublicKey(e.target.value)}
                  dir="ltr"
                  placeholder="Base64 32-byte PublicKey"
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                />
              </div>
            </div>
          )}

          <div className={`grid grid-cols-1 gap-4 ${creatorMode === 'verify' ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
            {creatorMode === 'verify' && (
              <div>
                <label htmlFor="custom-host" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  مضيف مخصص (اختياري)
                </label>
                <input
                  id="custom-host"
                  type="text"
                  value={customHost}
                  onChange={(e) => setCustomHost(e.target.value)}
                  dir="ltr"
                  placeholder={serverData?.server.host ?? 'de-2.stunnel.cc'}
                  className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                />
              </div>
            )}

            <div className={creatorMode === 'verify' ? '' : 'sm:col-span-2'}>
              <label htmlFor="vpn-sni" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                SNI / Bug Host
              </label>
              <input
                id="vpn-sni"
                type="text"
                value={sni}
                onChange={(e) => setSni(e.target.value)}
                dir="ltr"
                className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                placeholder="creativecommons.org"
              />
            </div>

            <div>
              <label htmlFor="vpn-port" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                المنفذ (Port)
              </label>
              <select
                id="vpn-port"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                dir="ltr"
                className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
              >
                {portChoices.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {creatorMode === 'create' && (
              <div>
                <label htmlFor="vpn-duration" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  مدة الصلاحية (حسب الخادم)
                </label>
                <select
                  id="vpn-duration"
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt.days} value={opt.days}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {creatorMode === 'verify' ? (() => {
            const expiryPreview = getExpiryCounterDetails(manualExpiryLocal, nowMs);
            return (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-black">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="manual-expiry-input"
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <span>تاريخ انتهاء الحساب (تحديد وتعديل يدوي)</span>
                  </label>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {[1, 3, 7, 14, 30].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setManualExpiryLocal(addDaysToDatetimeLocal(d))}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-emerald-500 hover:text-emerald-700 dark:border-zinc-700 dark:bg-[#09090b] dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
                      >
                        +{d === 1 ? 'يوم' : d === 3 ? '3 أيام' : `${d} يوم`}
                      </button>
                    ))}
                    {manualExpiryLocal && (
                      <button
                        type="button"
                        onClick={() => setManualExpiryLocal('')}
                        className="rounded-md border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-[#09090b] dark:text-rose-300 dark:hover:bg-rose-950/40"
                      >
                        مسح
                      </button>
                    )}
                  </div>
                </div>

                <input
                  id="manual-expiry-input"
                  type="datetime-local"
                  dir="ltr"
                  value={manualExpiryLocal}
                  onChange={(e) => setManualExpiryLocal(e.target.value)}
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                />

                {/* Remaining days counter underneath expiration date */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-[#09090b]">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Clock
                      className={`h-3.5 w-3.5 shrink-0 ${
                        !expiryPreview.hasDate
                          ? 'text-slate-400'
                          : expiryPreview.isUrgent
                          ? 'text-amber-500'
                          : 'text-emerald-500'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      عداد الأيام المتبقية:
                    </span>
                    <span
                      className={`font-bold ${
                        !expiryPreview.hasDate
                          ? 'text-slate-500 dark:text-slate-400'
                          : expiryPreview.isExpired
                          ? 'text-rose-600 dark:text-rose-400'
                          : expiryPreview.isUrgent
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {expiryPreview.hasDate
                        ? expiryPreview.daysRemainingText
                        : 'غير محدد (يمكنك اختيار الأيام أو التعديل الآن أو بعد الحفظ)'}
                    </span>
                  </div>
                  {expiryPreview.hasDate && (
                    <span
                      dir="ltr"
                      className="font-mono text-xs font-semibold text-slate-600 tabular-nums dark:text-slate-300"
                    >
                      {expiryPreview.countdownLabel}
                    </span>
                  )}
                </div>
              </div>
            );
          })() : (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-black">
              <div>
                <label htmlFor="session-cookie" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  كوكيز جلسة ssh-tunnel.net (مطلوب للإنشاء الحقيقي المباشر عبر /core.json)
                </label>
                <input
                  id="session-cookie"
                  type="text"
                  value={sessionCookie}
                  onChange={(e) => onSessionCookieChange(e.target.value)}
                  dir="ltr"
                  placeholder="PHPSESSID=..."
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                />
              </div>

              <div>
                <label htmlFor="recaptcha-token" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  رمز g-recaptcha-response (إذا طلبه الخادم)
                </label>
                <input
                  id="recaptcha-token"
                  type="text"
                  value={recaptchaToken}
                  onChange={(e) => setRecaptchaToken(e.target.value)}
                  dir="ltr"
                  placeholder="03AFcWeA..."
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4 dark:border-zinc-800">
            <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-800 dark:text-zinc-200">
              <input
                type="checkbox"
                checked={autoRenew}
                onChange={(e) => setAutoRenew(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>تفعيل التجديد التلقائي عند توفر جلسة الموقع</span>
            </label>
          </div>

          {errorMsg && (
            <p role="alert" className="text-xs leading-relaxed font-semibold text-rose-600 dark:text-rose-400">
              {errorMsg}
            </p>
          )}
          {successMsg && (
            <p role="status" className="text-xs leading-relaxed font-semibold text-emerald-600 dark:text-emerald-400">
              {successMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={creating}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>
              {creating
                ? 'جارٍ الفحص عبر الخادم والمنافذ التسعة...'
                : creatorMode === 'create'
                ? 'إنشاء حساب حقيقي عبر الموقع وحفظه'
                : 'التحقق من الحساب بكل الصيغ وحفظه'}
            </span>
          </button>
        </form>

        {formatChecks.length > 0 && (
          <div className="mt-6 border-t border-slate-200 pt-5 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              نتيجة الفحص الفوري للحساب عبر جميع الصيغ (9 بروتوكولات)
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {formatChecks.map((chk) => (
                <div
                  key={chk.protocol}
                  className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 text-right dark:border-zinc-800 dark:bg-black"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      {chk.nameEn}
                    </span>
                    {chk.status === 'verified' ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                    ) : chk.reachable ? (
                      <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
                    {chk.detailAr}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

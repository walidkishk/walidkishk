import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Filter,
  Globe,
  Layers,
  MapPin,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  X,
} from 'lucide-react';
import { useInAppBrowser } from '../context/InAppBrowserContext.tsx';
import type {
  DiscoverProvidersResponse,
  ProtocolFormatId,
  ServerDetailResponse,
  ServerSummary,
  VpnProviderSummary,
} from '../types.ts';
import { getProtocolLabelAr } from '../utils/configGenerators.ts';
import { AdSenseBanner } from './AdSenseBanner.tsx';

interface TrafficAndPortsPanelProps {
  serverData: ServerDetailResponse | null;
  selectedServerId: string;
  onSelectServer: (serverId: string) => void;
  mode?: 'servers' | 'autorenew';
  onDiscoverProviders?: (mode: 'servers' | 'autorenew') => Promise<void>;
  discoveringProviders?: boolean;
  discoveryResult?: DiscoverProvidersResponse | null;
  onDismissDiscoveryResult?: () => void;
}

function isAutoRenewProvider(p: VpnProviderSummary): boolean {
  return Boolean(p.supportsAutoRenew || p.providerId === 'sshtunnel');
}

type RegionFilter = 'all' | 'arab' | 'europe' | 'asia' | 'america';

const ALL_PROTOCOL_OPTIONS: Array<{ id: ProtocolFormatId; shortLabel: string }> = [
  { id: 'ssh_ws', shortLabel: 'SSH WS' },
  { id: 'ssh_ssl', shortLabel: 'Stunnel SSL' },
  { id: 'ssh_dropbear', shortLabel: 'Dropbear' },
  { id: 'slowdns', shortLabel: 'SlowDNS' },
  { id: 'v2ray_vmess', shortLabel: 'VMess' },
  { id: 'v2ray_vless', shortLabel: 'VLESS' },
  { id: 'wireguard', shortLabel: 'WireGuard' },
  { id: 'noobzvpn', shortLabel: 'NoobzVpn' },
  { id: 'squid', shortLabel: 'Squid' },
];

function isArabOrMiddleEastServer(srv: ServerSummary): boolean {
  const haystack = `${srv.regionLabelAr} ${srv.country} ${srv.countryAr} ${srv.location} ${srv.host}`.toLowerCase();
  return (
    haystack.includes('عربي') ||
    haystack.includes('الشرق الأوسط') ||
    haystack.includes('السعودية') ||
    haystack.includes('saudi') ||
    haystack.includes('الإمارات') ||
    haystack.includes('uae') ||
    haystack.includes('dubai') ||
    haystack.includes('البحرين') ||
    haystack.includes('bahrain') ||
    haystack.includes('مصر') ||
    haystack.includes('egypt') ||
    haystack.includes('عُمان') ||
    haystack.includes('oman') ||
    haystack.includes('قطر') ||
    haystack.includes('qatar') ||
    haystack.includes('الكويت') ||
    haystack.includes('kuwait') ||
    haystack.includes('الأردن') ||
    haystack.includes('jordan') ||
    haystack.includes('المغرب') ||
    haystack.includes('morocco') ||
    haystack.includes('تركيا') ||
    haystack.includes('turkey')
  );
}

function matchesRegionFilter(srv: ServerSummary, region: RegionFilter): boolean {
  if (region === 'all') return true;
  if (region === 'arab') return isArabOrMiddleEastServer(srv);
  const reg = `${srv.regionLabelAr} ${srv.country}`.toLowerCase();
  if (region === 'europe') return reg.includes('أوروبا') || reg.includes('germany') || reg.includes('france') || reg.includes('netherlands') || reg.includes('kingdom');
  if (region === 'asia') return reg.includes('آسيا') || reg.includes('singapore') || reg.includes('indonesia') || reg.includes('japan') || reg.includes('india');
  if (region === 'america') return reg.includes('أمريكا') || reg.includes('united states') || reg.includes('canada') || reg.includes('brazil');
  return true;
}

export function TrafficAndPortsPanel({
  serverData,
  selectedServerId,
  onSelectServer,
  mode = 'servers',
  onDiscoverProviders,
  discoveringProviders = false,
  discoveryResult = null,
  onDismissDiscoveryResult,
}: TrafficAndPortsPanelProps) {
  const { openInAppUrl } = useInAppBrowser();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [protocolFilter, setProtocolFilter] = useState<'all' | ProtocolFormatId>('all');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all');
  // Collapsed by default so the Providers directory stays clean and scannable
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

  const providers: VpnProviderSummary[] = useMemo(() => {
    if (!serverData) return [];
    const baseProviders: VpnProviderSummary[] =
      serverData.providers && serverData.providers.length > 0
        ? serverData.providers
        : [
            {
              providerId: 'sshtunnel',
              name: 'ssh-tunnel.net',
              nameAr: 'موقع SSH Tunnel Net',
              domain: 'ssh-tunnel.net',
              baseUrl: 'https://www.ssh-tunnel.net',
              resetScheduleAr: serverData.resetClock,
              validityDaysLabelAr: '3 أيام',
              supportedProtocols: serverData.protocols.map((p) => p.id),
              descriptionAr: 'المزود الرئيسي للسيرفر المحدد',
              liveStatus: 'Online',
              supportsAutoRenew: true,
              servers: serverData.allServers,
            },
          ];

    return baseProviders.filter((p) =>
      mode === 'autorenew' ? isAutoRenewProvider(p) : !isAutoRenewProvider(p),
    );
  }, [serverData, mode]);

  const arabServersCount = useMemo(
    () =>
      providers.reduce(
        (sum, p) => sum + p.servers.filter((srv) => isArabOrMiddleEastServer(srv)).length,
        0,
      ),
    [providers],
  );

  const filteredProviders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return providers
      .filter((p) => providerFilter === 'all' || p.providerId === providerFilter)
      .filter((p) => protocolFilter === 'all' || p.supportedProtocols.includes(protocolFilter))
      .map((p) => {
        const matchedServers = p.servers.filter((srv) => {
          const protoMatch =
            protocolFilter === 'all' ||
            (srv.supportedProtocols
              ? srv.supportedProtocols.includes(protocolFilter)
              : p.supportedProtocols.includes(protocolFilter));
          if (!protoMatch) return false;
          if (!matchesRegionFilter(srv, regionFilter)) return false;
          if (!q) return true;
          return (
            p.name.toLowerCase().includes(q) ||
            p.nameAr.toLowerCase().includes(q) ||
            srv.code.toLowerCase().includes(q) ||
            srv.host.toLowerCase().includes(q) ||
            srv.slowDnsHost.toLowerCase().includes(q) ||
            srv.country.toLowerCase().includes(q) ||
            srv.countryAr.toLowerCase().includes(q) ||
            srv.location.toLowerCase().includes(q) ||
            srv.regionLabelAr.toLowerCase().includes(q)
          );
        });
        return {
          ...p,
          matchedServers,
        };
      })
      .filter((p) => p.matchedServers.length > 0 || (!q && regionFilter === 'all'));
  }, [providers, providerFilter, protocolFilter, regionFilter, searchQuery]);

  if (!serverData) return null;

  const totalServersCount = providers.reduce((sum, p) => sum + p.servers.length, 0);
  const onlineProvidersCount = providers.filter((p) => p.liveStatus === 'Online').length;

  const toggleProviderExpand = (providerId: string) => {
    setExpandedProviders((prev) => ({
      ...prev,
      [providerId]: !prev[providerId],
    }));
  };

  const anyExpanded = filteredProviders.some((p) => Boolean(expandedProviders[p.providerId]));

  const handleToggleAllProviders = () => {
    if (anyExpanded) {
      setExpandedProviders({});
    } else {
      const next: Record<string, boolean> = {};
      for (const p of filteredProviders) {
        next[p.providerId] = true;
      }
      setExpandedProviders(next);
    }
  };

  const regionTabs: Array<{ id: RegionFilter; label: string }> = [
    { id: 'all', label: `الكل (${totalServersCount})` },
    { id: 'arab', label: `الدول العربية والشرق الأوسط (${arabServersCount})` },
    { id: 'europe', label: 'أوروبا' },
    { id: 'asia', label: 'آسيا' },
    { id: 'america', label: 'أمريكا' },
  ];

  const isAutoRenewMode = mode === 'autorenew';

  const directorySection = (
    <section id="all-servers" className="space-y-5">
      {/* Directory Header + Summary Cards */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#09090b]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              {isAutoRenewMode
                ? `مواقع التجديد التلقائي عبر التطبيق (${providers.length} موقع · ${totalServersCount} سيرفر)`
                : `دليل مواقع VPN المجانية وسيرفراتها (${providers.length} مواقع · ${totalServersCount} سيرفر)`}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              {isAutoRenewMode
                ? 'تم نقل المواقع التي تدعم الإنشاء والتجديد التلقائي مباشرة من خلال التطبيق إلى هذه الخانة (مع حذفها من خانة السيرفرات). افتح الموقع لعرض جميع سيرفراته وصيغها المباشرة.'
                : 'جميع المواقع مطوية افتراضياً لسهولة التنظيم والتصفح. افتح أي موقع أو صفِّ حسب «الدول العربية والشرق الأوسط» للوصول المباشر للسيرفرات. (المواقع المدعومة بالتجديد التلقائي موجودة في خانة التجديد التلقائي).'}
            </p>
          </div>
            <div className="flex flex-wrap items-center gap-2">
              {onDiscoverProviders && (
                <button
                  type="button"
                  onClick={() => void onDiscoverProviders(isAutoRenewMode ? 'autorenew' : 'servers')}
                  disabled={discoveringProviders}
                  className="inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
                >
                  {discoveringProviders ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      <span>
                        {isAutoRenewMode
                          ? 'جارٍ جلب مواقع التجديد التلقائي...'
                          : 'جارٍ جلب مواقع سيرفرات جديدة...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {isAutoRenewMode
                          ? 'جلب مواقع تجديد تلقائي جديدة'
                          : 'جلب مواقع سيرفرات جديدة'}
                      </span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleAllProviders}
                className="inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                {anyExpanded ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>طي جميع المواقع</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>فتح جميع المواقع</span>
                  </>
                )}
              </button>
              <Globe className="h-5 w-5 text-slate-400 dark:text-zinc-500" aria-hidden="true" />
            </div>
          </div>

          {discoveryResult && (
            <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-emerald-800 dark:text-emerald-300">
                    {discoveryResult.messageAr}
                  </p>
                  <span className="rounded bg-emerald-600/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-800 dark:text-emerald-200">
                    عدد المواقع المجلوبة: {discoveryResult.newlyAddedCount} · تختفي تلقائياً خلال 10 ثوانٍ
                  </span>
                </div>
                {onDismissDiscoveryResult && (
                  <button
                    type="button"
                    onClick={onDismissDiscoveryResult}
                    aria-label="إغلاق القائمة"
                    className="inline-flex h-6 w-6 items-center justify-center rounded border border-emerald-500/40 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-200"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              {discoveryResult.addedProviders.length > 0 && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {discoveryResult.addedProviders.map((item) => (
                    <div
                      key={item.providerId}
                      className="flex flex-col justify-between gap-1 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-black"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {item.nameAr}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                            item.supportsAutoRenew
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                          }`}
                        >
                          {item.supportsAutoRenew ? 'التجديد التلقائي' : 'خانة السيرفرات'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-zinc-400">
                        {item.reasonAr} · {item.serversCount} سيرفر · {item.protocolsCount} صيغة
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-2 text-[11px] text-slate-600 dark:text-zinc-400">
                {isAutoRenewMode
                  ? 'مواقع التجديد التلقائي المتبقية في دليل الاكتشاف:'
                  : 'مواقع السيرفرات المتبقية في دليل الاكتشاف:'}{' '}
                <strong>{discoveryResult.remainingPoolCount}</strong>
              </p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-black">
              <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                {isAutoRenewMode ? 'مواقع التجديد التلقائي' : 'مواقع VPN المربوطة'}
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-slate-950 tabular-nums dark:text-white">
                {providers.length} {providers.length === 1 ? 'موقع' : 'مواقع'}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-black">
              <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">المواقع المتصلة حالياً</div>
              <div className="mt-1 font-mono text-lg font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                {onlineProvidersCount} / {providers.length}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-black">
              <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">سيرفرات عربية / شرق أوسط</div>
              <div className="mt-1 font-mono text-lg font-bold text-sky-600 tabular-nums dark:text-sky-400">
                {arabServersCount} سيرفر
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-black">
              <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">السيرفر المحدد حالياً</div>
              <div className="mt-1 truncate font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {serverData.server.code} ({serverData.server.providerName ?? 'ssh-tunnel.net'})
              </div>
            </div>
          </div>

          {/* Region Quick Filter */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-zinc-400">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              <span>تصفية المنطقة:</span>
            </span>
            {regionTabs.map((tab) => {
              const active = regionFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRegionFilter(tab.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search & Dropdown Filters */}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="relative md:col-span-5">
              <Search
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الموقع أو الدولة (السعودية، الإمارات، البحرين، ألمانيا...) أو Host"
                className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white pr-9 pl-3 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
              />
            </div>

            <div className="md:col-span-4">
              <label htmlFor="provider-filter-select" className="sr-only">
                تصفية حسب الموقع
              </label>
              <div className="relative flex items-center">
                <Server
                  className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500"
                  aria-hidden="true"
                />
                <select
                  id="provider-filter-select"
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white pr-9 pl-3 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                >
                  <option value="all">جميع المواقع المزودة ({providers.length})</option>
                  {providers.map((p) => (
                    <option key={p.providerId} value={p.providerId}>
                      {p.name} — {p.servers.length} سيرفر ({p.validityDaysLabelAr})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="md:col-span-3">
              <label htmlFor="protocol-filter-select" className="sr-only">
                تصفية حسب البروتوكول
              </label>
              <div className="relative flex items-center">
                <Filter
                  className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500"
                  aria-hidden="true"
                />
                <select
                  id="protocol-filter-select"
                  value={protocolFilter}
                  onChange={(e) => setProtocolFilter(e.target.value as 'all' | ProtocolFormatId)}
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white pr-9 pl-3 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                >
                  <option value="all">جميع البروتوكولات والصيغ (9)</option>
                  {ALL_PROTOCOL_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {getProtocolLabelAr(opt.id)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Provider Cards & Available Servers Tables (Collapsed by default) */}
        {filteredProviders.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-zinc-800 dark:bg-[#09090b] dark:text-zinc-400">
            لا توجد مواقع أو سيرفرات مطابقة لبحثك. جرّب مسح نص البحث أو اختيار «الكل».
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProviders.map((provider, index) => {
              const isExpanded = Boolean(expandedProviders[provider.providerId]);
              const hasActiveServer = provider.matchedServers.some((s) => s.serverId === selectedServerId);
              const hasArabServers = provider.matchedServers.some((s) => isArabOrMiddleEastServer(s));
              const midpointIndex = Math.max(0, Math.ceil(filteredProviders.length / 2) - 1);
              const showMidAdHere = index === midpointIndex;

              return (
                <div key={provider.providerId} className="space-y-3">
                  <article
                    className={`overflow-hidden rounded-xl border bg-white transition-colors dark:bg-[#09090b] ${
                    hasActiveServer
                      ? 'border-emerald-500/70 dark:border-emerald-500/60'
                      : 'border-slate-200 dark:border-zinc-800'
                  }`}
                >
                  {/* Provider Site Information Header */}
                  <div className={`bg-slate-50/70 p-4 sm:p-5 dark:bg-black ${isExpanded ? 'border-b border-slate-200 dark:border-zinc-800' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="text-base font-bold text-slate-950 dark:text-white">
                            {provider.nameAr}
                          </h3>
                          <span
                            dir="ltr"
                            className="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-xs font-semibold text-slate-700 dark:border-zinc-700 dark:bg-[#09090b] dark:text-zinc-200"
                          >
                            {provider.domain}
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              provider.liveStatus === 'Online'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {provider.liveStatus === 'Online' ? '● متصل' : '● وضع احتياطي'}
                          </span>
                          {isAutoRenewProvider(provider) && (
                            <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                              يدعم التجديد التلقائي
                            </span>
                          )}
                          {hasArabServers && (
                            <span className="rounded border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                              يضم سيرفرات عربية
                            </span>
                          )}
                          {hasActiveServer && (
                            <span className="rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                              يحتوي السيرفر المحدد
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 dark:text-zinc-400">
                          {provider.descriptionAr}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-600 dark:text-zinc-300">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" aria-hidden="true" />
                            <span>المدة: <strong>{provider.validityDaysLabelAr}</strong></span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Layers className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" aria-hidden="true" />
                            <span>التصفير: <strong>{provider.resetScheduleAr}</strong></span>
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                            <Server className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" aria-hidden="true" />
                            <span>السيرفرات: <strong>{provider.matchedServers.length}</strong></span>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openInAppUrl(provider.baseUrl, { title: provider.nameAr })}
                          className="inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-[#09090b] dark:text-zinc-200 dark:hover:bg-zinc-900"
                        >
                          <span>فتح الموقع داخل التطبيق</span>
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleProviderExpand(provider.providerId)}
                          className={`inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            isExpanded
                              ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-[#09090b] dark:text-zinc-200 dark:hover:bg-zinc-900'
                          }`}
                        >
                          {isExpanded ? (
                            <>
                              <span>طي السيرفرات</span>
                              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                            </>
                          ) : (
                            <>
                              <span>عرض السيرفرات ({provider.matchedServers.length})</span>
                              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Responsive Server Cards Grid (Fits any screen width with zero horizontal overflow) */}
                  {isExpanded && (
                    <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-2">
                      {provider.matchedServers.map((srv) => {
                        const isSelected = srv.serverId === selectedServerId;
                        const isArab = isArabOrMiddleEastServer(srv);
                        const serverProtoIds = srv.supportedProtocols ?? provider.supportedProtocols;
                        const serverProtocolOptions = ALL_PROTOCOL_OPTIONS.filter((opt) =>
                          serverProtoIds.includes(opt.id),
                        );

                        return (
                          <div
                            key={srv.serverId}
                            className={`flex flex-col justify-between gap-3 rounded-xl border p-4 transition-colors ${
                              isSelected
                                ? 'border-emerald-500/80 bg-emerald-50/50 dark:border-emerald-500/70 dark:bg-emerald-950/20'
                                : 'border-slate-200 bg-slate-50/60 dark:border-zinc-800 dark:bg-black'
                            }`}
                          >
                            {/* Top Row: Server Code + Status + Country */}
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-bold text-slate-950 dark:text-white">
                                    {srv.code}
                                  </span>
                                  {srv.serverId === '15' && (
                                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                                      الأساسي
                                    </span>
                                  )}
                                  {isArab && (
                                    <span className="rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                                      عربي / شرق أوسط
                                    </span>
                                  )}
                                </div>

                                <span
                                  className={`text-xs font-semibold ${
                                    srv.status === 'Online'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {srv.status === 'Online' ? '● متصل' : '● متوقف'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-zinc-300">
                                <span className="font-semibold">{srv.countryAr}</span>
                                <span className="text-slate-400 dark:text-zinc-600" aria-hidden="true">·</span>
                                <span className="text-slate-500 dark:text-zinc-400">{srv.location}</span>
                                <span className="text-slate-400 dark:text-zinc-600" aria-hidden="true">·</span>
                                <span className="text-slate-500 dark:text-zinc-400">{srv.regionLabelAr}</span>
                              </div>

                              {/* Host & SlowDNS */}
                              <div className="grid grid-cols-1 gap-1.5 rounded-lg border border-slate-200 bg-white p-2.5 text-xs dark:border-zinc-800 dark:bg-[#09090b] sm:grid-cols-2">
                                <div className="min-w-0">
                                  <span className="block text-[10px] font-medium text-slate-400 dark:text-zinc-500">
                                    المضيف (Host)
                                  </span>
                                  <span
                                    dir="ltr"
                                    className="block break-all font-mono text-xs font-semibold text-slate-900 dark:text-zinc-100"
                                  >
                                    {srv.host}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <span className="block text-[10px] font-medium text-slate-400 dark:text-zinc-500">
                                    مضيف SlowDNS
                                  </span>
                                  <span
                                    dir="ltr"
                                    className="block break-all font-mono text-[11px] text-slate-600 dark:text-zinc-400"
                                  >
                                    {srv.slowDnsHost}
                                  </span>
                                </div>
                              </div>

                              {/* Available Protocols Directly on This Server */}
                              <div className="space-y-1.5 pt-1">
                                <span className="block text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                                  الصيغ المتاحة في هذا السيرفر (تفتح مباشرة في الموقع):
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {serverProtocolOptions.map((opt) => {
                                    const directUrl =
                                      srv.protocolCreateUrls?.[opt.id] ||
                                      provider.protocolCreateUrls?.[opt.id] ||
                                      srv.pageUrl ||
                                      provider.baseUrl;
                                      return (
                                        <button
                                          key={opt.id}
                                          type="button"
                                          onClick={() =>
                                            openInAppUrl(directUrl, {
                                              title: `${opt.shortLabel} · ${srv.code}`,
                                            })
                                          }
                                          title={`فتح ${opt.shortLabel} لسيرفر ${srv.code} داخل التطبيق`}
                                          className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-700 transition-colors hover:border-emerald-500 hover:bg-emerald-500/20 dark:border-emerald-500/35 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
                                        >
                                          <span>{opt.shortLabel}</span>
                                          <ExternalLink className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                                        </button>
                                      );
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Bottom Actions */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-3 dark:border-zinc-800">
                              <button
                                type="button"
                                onClick={() => onSelectServer(srv.serverId)}
                                className={`inline-flex min-h-[36px] flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white'
                                    : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-zinc-700 dark:bg-[#09090b] dark:text-zinc-100 dark:hover:bg-zinc-900'
                                }`}
                              >
                                {isSelected ? 'السيرفر مُحدد حالياً' : 'استخدام في صانع الحسابات'}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  openInAppUrl(srv.pageUrl, {
                                    title: `${srv.code} · ${provider.name}`,
                                  })
                                }
                                className="inline-flex min-h-[36px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-[#09090b] dark:text-zinc-200 dark:hover:bg-zinc-900"
                              >
                                <span>صفحة السيرفر</span>
                                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
                {showMidAdHere && (
                  <AdSenseBanner
                    key={`ad-dir-mid-${mode}-${filteredProviders.length}`}
                    placement="middle"
                  />
                )}
              </div>
              );
            })}
          </div>
        )}
    </section>
  );

  return directorySection;
}

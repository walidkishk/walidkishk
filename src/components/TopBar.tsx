import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookmarkCheck,
  Check,
  ExternalLink,
  FileCode2,
  Gauge,
  Globe,
  GripVertical,
  Lock,
  LogIn,
  Menu,
  Moon,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  Sun,
  Terminal,
  UserCheck,
  X,
} from 'lucide-react';
import { useInAppBrowser } from '../context/InAppBrowserContext.tsx';
import { DEFAULT_NAV_ORDER, sanitizeNavOrder } from '../firebase.ts';
import type { SavedVpnAccount, ServerSummary, VpnProviderSummary, WorkspaceTab } from '../types.ts';

export type { WorkspaceTab };

interface TopBarProps {
  activeTab: WorkspaceTab;
  savedCount: number;
  isAuthenticated: boolean;
  isDark: boolean;
  onToggleDark: () => void;
  onNavigateTab: (tab: WorkspaceTab) => void;
  navOrder?: WorkspaceTab[];
  onNavOrderChange?: (nextOrder: WorkspaceTab[]) => void;
  providers?: VpnProviderSummary[];
  servers?: ServerSummary[];
  accounts?: SavedVpnAccount[];
  onSelectServer?: (serverId: string) => void;
  onRefreshSiteData?: () => void;
  refreshingSiteData?: boolean;
}

export function TopBar({
  activeTab,
  savedCount,
  isAuthenticated,
  isDark,
  onToggleDark,
  onNavigateTab,
  navOrder: controlledNavOrder,
  onNavOrderChange,
  providers = [],
  servers = [],
  accounts = [],
  onSelectServer,
  onRefreshSiteData,
  refreshingSiteData = false,
}: TopBarProps) {
  const { openInAppUrl } = useInAppBrowser();
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [isEditingOrder, setIsEditingOrder] = useState<boolean>(false);
  const [internalNavOrder, setInternalNavOrder] = useState<WorkspaceTab[]>(() => [...DEFAULT_NAV_ORDER]);
  const [draggedTab, setDraggedTab] = useState<WorkspaceTab | null>(null);

  const navOrder = useMemo(
    () => (controlledNavOrder ? sanitizeNavOrder(controlledNavOrder) : internalNavOrder),
    [controlledNavOrder, internalNavOrder],
  );

  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const navCatalog: Record<
    WorkspaceTab,
    {
      label: string;
      count?: number;
      Icon: typeof PlusCircle;
    }
  > = {
    overview: { label: 'إنشاء كونفج', Icon: PlusCircle },
    readyConfigs: { label: 'كونفجات جاهزه', Icon: FileCode2 },
    tunnel: { label: 'تشغيل وتجربة', Icon: Terminal },
    saved: { label: 'المحفوظة', count: savedCount, Icon: BookmarkCheck },
    servers: { label: 'السيرفرات', Icon: Server },
    autorenew: { label: 'سيرفرات متجدده تلقائيا', Icon: RefreshCw },
    tools: { label: 'السرعة', Icon: Gauge },
    auth: {
      label: isAuthenticated ? 'حسابي' : 'الدخول',
      Icon: isAuthenticated ? UserCheck : LogIn,
    },
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setSearchOpen(false);
      setIsEditingOrder(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!drawerOpen && !searchOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        setIsEditingOrder(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, searchOpen]);

  useEffect(() => {
    if (searchOpen) {
      const timer = window.setTimeout(() => searchInputRef.current?.focus(), 40);
      return () => window.clearTimeout(timer);
    }
  }, [searchOpen]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const searchResults = useMemo(() => {
    const matchedTabs = navOrder
      .map((id) => ({ id, ...navCatalog[id] }))
      .filter((t) => !normalizedQuery || t.label.toLowerCase().includes(normalizedQuery));

    const matchedProviders = providers
      .filter(
        (p) =>
          !normalizedQuery ||
          p.name.toLowerCase().includes(normalizedQuery) ||
          p.nameAr.toLowerCase().includes(normalizedQuery) ||
          p.domain.toLowerCase().includes(normalizedQuery) ||
          p.descriptionAr.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, normalizedQuery ? 8 : 5);

    const matchedServers = servers
      .filter(
        (s) =>
          !normalizedQuery ||
          s.code.toLowerCase().includes(normalizedQuery) ||
          s.host.toLowerCase().includes(normalizedQuery) ||
          s.countryAr.toLowerCase().includes(normalizedQuery) ||
          s.country.toLowerCase().includes(normalizedQuery) ||
          s.location.toLowerCase().includes(normalizedQuery) ||
          (s.providerName || '').toLowerCase().includes(normalizedQuery),
      )
      .slice(0, normalizedQuery ? 12 : 6);

    const matchedAccounts = accounts
      .filter(
        (a) =>
          !normalizedQuery ||
          (a.customName || '').toLowerCase().includes(normalizedQuery) ||
          a.username.toLowerCase().includes(normalizedQuery) ||
          a.host.toLowerCase().includes(normalizedQuery) ||
          a.serverCode.toLowerCase().includes(normalizedQuery) ||
          a.protocol.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 6);

    return { matchedTabs, matchedProviders, matchedServers, matchedAccounts };
  }, [accounts, navCatalog, navOrder, normalizedQuery, providers, servers]);

  const directUrlCandidate = useMemo(() => {
    const raw = searchQuery.trim();
    if (!raw || /\s/.test(raw)) return null;
    if (/^https?:\/\/[^\s]+$/i.test(raw)) return raw;
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(raw)) return `https://${raw}`;
    return null;
  }, [searchQuery]);

  const applyNextOrder = (next: WorkspaceTab[]) => {
    const clean = sanitizeNavOrder(next);
    if (!controlledNavOrder) {
      setInternalNavOrder(clean);
    }
    onNavOrderChange?.(clean);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= navOrder.length) return;
    const next = [...navOrder];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    applyNextOrder(next);
  };

  const handleResetOrder = () => {
    applyNextOrder([...DEFAULT_NAV_ORDER]);
  };

  const handleDragStart = (tabId: WorkspaceTab) => {
    setDraggedTab(tabId);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (targetTabId: WorkspaceTab) => {
    if (!draggedTab || draggedTab === targetTabId) {
      setDraggedTab(null);
      return;
    }
    const fromIndex = navOrder.indexOf(draggedTab);
    const toIndex = navOrder.indexOf(targetTabId);
    if (fromIndex !== -1 && toIndex !== -1) {
      const next = [...navOrder];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      applyNextOrder(next);
    }
    setDraggedTab(null);
  };

  const activeItemMeta = navCatalog[activeTab];

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-zinc-800 dark:bg-black/95">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-3 py-2.5 sm:px-5">
          {/* Right side (RTL start): Collapsible Menu Button + Brand Title */}
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setDrawerOpen((prev) => !prev)}
              aria-expanded={drawerOpen}
              aria-controls="right-nav-drawer"
              aria-label="فتح القائمة الجانبية"
              title="فتح القائمة الجانبية"
              className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100 dark:border-zinc-800 dark:bg-[#09090b] dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab(isAuthenticated ? 'overview' : 'auth')}
              className="flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-base font-bold tracking-tight text-slate-900 sm:text-lg dark:text-white"
            >
              <img
                src="/app-icon.png"
                alt=""
                aria-hidden="true"
                className="h-8 w-8 rounded-lg border border-slate-200 object-cover dark:border-zinc-800"
              />
              <span>VPN Fastore Pro</span>
            </button>

            <span className="hidden text-xs text-slate-400 sm:inline dark:text-zinc-600" aria-hidden="true">
              /
            </span>
            <span className="hidden truncate text-xs font-medium text-emerald-600 sm:inline dark:text-emerald-400">
              {isAuthenticated ? activeItemMeta.label : 'تسجيل الدخول مطلوب'}
            </span>
          </div>

          {/* Left side (RTL end): Search Action + Small Icon-Only Site Refresh Button (locked until signed in) */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={!isAuthenticated}
              onClick={() => {
                if (!isAuthenticated) return;
                setSearchOpen(true);
              }}
              title={
                isAuthenticated
                  ? 'بحث في المواقع والسيرفرات والحسابات'
                  : 'مغلق لحين تسجيل الدخول'
              }
              aria-label={
                isAuthenticated
                  ? 'بحث في المواقع والسيرفرات والحسابات'
                  : 'البحث مغلق لحين تسجيل الدخول'
              }
              className={`inline-flex min-h-[36px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors sm:px-3.5 ${
                isAuthenticated
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500'
                  : 'cursor-not-allowed border border-slate-300 bg-slate-100 text-slate-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500'
              }`}
            >
              {isAuthenticated ? (
                <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
              ) : (
                <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
              )}
              <span>{isAuthenticated ? 'البحث' : 'مغلق'}</span>
            </button>

            <button
              type="button"
              disabled={!isAuthenticated || refreshingSiteData}
              onClick={() => {
                if (!isAuthenticated || refreshingSiteData) return;
                onRefreshSiteData?.();
              }}
              title={
                isAuthenticated
                  ? 'تنشيط كامل بيانات الموقع'
                  : 'مغلق لحين تسجيل الدخول'
              }
              aria-label={
                isAuthenticated
                  ? 'تنشيط كامل بيانات الموقع'
                  : 'تنشيط بيانات الموقع مغلق لحين تسجيل الدخول'
              }
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                !isAuthenticated
                  ? 'cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500'
                  : 'cursor-pointer border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-60 dark:border-zinc-800 dark:bg-[#09090b] dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:text-emerald-400'
              }`}
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshingSiteData ? 'animate-spin text-emerald-600 dark:text-emerald-400' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      {isAuthenticated && searchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="البحث السريع"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 p-3 pt-14 backdrop-blur-[2px] sm:p-6 sm:pt-20"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#09090b]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-200 px-3.5 py-3 dark:border-zinc-800">
              <Search className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && directUrlCandidate) {
                    openInAppUrl(directUrlCandidate, { title: directUrlCandidate });
                    setSearchOpen(false);
                  }
                }}
                placeholder="ابحث عن موقع أو سيرفر أو دولة أو حساب محفوظ أو اكتب رابطاً..."
                className="min-h-[36px] flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-zinc-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="مسح البحث"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="إغلاق البحث"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              {searchQuery.trim() && (
                <div className="flex flex-wrap gap-2">
                  {directUrlCandidate && (
                    <button
                      type="button"
                      onClick={() => {
                        openInAppUrl(directUrlCandidate, { title: directUrlCandidate });
                        setSearchOpen(false);
                      }}
                      className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>فتح الرابط داخل التطبيق: {directUrlCandidate}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const q = encodeURIComponent(searchQuery.trim());
                      openInAppUrl(`https://www.google.com/search?q=${q}`, {
                        title: `بحث: ${searchQuery.trim()}`,
                      });
                      setSearchOpen(false);
                    }}
                    className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    <Globe className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <span>بحث ويب داخل التطبيق عن «{searchQuery.trim()}»</span>
                  </button>
                </div>
              )}

              {searchResults.matchedProviders.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-bold text-slate-500 dark:text-zinc-400">
                    المواقع المزودة ({searchResults.matchedProviders.length})
                  </h3>
                  <div className="space-y-1.5">
                    {searchResults.matchedProviders.map((prov) => (
                      <div
                        key={prov.providerId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-black"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectServer && prov.servers[0]) {
                              onSelectServer(prov.servers[0].serverId);
                            }
                            setSearchOpen(false);
                          }}
                          className="min-w-0 flex-1 text-right"
                        >
                          <div className="truncate text-xs font-bold text-slate-900 dark:text-white">
                            {prov.name} — {prov.nameAr}
                          </div>
                          <div className="truncate text-[11px] text-slate-500 dark:text-zinc-400">
                            {prov.servers.length} سيرفر · {prov.validityDaysLabelAr}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            openInAppUrl(prov.baseUrl, { title: prov.name });
                            setSearchOpen(false);
                          }}
                          className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                        >
                          <span>فتح الموقع</span>
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.matchedServers.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-bold text-slate-500 dark:text-zinc-400">
                    السيرفرات ({searchResults.matchedServers.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {searchResults.matchedServers.map((srv) => (
                      <button
                        key={srv.serverId}
                        type="button"
                        onClick={() => {
                          onSelectServer?.(srv.serverId);
                          setSearchOpen(false);
                        }}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-right transition-colors hover:border-emerald-500 dark:border-zinc-800 dark:bg-black dark:hover:border-emerald-500"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-slate-900 dark:text-white">
                            {srv.code} · {srv.countryAr}
                          </div>
                          <div dir="ltr" className="truncate font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                            {srv.host}
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {srv.providerName}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.matchedAccounts.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-bold text-slate-500 dark:text-zinc-400">
                    الحسابات المحفوظة ({searchResults.matchedAccounts.length})
                  </h3>
                  <div className="space-y-1.5">
                    {searchResults.matchedAccounts.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          onNavigateTab('saved');
                          setSearchOpen(false);
                        }}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-right hover:border-emerald-500 dark:border-zinc-800 dark:bg-black dark:hover:border-emerald-500"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-slate-900 dark:text-white">
                            {acc.customName || acc.username}
                          </div>
                          <div dir="ltr" className="truncate font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                            {acc.host} · {acc.protocol}
                          </div>
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          المحفوظة
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.matchedTabs.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-bold text-slate-500 dark:text-zinc-400">
                    أقسام التطبيق
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {searchResults.matchedTabs.map((tab) => {
                      const TabIcon = tab.Icon;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            onNavigateTab(tab.id);
                            setSearchOpen(false);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-500 dark:border-zinc-800 dark:bg-black dark:text-zinc-200"
                        >
                          <TabIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {normalizedQuery &&
                searchResults.matchedProviders.length === 0 &&
                searchResults.matchedServers.length === 0 &&
                searchResults.matchedAccounts.length === 0 &&
                searchResults.matchedTabs.length === 0 && (
                  <p className="py-4 text-center text-xs text-slate-500 dark:text-zinc-400">
                    لا توجد نتائج مطابقة في السيرفرات أو الحسابات — يمكنك فتح البحث عبر الويب داخل التطبيق بالأعلى.
                  </p>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Right Sidebar Drawer Backdrop */}
      {drawerOpen && (
        <div
          aria-hidden="true"
          onClick={() => {
            setDrawerOpen(false);
            setIsEditingOrder(false);
          }}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] transition-opacity"
        />
      )}

      {/* Collapsible & Editable Right Sidebar Drawer */}
      <aside
        id="right-nav-drawer"
        aria-label="القائمة الجانبية"
        aria-hidden={!drawerOpen}
        className={`fixed top-0 right-0 bottom-0 z-50 flex w-[300px] max-w-[85vw] flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 ease-out dark:border-zinc-800 dark:bg-[#09090b] ${
          drawerOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3.5 dark:border-zinc-800">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-950 dark:text-white">
              أقسام التطبيق
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
              {!isAuthenticated
                ? 'جميع الخيارات مغلقة لحين تسجيل الدخول'
                : isEditingOrder
                ? 'حرّك كل أيقونة للأعلى أو الأسفل ثم احفظ'
                : 'اختر القسم أو عدّل ترتيب الأيقونات'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setDrawerOpen(false);
              setIsEditingOrder(false);
            }}
            aria-label="إغلاق القائمة الجانبية"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Edit / Reorder Controls + Theme Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-black">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={!isAuthenticated}
              onClick={() => {
                if (!isAuthenticated) return;
                if (isEditingOrder) {
                  onNavOrderChange?.(navOrder);
                }
                setIsEditingOrder((prev) => !prev);
              }}
              className={`inline-flex min-h-[34px] items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                !isAuthenticated
                  ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500'
                  : isEditingOrder
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-[#09090b] dark:text-zinc-200 dark:hover:bg-zinc-900'
              }`}
            >
              {isEditingOrder ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>حفظ الترتيب</span>
                </>
              ) : (
                <>
                  <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>تعديل الترتيب</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onToggleDark}
              aria-label={isDark ? 'تبديل للوضع النهاري' : 'تبديل للوضع الأسود'}
              className="inline-flex min-h-[34px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-zinc-700 dark:bg-[#09090b] dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              {isDark ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                  <span>الوضع النهاري</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-slate-700" aria-hidden="true" />
                  <span>الوضع الأسود</span>
                </>
              )}
            </button>
          </div>

          {isEditingOrder && (
            <button
              type="button"
              onClick={handleResetOrder}
              title="استعادة الترتيب الافتراضي"
              className="inline-flex min-h-[34px] items-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-zinc-700 dark:bg-[#09090b] dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>افتراضي</span>
            </button>
          )}
        </div>

        {/* Reorderable Vertical Navigation List */}
        <nav aria-label="أقسام التطبيق" className="flex-1 space-y-1.5 overflow-y-auto p-3">
          {navOrder.map((id, index) => {
            const item = navCatalog[id];
            const Icon = item.Icon;
            const isActive = activeTab === id;
            const isFirst = index === 0;
            const isLast = index === navOrder.length - 1;

            if (isEditingOrder) {
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={() => handleDragStart(id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(id)}
                  className={`flex min-h-[48px] items-center justify-between gap-2 rounded-xl border px-3 py-2 transition-colors ${
                    draggedTab === id
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-200 bg-slate-50/70 dark:border-zinc-800 dark:bg-black'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <GripVertical
                      className="h-4 w-4 shrink-0 cursor-grab text-slate-400 dark:text-zinc-500"
                      aria-hidden="true"
                    />
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-zinc-300'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate text-xs font-semibold text-slate-900 dark:text-zinc-100">
                      {item.label}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveItem(index, -1)}
                      disabled={isFirst}
                      aria-label={`نقل ${item.label} للأعلى`}
                      title="نقل للأعلى"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-35 dark:border-zinc-700 dark:bg-[#09090b] dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(index, 1)}
                      disabled={isLast}
                      aria-label={`نقل ${item.label} للأسفل`}
                      title="نقل للأسفل"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-35 dark:border-zinc-700 dark:bg-[#09090b] dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            }

            const isLocked = !isAuthenticated && id !== 'auth';

            return (
              <button
                key={id}
                type="button"
                disabled={isLocked}
                onClick={() => {
                  if (isLocked) return;
                  onNavigateTab(id);
                  setDrawerOpen(false);
                }}
                title={isLocked ? 'مغلق لحين تسجيل الدخول' : item.label}
                className={`flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-right transition-colors ${
                  isLocked
                    ? 'cursor-not-allowed text-slate-400 opacity-55 dark:text-zinc-500'
                    : isActive
                    ? 'cursor-pointer bg-emerald-500/15 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                    : 'cursor-pointer text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white'
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className="truncate text-sm">{item.label}</span>
                </span>

                {isLocked ? (
                  <Lock className="h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" aria-hidden="true" />
                ) : typeof item.count === 'number' ? (
                  <span className="font-mono text-xs opacity-80 tabular-nums">
                    ({item.count})
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

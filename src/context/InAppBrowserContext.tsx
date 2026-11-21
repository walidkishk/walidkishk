import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface SavedCustomSite {
  id: string;
  title: string;
  url: string;
  category: 'config' | 'article' | 'social' | 'other';
  addedAt: string;
}

export interface WebViewTab {
  id: string;
  title: string;
  url: string;
  history: string[];
  historyIndex: number;
  loading: boolean;
  progress: number;
  mode: 'proxy' | 'direct';
  kind: 'web' | 'social';
  socialLabel?: string;
  wvSession: string;
  reloadCounter: number;
}

export interface OpenInAppOptions {
  title?: string;
  openInSeparateTab?: boolean;
  mode?: 'proxy' | 'direct';
}

interface InAppBrowserContextValue {
  isOpen: boolean;
  tabs: WebViewTab[];
  activeTabId: string | null;
  activeWebTab: WebViewTab | null;
  savedSites: SavedCustomSite[];
  openInAppUrl: (rawUrl: string, options?: OpenInAppOptions) => void;
  openEmptyBrowser: () => void;
  closeWebView: () => void;
  closeWebTab: (tabId: string) => void;
  selectWebTab: (tabId: string) => void;
  navigateActiveTab: (rawUrl: string) => void;
  goBackInWebView: () => void;
  goForwardInWebView: () => void;
  reloadWebView: () => void;
  toggleWebTabMode: () => void;
  markWebViewLoaded: (tabId: string, resolvedTitle?: string) => void;
  addCustomSite: (
    title: string,
    rawUrl: string,
    category?: SavedCustomSite['category'],
  ) => SavedCustomSite | null;
  removeCustomSite: (id: string) => void;
  syncAppRouteTab: (appTab: string) => void;
}

const SAVED_SITES_KEY = 'vpn_fastore_custom_sites_v1';
const WV_STORAGE_PREFIX = 'vpnfastore_wv_ls::';

const InAppBrowserContext = createContext<InAppBrowserContextValue | null>(null);

function makeId(prefix = 'wv'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isSocialMessagingUrl(rawUrl: string): boolean {
  const lower = rawUrl.trim().toLowerCase();
  if (lower.startsWith('whatsapp://') || lower.startsWith('tg://')) return true;
  try {
    const u = new URL(lower);
    const h = u.hostname;
    return (
      h === 'wa.me' ||
      h === 'api.whatsapp.com' ||
      h === 'chat.whatsapp.com' ||
      h === 'web.whatsapp.com' ||
      h === 't.me' ||
      h === 'telegram.me' ||
      h === 'telegram.dog' ||
      h === 'web.telegram.org'
    );
  } catch {
    return false;
  }
}

export function getSocialLabel(rawUrl: string): string | undefined {
  const lower = rawUrl.trim().toLowerCase();
  if (
    lower.startsWith('whatsapp://') ||
    lower.includes('wa.me/') ||
    lower.includes('whatsapp.com')
  ) {
    return 'واتساب';
  }
  if (
    lower.startsWith('tg://') ||
    lower.includes('t.me/') ||
    lower.includes('telegram.me') ||
    lower.includes('telegram.dog') ||
    lower.includes('web.telegram.org')
  ) {
    return 'تليجرام';
  }
  return undefined;
}

export function normalizeExternalUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return null;

  if (/^tg:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed.replace(/^tg:\/\//i, 'https://t.me/'));
      const domain = u.searchParams.get('domain');
      const invite = u.searchParams.get('invite');
      if (domain) return `https://t.me/${encodeURIComponent(domain)}`;
      if (invite) return `https://t.me/+${encodeURIComponent(invite)}`;
      return `https://t.me${u.pathname}${u.search}`;
    } catch {
      return 'https://t.me/';
    }
  }

  if (/^whatsapp:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed.replace(/^whatsapp:\/\//i, 'https://api.whatsapp.com/'));
      return `https://api.whatsapp.com/send${u.search}`;
    } catch {
      return 'https://wa.me/';
    }
  }

  if (/^intent:\/\//i.test(trimmed)) {
    const match = trimmed.match(/S\.browser_fallback_url=([^;]+)/i);
    if (match?.[1]) {
      try {
        return normalizeExternalUrl(decodeURIComponent(match[1]));
      } catch {
        return null;
      }
    }
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).href;
    } catch {
      return null;
    }
  }

  // Bare domain or host/path typed by user (e.g., ssh-tunnel.net)
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(trimmed)) {
    try {
      return new URL(`https://${trimmed}`).href;
    } catch {
      return null;
    }
  }

  return null;
}

export function getStoredOriginData(targetUrl: string): string {
  try {
    const origin = new URL(targetUrl).origin;
    const raw = localStorage.getItem(`${WV_STORAGE_PREFIX}${origin}`);
    if (!raw || raw.length > 8000) return '{}';
    return raw;
  } catch {
    return '{}';
  }
}

export function buildWebViewIframeSrc(tab: WebViewTab): string {
  if (tab.mode === 'direct') {
    return tab.url;
  }
  const ls = getStoredOriginData(tab.url);
  return `/api/webview/proxy?url=${encodeURIComponent(tab.url)}&wvSession=${encodeURIComponent(tab.wvSession)}&ls=${encodeURIComponent(ls)}&_r=${tab.reloadCounter}`;
}

function loadSavedSites(): SavedCustomSite[] {
  try {
    const raw = localStorage.getItem(SAVED_SITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedCustomSite =>
        Boolean(item && typeof item.id === 'string' && typeof item.url === 'string'),
    );
  } catch {
    return [];
  }
}

function persistSavedSites(sites: SavedCustomSite[]): void {
  try {
    localStorage.setItem(SAVED_SITES_KEY, JSON.stringify(sites));
  } catch {
    // ignore storage quota errors
  }
}

export function InAppBrowserProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [tabs, setTabs] = useState<WebViewTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [savedSites, setSavedSites] = useState<SavedCustomSite[]>(() => loadSavedSites());

  const isOpenRef = useRef(isOpen);
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  const activeWebTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0] ?? null;

  // Smooth top loading progress bar animation while any active tab is loading
  useEffect(() => {
    if (!isOpen || !activeWebTab?.loading) return;
    const timer = window.setInterval(() => {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== activeWebTab.id || !t.loading) return t;
          const step = t.progress < 40 ? 14 : t.progress < 75 ? 7 : 2;
          return { ...t, progress: Math.min(92, t.progress + step) };
        }),
      );
    }, 240);
    return () => window.clearInterval(timer);
  }, [isOpen, activeWebTab?.id, activeWebTab?.loading]);

  const pushWebViewHistoryEntry = useCallback((depth: number) => {
    try {
      window.history.pushState({ __vpnApp: 'webview', depth }, '');
    } catch {
      // ignore history errors
    }
  }, []);

  const openInAppUrl = useCallback(
    (rawUrl: string, options?: OpenInAppOptions) => {
      const normalized = normalizeExternalUrl(rawUrl);
      if (!normalized) return;

      const socialLabel = getSocialLabel(normalized);
      const isSocial = Boolean(socialLabel || isSocialMessagingUrl(normalized));
      const openSeparate = Boolean(options?.openInSeparateTab || isSocial);
      const mode: 'proxy' | 'direct' = options?.mode ?? 'proxy';
      const fallbackTitle = (() => {
        try {
          return options?.title?.trim() || new URL(normalized).hostname;
        } catch {
          return options?.title?.trim() || normalized;
        }
      })();

      setTabs((prev) => {
        // Reuse existing tab if user wants same WebView, or create a new tab if none/separate
        const current = prev.find((t) => t.id === activeTabIdRef.current);
        if (!openSeparate && current && isOpenRef.current) {
          const nextHistory = [
            ...current.history.slice(0, current.historyIndex + 1),
            normalized,
          ];
          const nextIndex = nextHistory.length - 1;
          pushWebViewHistoryEntry(nextIndex);
          return prev.map((t) =>
            t.id === current.id
              ? {
                  ...t,
                  title: options?.title?.trim() || t.title,
                  url: normalized,
                  history: nextHistory,
                  historyIndex: nextIndex,
                  loading: true,
                  progress: 18,
                  mode,
                  reloadCounter: t.reloadCounter + 1,
                }
              : t,
          );
        }

        const newTab: WebViewTab = {
          id: makeId('tab'),
          title: socialLabel ? `${socialLabel} · ${fallbackTitle}` : fallbackTitle,
          url: normalized,
          history: [normalized],
          historyIndex: 0,
          loading: true,
          progress: 18,
          mode,
          kind: isSocial ? 'social' : 'web',
          socialLabel,
          wvSession: makeId('wvs'),
          reloadCounter: 1,
        };
        setActiveTabId(newTab.id);
        pushWebViewHistoryEntry(0);
        return [...prev, newTab];
      });

      setIsOpen(true);
    },
    [pushWebViewHistoryEntry],
  );

  const openEmptyBrowser = useCallback(() => {
    if (tabsRef.current.length > 0) {
      setIsOpen(true);
      pushWebViewHistoryEntry(0);
      return;
    }
    openInAppUrl('https://www.ssh-tunnel.net/europe-africa/server-15/', {
      title: 'ssh-tunnel.net',
    });
  }, [openInAppUrl, pushWebViewHistoryEntry]);

  const closeWebView = useCallback(() => {
    setIsOpen(false);
  }, []);

  const closeWebTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const remaining = prev.filter((t) => t.id !== tabId);
      if (remaining.length === 0) {
        setIsOpen(false);
        setActiveTabId(null);
      } else if (activeTabIdRef.current === tabId) {
        setActiveTabId(remaining[remaining.length - 1].id);
      }
      return remaining;
    });
  }, []);

  const selectWebTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const navigateActiveTab = useCallback(
    (rawUrl: string) => {
      const normalized = normalizeExternalUrl(rawUrl);
      if (!normalized) return;

      const socialLabel = getSocialLabel(normalized);
      const isSocial = Boolean(socialLabel || isSocialMessagingUrl(normalized));

      if (isSocial && activeTabIdRef.current) {
        const active = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
        if (active && active.kind !== 'social') {
          openInAppUrl(normalized, { openInSeparateTab: true });
          return;
        }
      }

      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== activeTabIdRef.current) return t;
          const nextHistory = [...t.history.slice(0, t.historyIndex + 1), normalized];
          const nextIndex = nextHistory.length - 1;
          pushWebViewHistoryEntry(nextIndex);
          return {
            ...t,
            url: normalized,
            history: nextHistory,
            historyIndex: nextIndex,
            loading: true,
            progress: 18,
            reloadCounter: t.reloadCounter + 1,
          };
        }),
      );
    },
    [openInAppUrl, pushWebViewHistoryEntry],
  );

  const goBackInWebView = useCallback(() => {
    const current = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
    if (!current) {
      setIsOpen(false);
      return;
    }
    if (current.historyIndex > 0) {
      const prevIdx = current.historyIndex - 1;
      const prevUrl = current.history[prevIdx];
      setTabs((prev) =>
        prev.map((t) =>
          t.id === current.id
            ? {
                ...t,
                url: prevUrl,
                historyIndex: prevIdx,
                loading: true,
                progress: 20,
                reloadCounter: t.reloadCounter + 1,
              }
            : t,
        ),
      );
      return;
    }

    if (tabsRef.current.length > 1) {
      closeWebTab(current.id);
      return;
    }

    setIsOpen(false);
  }, [closeWebTab]);

  const goForwardInWebView = useCallback(() => {
    const current = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
    if (!current || current.historyIndex >= current.history.length - 1) return;
    const nextIdx = current.historyIndex + 1;
    const nextUrl = current.history[nextIdx];
    setTabs((prev) =>
      prev.map((t) =>
        t.id === current.id
          ? {
              ...t,
              url: nextUrl,
              historyIndex: nextIdx,
              loading: true,
              progress: 20,
              reloadCounter: t.reloadCounter + 1,
            }
          : t,
      ),
    );
  }, []);

  const reloadWebView = useCallback(() => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabIdRef.current
          ? { ...t, loading: true, progress: 18, reloadCounter: t.reloadCounter + 1 }
          : t,
      ),
    );
  }, []);

  const toggleWebTabMode = useCallback(() => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabIdRef.current
          ? {
              ...t,
              mode: t.mode === 'proxy' ? 'direct' : 'proxy',
              loading: true,
              progress: 18,
              reloadCounter: t.reloadCounter + 1,
            }
          : t,
      ),
    );
  }, []);

  const markWebViewLoaded = useCallback((tabId: string, resolvedTitle?: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? {
              ...t,
              loading: false,
              progress: 100,
              title: resolvedTitle?.trim() || t.title,
            }
          : t,
      ),
    );
  }, []);

  const addCustomSite = useCallback(
    (title: string, rawUrl: string, category: SavedCustomSite['category'] = 'other') => {
      const normalized = normalizeExternalUrl(rawUrl);
      if (!normalized) return null;
      const derivedTitle = (() => {
        if (title.trim()) return title.trim();
        try {
          return new URL(normalized).hostname;
        } catch {
          return normalized;
        }
      })();
      const nextItem: SavedCustomSite = {
        id: makeId('site'),
        title: derivedTitle,
        url: normalized,
        category: isSocialMessagingUrl(normalized) ? 'social' : category,
        addedAt: new Date().toISOString(),
      };
      setSavedSites((prev) => {
        const deduped = prev.filter((s) => s.url !== normalized);
        const updated = [nextItem, ...deduped];
        persistSavedSites(updated);
        return updated;
      });
      return nextItem;
    },
    [],
  );

  const removeCustomSite = useCallback((id: string) => {
    setSavedSites((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      persistSavedSites(updated);
      return updated;
    });
  }, []);

  const syncAppRouteTab = useCallback((appTab: string) => {
    try {
      if (appTab !== 'overview') {
        const st = window.history.state as { __vpnApp?: string; tab?: string } | null;
        if (!st || st.__vpnApp !== 'tab' || st.tab !== appTab) {
          window.history.pushState({ __vpnApp: 'tab', tab: appTab }, '');
        }
      }
    } catch {
      // ignore history errors
    }
  }, []);

  // Listen to postMessage events from our proxied WebView iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;

      if (data.type === 'vpnfastore_webview_nav' && typeof data.url === 'string') {
        const targetMode = data.targetMode === 'separate_tab' ? 'separate_tab' : 'same';
        if (targetMode === 'separate_tab') {
          openInAppUrl(data.url, { openInSeparateTab: true });
        } else {
          navigateActiveTab(data.url);
        }
        return;
      }

      if (data.type === 'vpnfastore_webview_loading') {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTabIdRef.current
              ? {
                  ...t,
                  url: typeof data.url === 'string' ? data.url : t.url,
                  loading: true,
                  progress: 22,
                }
              : t,
          ),
        );
        return;
      }

      if (data.type === 'vpnfastore_webview_meta' || data.type === 'vpnfastore_webview_loaded') {
        const isDone = data.type === 'vpnfastore_webview_loaded';
        const nextTitle = typeof data.title === 'string' ? data.title.trim() : '';
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTabIdRef.current
              ? {
                  ...t,
                  title: nextTitle || t.title,
                  loading: isDone ? false : t.loading,
                  progress: isDone ? 100 : Math.max(t.progress, 65),
                }
              : t,
          ),
        );
        return;
      }

      if (
        data.type === 'vpnfastore_wv_storage_sync' &&
        typeof data.origin === 'string' &&
        data.data &&
        typeof data.data === 'object'
      ) {
        try {
          const serialized = JSON.stringify(data.data);
          if (serialized.length <= 16_000) {
            localStorage.setItem(`${WV_STORAGE_PREFIX}${data.origin}`, serialized);
          }
        } catch {
          // ignore quota errors
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigateActiveTab, openInAppUrl]);

  // Global document click interceptor & window.open blocker:
  // Ensures NO link anywhere in the app ever launches an external browser (Chrome)
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a, area') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.hasAttribute('download')) return;

      const rawHref = anchor.getAttribute('href');
      if (!rawHref) return;
      const trimmed = rawHref.trim();
      if (!trimmed || trimmed.startsWith('#') || /^javascript:/i.test(trimmed)) return;
      if (/^blob:/i.test(trimmed)) return;

      // Check if it is an external URL or messaging scheme or explicitly targeted externally
      let isExternal = false;
      if (/^(tg|whatsapp|intent):\/\//i.test(trimmed)) {
        isExternal = true;
      } else if (/^https?:\/\//i.test(trimmed)) {
        try {
          const parsed = new URL(trimmed);
          isExternal = parsed.origin !== window.location.origin;
        } catch {
          isExternal = true;
        }
      } else if (anchor.getAttribute('target') === '_blank') {
        isExternal = true;
      }

      if (!isExternal) return;

      e.preventDefault();
      e.stopPropagation();
      const label = anchor.textContent?.trim();
      openInAppUrl(trimmed, {
        title: label && label.length <= 60 ? label : undefined,
        openInSeparateTab: isSocialMessagingUrl(trimmed),
      });
    };

    document.addEventListener('click', handleGlobalClick, true);

    const originalWindowOpen = window.open;
    window.open = ((url?: string | URL | undefined) => {
      if (url) {
        const str = String(url);
        openInAppUrl(str, { openInSeparateTab: isSocialMessagingUrl(str) });
      }
      return null;
    }) as typeof window.open;

    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
      window.open = originalWindowOpen;
    };
  }, [openInAppUrl]);

  // Hardware Back Button (Android / Mobile popstate) handler:
  // 1. Inside WebView -> returns to previous page in WebView (or closes WebView at root)
  // 2. Outside WebView -> returns to app home tab ('overview')
  // 3. Only exits when user is already on app home tab with WebView closed
  useEffect(() => {
    const handlePopState = () => {
      if (isOpenRef.current) {
        goBackInWebView();
        return;
      }

      if (document.documentElement.dataset.appAtHome === '0') {
        window.dispatchEvent(new CustomEvent('vpnfastore:app_back_home'));
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [goBackInWebView]);

  return (
    <InAppBrowserContext.Provider
      value={{
        isOpen,
        tabs,
        activeTabId,
        activeWebTab,
        savedSites,
        openInAppUrl,
        openEmptyBrowser,
        closeWebView,
        closeWebTab,
        selectWebTab,
        navigateActiveTab,
        goBackInWebView,
        goForwardInWebView,
        reloadWebView,
        toggleWebTabMode,
        markWebViewLoaded,
        addCustomSite,
        removeCustomSite,
        syncAppRouteTab,
      }}
    >
      {children}
    </InAppBrowserContext.Provider>
  );
}

export function useInAppBrowser(): InAppBrowserContextValue {
  const ctx = useContext(InAppBrowserContext);
  if (!ctx) {
    throw new Error('useInAppBrowser must be used inside InAppBrowserProvider');
  }
  return ctx;
}

export function useHardwareBackRoot(isAtHome: boolean, goHome: () => void) {
  const ctx = useInAppBrowser();
  const isAtHomeRef = useRef(isAtHome);
  const goHomeRef = useRef(goHome);

  useEffect(() => {
    isAtHomeRef.current = isAtHome;
    goHomeRef.current = goHome;
  }, [isAtHome, goHome]);

  useEffect(() => {
    // Wire direct refs inside context via custom event or callback registration
    const onBackToHome = () => {
      if (!isAtHomeRef.current) {
        goHomeRef.current();
      }
    };
    window.addEventListener('vpnfastore:app_back_home', onBackToHome);
    return () => window.removeEventListener('vpnfastore:app_back_home', onBackToHome);
  }, []);

  // Expose helper check via window dataset flag so popstate knows immediately
  useEffect(() => {
    document.documentElement.dataset.appAtHome = isAtHome ? '1' : '0';
  }, [isAtHome]);

  void ctx;
}

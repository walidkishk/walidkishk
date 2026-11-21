import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
  BookmarkPlus,
  Globe,
  Lock,
  MessageCircle,
  RefreshCw,
  Shield,
  X,
} from 'lucide-react';
import {
  buildWebViewIframeSrc,
  useInAppBrowser,
} from '../context/InAppBrowserContext.tsx';

export function InAppWebViewModal() {
  const {
    isOpen,
    tabs,
    activeWebTab,
    savedSites,
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
  } = useInAppBrowser();

  const [addressInput, setAddressInput] = useState<string>('');
  const [showBookmarksBar, setShowBookmarksBar] = useState<boolean>(false);

  useEffect(() => {
    if (activeWebTab?.url) {
      setAddressInput(activeWebTab.url);
    }
  }, [activeWebTab?.url, activeWebTab?.id]);

  // Safety fallback so top loading bar always hides if an external script stalls subresources
  useEffect(() => {
    if (!isOpen || !activeWebTab?.loading) return;
    const timer = window.setTimeout(() => {
      markWebViewLoaded(activeWebTab.id);
    }, 12_000);
    return () => window.clearTimeout(timer);
  }, [isOpen, activeWebTab?.id, activeWebTab?.loading, activeWebTab?.reloadCounter, markWebViewLoaded]);

  if (!isOpen || !activeWebTab) return null;

  const canGoBack = activeWebTab.historyIndex > 0;
  const canGoForward = activeWebTab.historyIndex < activeWebTab.history.length - 1;
  const isAlreadySaved = savedSites.some((s) => s.url === activeWebTab.url);
  const iframeSrc = buildWebViewIframeSrc(activeWebTab);

  const handleAddressSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!addressInput.trim()) return;
    navigateActiveTab(addressInput);
  };

  const handleSaveCurrentSite = () => {
    addCustomSite(
      activeWebTab.title || activeWebTab.url,
      activeWebTab.url,
      activeWebTab.kind === 'social' ? 'social' : 'config',
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="عارض المواقع الداخلي"
      className="fixed inset-0 z-50 flex flex-col bg-white text-slate-900 dark:bg-black dark:text-zinc-100"
    >
      {/* Multi-Tab Bar when multiple windows/tabs (e.g. separate WhatsApp/Telegram WebView) are open */}
      {tabs.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 bg-slate-100 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950">
          {tabs.map((tab) => {
            const active = tab.id === activeWebTab.id;
            return (
              <div
                key={tab.id}
                className={`flex max-w-[220px] shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                  active
                    ? 'border-emerald-500/60 bg-white font-semibold text-slate-950 dark:bg-zinc-900 dark:text-white'
                    : 'border-transparent bg-transparent text-slate-600 hover:bg-white/60 dark:text-zinc-400 dark:hover:bg-zinc-900/60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectWebTab(tab.id)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-right"
                >
                  {tab.kind === 'social' ? (
                    <MessageCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                  ) : (
                    <Globe className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                  )}
                  <span className="truncate">{tab.title}</span>
                </button>
                <button
                  type="button"
                  onClick={() => closeWebTab(tab.id)}
                  aria-label={`إغلاق تبويب ${tab.title}`}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Top WebView Control Bar */}
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-[#09090b]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goBackInWebView}
            title={canGoBack ? 'رجوع للصفحة السابقة داخل العارض' : 'رجوع للتطبيق'}
            aria-label={canGoBack ? 'رجوع للصفحة السابقة' : 'العودة للتطبيق'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-zinc-800 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={goForwardInWebView}
            disabled={!canGoForward}
            title="تقديم"
            aria-label="تقديم"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-zinc-800 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={reloadWebView}
            title="تحديث الصفحة"
            aria-label="تحديث الصفحة"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-zinc-800 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <RefreshCw
              className={`h-4 w-4 ${activeWebTab.loading ? 'animate-spin text-emerald-500' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* Address Bar */}
        <form onSubmit={handleAddressSubmit} className="flex min-w-[180px] flex-1 items-center gap-1.5">
          <div className="relative flex flex-1 items-center">
            <Lock
              className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
            <input
              type="text"
              dir="ltr"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              placeholder="https://..."
              aria-label="عنوان الموقع داخل العارض"
              className="h-9 w-full rounded-lg border border-slate-300 bg-slate-50 pr-3 pl-8 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            انتقال
          </button>
        </form>

        {/* Actions: Bookmark, Mode Toggle, Saved Sites Drawer, Close */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleSaveCurrentSite}
            title={isAlreadySaved ? 'محفوظ في المواقع المضافة' : 'حفظ الموقع في التطبيق'}
            className={`inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
              isAlreadySaved
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-zinc-800 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900'
            }`}
          >
            {isAlreadySaved ? (
              <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{isAlreadySaved ? 'محفوظ' : 'حفظ'}</span>
          </button>

          {savedSites.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBookmarksBar((prev) => !prev)}
              className="inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-zinc-800 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <span>المواقع ({savedSites.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleWebTabMode}
            title="التبديل بين الوضع الداخلي المحمي والعرض المباشر"
            className="inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-zinc-800 dark:bg-black dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <Shield className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            <span className="hidden md:inline">
              {activeWebTab.mode === 'proxy' ? 'العارض الداخلي' : 'عرض مباشر'}
            </span>
          </button>

          <button
            type="button"
            onClick={closeWebView}
            className="inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span>إغلاق</span>
          </button>
        </div>
      </header>

      {/* Secondary Info Strip: Page Title + Social Window Indicator */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50 px-3 py-1 text-[11px] text-slate-600 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-400">
        <div className="flex min-w-0 items-center gap-2">
          {activeWebTab.kind === 'social' && (
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              نافذة {activeWebTab.socialLabel || 'خارجية'} داخلية
            </span>
          )}
          {activeWebTab.kind === 'social' && <span aria-hidden="true">·</span>}
          <span className="truncate font-medium text-slate-800 dark:text-zinc-200">
            {activeWebTab.title}
          </span>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-slate-500 dark:text-zinc-500">
          {activeWebTab.loading ? 'جارٍ التحميل...' : 'تصفح داخلي آمن · JS + Storage مفعّل'}
        </span>
      </div>

      {/* Saved Sites Quick Strip inside WebView */}
      {showBookmarksBar && savedSites.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
          {savedSites.map((site) => (
            <button
              key={site.id}
              type="button"
              onClick={() => {
                navigateActiveTab(site.url);
                setShowBookmarksBar(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 hover:border-emerald-500 hover:text-emerald-700 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
            >
              <Globe className="h-3 w-3 text-emerald-500" aria-hidden="true" />
              <span className="max-w-[160px] truncate">{site.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Top Loading Progress Bar */}
      <div
        className={`relative h-[3px] w-full overflow-hidden bg-slate-200/70 transition-opacity duration-200 dark:bg-zinc-900 ${
          activeWebTab.loading ? 'opacity-100' : 'opacity-0'
        }`}
        role="progressbar"
        aria-valuenow={activeWebTab.progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-hidden={!activeWebTab.loading}
      >
        <div
          className="h-full bg-emerald-500 transition-[width] duration-200 ease-out"
          style={{ width: `${activeWebTab.progress}%` }}
        />
      </div>

      {/* Sandboxed Internal WebView Frame (Never escapes to external Chrome) */}
      <div className="relative flex-1 bg-white dark:bg-zinc-950">
        <iframe
          key={`${activeWebTab.id}_${activeWebTab.reloadCounter}_${activeWebTab.mode}`}
          src={iframeSrc}
          title={activeWebTab.title || 'عارض المواقع الداخلي'}
          sandbox={
            activeWebTab.mode === 'proxy'
              ? 'allow-scripts allow-forms allow-modals'
              : 'allow-scripts allow-same-origin allow-forms allow-modals'
          }
          referrerPolicy="no-referrer"
          onLoad={() => markWebViewLoaded(activeWebTab.id)}
          className="h-full w-full border-0 bg-white"
        />
      </div>
    </div>
  );
}

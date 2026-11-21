import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BookmarkCheck,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  FileCode2,
  Globe,
  Pencil,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import type {
  AccountProbeResult,
  FormatCheckResult,
  ProtocolFormatId,
  ProtocolPortSpec,
  SavedVpnAccount,
} from '../types.ts';
import { buildConfigBundle, getProtocolLabelAr } from '../utils/configGenerators.ts';
import {
  addDaysToDatetimeLocal,
  datetimeLocalToIso,
  formatArabicExpiryDate,
  getExpiryCounterDetails,
  getExpiryGradualUrgency,
  toDatetimeLocalValue,
} from '../utils/expiryUtils.ts';
import { AdSenseBanner } from './AdSenseBanner.tsx';

interface SavedAccountsVaultProps {
  accounts: SavedVpnAccount[];
  loading: boolean;
  isAuthenticated: boolean;
  onRequireAuth: () => void;
  protocols: ProtocolPortSpec[];
  liveConnectedUsers: number;
  onToggleAutoRenew: (id: string, nextValue: boolean) => Promise<void>;
  onRenewNow: (id: string) => Promise<void>;
  onPingAccount: (id: string) => Promise<AccountProbeResult | null>;
  onProbeAllAccounts: () => Promise<void>;
  probingAll: boolean;
  onVerifyAllFormats: (account: SavedVpnAccount) => Promise<FormatCheckResult[]>;
  onSavePreset: (id: string, preset: { protocol: ProtocolFormatId; port: number; sni: string }) => Promise<void>;
  onUpdateExpiresAt: (id: string, expiresAtIso: string) => Promise<void>;
  onUpdateCustomName: (id: string, customName: string) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
  busyAccountId: string | null;
}

function supportsRealRenewal(acc: SavedVpnAccount): boolean {
  return (
    (acc.serverPageUrl || '').includes('ssh-tunnel.net') ||
    (acc.host || '').toLowerCase().endsWith('.stunnel.cc')
  );
}

export function SavedAccountsVault({
  accounts,
  loading,
  isAuthenticated,
  onRequireAuth,
  protocols,
  liveConnectedUsers,
  onToggleAutoRenew,
  onRenewNow,
  onPingAccount,
  onProbeAllAccounts,
  probingAll,
  onVerifyAllFormats,
  onSavePreset,
  onUpdateExpiresAt,
  onUpdateCustomName,
  onDeleteAccount,
  busyAccountId,
}: SavedAccountsVaultProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'auto' | 'manual'>('all');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [editingExpiryId, setEditingExpiryId] = useState<string | null>(null);
  const [editingExpiryValue, setEditingExpiryValue] = useState<string>('');
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState<string>('');
  const [modalAccount, setModalAccount] = useState<SavedVpnAccount | null>(null);
  const [modalProtocol, setModalProtocol] = useState<ProtocolFormatId>('ssh_ws');
  const [modalSni, setModalSni] = useState<string>('creativecommons.org');
  const [modalFormatChecks, setModalFormatChecks] = useState<FormatCheckResult[]>([]);
  const [verifyingFormats, setVerifyingFormats] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [savingPreset, setSavingPreset] = useState<boolean>(false);
  const [presetSavedNotice, setPresetSavedNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Every saved account starts collapsed by default so the page stays compact and tidy
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!modalAccount) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalAccount(null);
        setModalError(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [modalAccount]);

  const filtered = accounts.filter((acc) => {
    if (filterMode === 'auto' && !acc.autoRenew) return false;
    if (filterMode === 'manual' && acc.autoRenew) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      acc.username.toLowerCase().includes(q) ||
      (acc.customName || '').toLowerCase().includes(q) ||
      (acc.serverName || '').toLowerCase().includes(q) ||
      acc.host.toLowerCase().includes(q) ||
      (acc.serverIp || '').toLowerCase().includes(q) ||
      acc.serverCode.toLowerCase().includes(q) ||
      (acc.serverCountryAr || '').toLowerCase().includes(q) ||
      acc.protocol.toLowerCase().includes(q)
    );
  });

  const anyExpanded = filtered.some((acc) => Boolean(expandedAccounts[acc.id]));

  const toggleAccountExpand = (id: string) => {
    setExpandedAccounts((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleToggleAllAccounts = () => {
    if (anyExpanded) {
      setExpandedAccounts({});
    } else {
      const next: Record<string, boolean> = {};
      for (const acc of filtered) {
        next[acc.id] = true;
      }
      setExpandedAccounts(next);
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // ignore
    }
  };

  const handleDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const closeFormatsModal = () => {
    setModalAccount(null);
    setModalError(null);
  };

  const openFormatsModal = (acc: SavedVpnAccount, runVerifyNow = false) => {
    setModalAccount(acc);
    setModalProtocol(acc.protocol);
    setModalSni(acc.sni || 'creativecommons.org');
    setModalFormatChecks([]);
    setModalError(null);
    setPresetSavedNotice(null);
    if (runVerifyNow) {
      void runVerifyModalFormats(acc);
    }
  };

  const runVerifyModalFormats = async (acc: SavedVpnAccount) => {
    setVerifyingFormats(true);
    setModalError(null);
    try {
      const checks = await onVerifyAllFormats(acc);
      setModalFormatChecks(checks);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'تعذر إتمام فحص الصيغ حالياً.');
    } finally {
      setVerifyingFormats(false);
    }
  };

  const handleSaveModalPreset = async () => {
    if (!modalAccount) return;
    setSavingPreset(true);
    setPresetSavedNotice(null);
    const nextPort =
      modalProtocol === modalAccount.protocol
        ? modalAccount.port
        : protocols.find((p) => p.id === modalProtocol)?.defaultPort || modalAccount.port;
    try {
      await onSavePreset(modalAccount.id, {
        protocol: modalProtocol,
        port: nextPort,
        sni: modalSni.trim() || 'creativecommons.org',
      });
      setModalAccount({
        ...modalAccount,
        protocol: modalProtocol,
        port: nextPort,
        sni: modalSni.trim() || 'creativecommons.org',
      });
      setPresetSavedNotice('تم حفظ الصيغة الافتراضية للحساب في السحابة.');
    } finally {
      setSavingPreset(false);
    }
  };

  const activeModalBundle = modalAccount
    ? buildConfigBundle({
        ...modalAccount,
        sni: modalSni.trim() || modalAccount.sni,
        protocol: modalProtocol,
        port:
          modalProtocol === modalAccount.protocol
            ? modalAccount.port
            : protocols.find((p) => p.id === modalProtocol)?.defaultPort || modalAccount.port,
      })
    : null;

  const startEditExpiry = (acc: SavedVpnAccount) => {
    setEditingExpiryId(acc.id);
    const existingLocal = toDatetimeLocalValue(acc.expiresAt);
    setEditingExpiryValue(existingLocal || addDaysToDatetimeLocal(acc.durationDays || 3));
  };

  const handleSaveEditedExpiry = async (accId: string) => {
    const iso = datetimeLocalToIso(editingExpiryValue) || 'unverified-date';
    await onUpdateExpiresAt(accId, iso);
    setEditingExpiryId(null);
    setEditingExpiryValue('');
  };

  const handleClearEditedExpiry = async (accId: string) => {
    await onUpdateExpiresAt(accId, 'unverified-date');
    setEditingExpiryId(null);
    setEditingExpiryValue('');
  };

  const startEditName = (acc: SavedVpnAccount) => {
    setEditingNameId(acc.id);
    setEditingNameValue(acc.customName || '');
  };

  const handleSaveEditedName = async (accId: string) => {
    await onUpdateCustomName(accId, editingNameValue.trim());
    setEditingNameId(null);
    setEditingNameValue('');
  };

  return (
    <section
      id="saved-accounts"
      className="rounded-xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#09090b]"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-zinc-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
            قسم الحسابات المحفوظة ({accounts.length})
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            تسمية مخصصة لكل حساب، تلوين تدريجي للأحمر عند الاقتراب من الانتهاء، عداد الأيام المتبقية مع التعديل اليدوي، والتحقق بكل الصيغ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAuthenticated && filtered.length > 0 && (
            <button
              type="button"
              onClick={handleToggleAllAccounts}
              className="inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              {anyExpanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>طي جميع الحسابات</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>فتح جميع الحسابات</span>
                </>
              )}
            </button>
          )}

          {isAuthenticated && accounts.length > 0 && (
            <button
              type="button"
              onClick={() => void onProbeAllAccounts()}
              disabled={probingAll || Boolean(busyAccountId)}
              className="inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${probingAll ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{probingAll ? 'جارٍ التحديث...' : 'تحديث البينج والسيرفر'}</span>
            </button>
          )}

          <div className="relative">
            <Search
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم المخصص أو السيرفر..."
              className="min-h-[40px] w-52 rounded-lg border border-slate-300 bg-slate-50 pr-9 pl-3 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-black dark:text-zinc-100"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:border dark:border-zinc-800 dark:bg-black">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filterMode === 'all'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-zinc-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400'
              }`}
            >
              الكل
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('auto')}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filterMode === 'auto'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-zinc-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400'
              }`}
            >
              تجديد تلقائي
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('manual')}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filterMode === 'manual'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-zinc-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400'
              }`}
            >
              يدوي
            </button>
          </div>
        </div>
      </div>

      <AdSenseBanner key="ad-middle-saved" placement="middle" className="mt-5" />

      {!isAuthenticated ? (
        <div className="py-12 text-center">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            سجّل دخولك لحفظ وعرض حساباتك الحقيقية بشكل دائم
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            يتم حفظ الحسابات في قاعدة بيانات Firebase السحابية المرتبطة بحسابك حتى لا تُحذف بياناتك عند إعادة فتح التطبيق.
          </p>
          <button
            type="button"
            onClick={onRequireAuth}
            className="mt-4 inline-flex min-h-[40px] items-center justify-center rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            الانتقال لتسجيل الدخول
          </button>
        </div>
      ) : loading ? (
        <div className="mt-5 space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/60"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {accounts.length === 0
              ? 'لا توجد حسابات حقيقية محفوظة في هذا الحساب بعد.'
              : 'لا توجد نتائج مطابقة للبحث الحالي.'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            أنشئ حساباً عبر الموقع أو تحقق من حساب موجود من تبويب «إنشاء حساب» ليتم حفظه هنا مع البينج ودولة السيرفر وعدد المتصلين وأيام الانتهاء.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-2.5">
          {filtered.map((acc) => {
            const expiry = getExpiryCounterDetails(acc.expiresAt, nowMs);
            const urgency = getExpiryGradualUrgency(acc.expiresAt, nowMs);
            const isBusy = busyAccountId === acc.id;
            const isExpanded = Boolean(expandedAccounts[acc.id]);
            const isEditingExpiry = editingExpiryId === acc.id;
            const isEditingName = editingNameId === acc.id;
            const bundle = buildConfigBundle(acc);
            const pingVal = acc.lastPingMs;
            const serverConnectedCount = acc.connectedUsersAtCheck ?? liveConnectedUsers;
            const canRealRenew = supportsRealRenewal(acc);

            return (
              <article
                key={acc.id}
                className={`overflow-hidden rounded-xl border border-slate-200 transition-colors dark:border-zinc-800 ${
                  urgency.rowClass || 'bg-slate-50/70 dark:bg-black'
                }`}
              >
                {/* Compact Collapsed Accordion Header */}
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 p-3.5 sm:px-4 ${
                    isExpanded ? 'border-b border-slate-200/80 dark:border-zinc-800' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleAccountExpand(acc.id)}
                    aria-expanded={isExpanded}
                    className="flex min-w-0 flex-1 items-center gap-3 text-right"
                  >
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 dark:border-zinc-700 dark:bg-[#09090b] dark:text-zinc-300">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`truncate text-sm font-bold text-slate-950 dark:text-white ${
                            acc.customName ? '' : 'font-mono'
                          }`}
                          dir={acc.customName ? 'rtl' : 'ltr'}
                        >
                          {acc.customName || acc.username}
                        </span>
                        <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:border-zinc-700 dark:bg-[#09090b] dark:text-zinc-300">
                          {getProtocolLabelAr(acc.protocol)} :{acc.port}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            canRealRenew && acc.autoRenew
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-200/80 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}
                        >
                          {canRealRenew
                            ? acc.autoRenew
                              ? 'تجديد تلقائي'
                              : 'يدوي'
                            : 'بدون تجديد'}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500 dark:text-zinc-400">
                        <span className="font-semibold text-slate-700 dark:text-zinc-300">
                          {acc.serverName || acc.serverCode}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{acc.serverCountryAr || 'ألمانيا'}</span>
                        <span aria-hidden="true">·</span>
                        <span dir="ltr" className="truncate font-mono">
                          {acc.host}
                        </span>
                        {acc.serverIp && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span dir="ltr" className="font-mono text-emerald-700 dark:text-emerald-400">
                              IP: {acc.serverIp}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Right Summary Badges & Quick Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md border px-2 py-1 text-[11px] font-semibold tabular-nums ${urgency.badgeClass}`}
                    >
                      {expiry.hasDate ? expiry.daysRemainingText : 'المدة غير محددة'}
                    </span>

                    <span
                      className={`rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] font-bold tabular-nums dark:border-zinc-800 dark:bg-[#09090b] ${
                        pingVal === null
                          ? 'text-slate-500'
                          : pingVal <= 45
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : pingVal <= 110
                          ? 'text-sky-600 dark:text-sky-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {pingVal !== null ? `${pingVal} ms` : '-- ms'}
                    </span>

                    <button
                      type="button"
                      onClick={() => void handleCopy(acc.id, bundle.primaryUri)}
                      title="نسخ الرابط السريع"
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-[#09090b] dark:text-zinc-200 dark:hover:bg-zinc-900"
                    >
                      {copiedId === acc.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>{copiedId === acc.id ? 'نُسخ' : 'نسخ'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleAccountExpand(acc.id)}
                      className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                        isExpanded
                          ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                          : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-zinc-700 dark:bg-[#09090b] dark:text-zinc-100 dark:hover:bg-zinc-900'
                      }`}
                    >
                      <span>{isExpanded ? 'طي' : 'التفاصيل'}</span>
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Body */}
                {isExpanded && (
                  <div className="flex flex-col gap-3.5 p-4">
                    {/* Sub-header: Inline Name Edit + Auto-Renew Switch */}
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 pb-3 dark:border-zinc-800">
                      <div className="min-w-0 flex-1">
                        {isEditingName ? (
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              maxLength={80}
                              value={editingNameValue}
                              onChange={(e) => setEditingNameValue(e.target.value)}
                              aria-label="الاسم المخصص للحساب"
                              placeholder="اكتب اسماً مخصصاً..."
                              className="w-full rounded-md border border-emerald-500 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none dark:bg-[#09090b] dark:text-white"
                            />
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleSaveEditedName(acc.id)}
                                className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500"
                              >
                                <Check className="h-3 w-3" aria-hidden="true" />
                                <span>حفظ</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingNameId(null)}
                                className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                              >
                                <X className="h-3 w-3" aria-hidden="true" />
                                <span>إلغاء</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className="break-all font-mono text-xs font-semibold text-slate-800 dark:text-zinc-200"
                                dir="ltr"
                              >
                                User: {acc.username}
                              </span>
                              <span
                                className="break-all font-mono text-xs text-slate-600 dark:text-zinc-400"
                                dir="ltr"
                              >
                                Pass: {acc.password}
                              </span>
                              <button
                                type="button"
                                onClick={() => startEditName(acc)}
                                disabled={isBusy}
                                title="تخصيص أو تعديل اسم الحساب"
                                className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:border-emerald-500 hover:text-emerald-600 dark:border-zinc-700 dark:bg-[#09090b] dark:text-zinc-300 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
                              >
                                <Pencil className="h-2.5 w-2.5" aria-hidden="true" />
                                <span>{acc.customName ? 'تعديل الاسم' : 'تسمية مخصصة'}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Auto-Renew Toggle */}
                      <div
                        title={
                          canRealRenew
                            ? 'تفعيل أو إيقاف التجديد التلقائي الحقيقي عبر ssh-tunnel.net'
                            : 'التجديد التلقائي غير متاح من هذا المصدر'
                        }
                        className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-zinc-800 dark:bg-[#09090b]"
                      >
                        <button
                          type="button"
                          role="switch"
                          aria-checked={acc.autoRenew}
                          disabled={isBusy || (!canRealRenew && !acc.autoRenew)}
                          onClick={() => void onToggleAutoRenew(acc.id, canRealRenew ? !acc.autoRenew : false)}
                          className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors ${
                            !canRealRenew && !acc.autoRenew ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                          } ${
                            acc.autoRenew
                              ? 'bg-emerald-600'
                              : 'bg-slate-300 dark:bg-zinc-700'
                          }`}
                        >
                          <span className="sr-only">تفعيل التجديد التلقائي</span>
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              acc.autoRenew ? '-translate-x-5.5' : '-translate-x-1'
                            }`}
                          />
                        </button>
                        <div className="text-[11px] leading-tight">
                          <span className="block font-semibold text-slate-800 dark:text-zinc-200">
                            {canRealRenew
                              ? acc.autoRenew
                                ? 'تجديد تلقائي'
                                : 'يدوي'
                              : acc.autoRenew
                              ? 'إيقاف التلقائي'
                              : 'غير مدعوم'}
                          </span>
                          {acc.renewCount > 0 && (
                            <span className="block font-mono text-[10px] text-slate-500 tabular-nums dark:text-zinc-400">
                              جُدّد {acc.renewCount}×
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Responsive Info Grid: Server Name + Host + Real IP + Ping + Users */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-[#09090b]">
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-zinc-400">
                          <Globe className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                          <span className="truncate">اسم السيرفر والدولة</span>
                        </div>
                        <div className="mt-1 truncate text-xs font-semibold text-slate-900 dark:text-zinc-100">
                          {acc.serverName || acc.serverCode}
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-zinc-400">
                          {acc.serverCountryAr || 'غير محدد'} · {acc.serverCode}
                        </div>
                      </div>

                      <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-[#09090b]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400">
                            الهوست وعنوان IP الحقيقي
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handleCopy(`${acc.id}-host`, acc.host)}
                              title="نسخ الهوست"
                              className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                            >
                              {copiedId === `${acc.id}-host` ? '✓ Host' : 'Host'}
                            </button>
                            {acc.serverIp && (
                              <button
                                type="button"
                                onClick={() => void handleCopy(`${acc.id}-ip`, acc.serverIp || '')}
                                title="نسخ IP"
                                className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-50 dark:border-zinc-700 dark:text-emerald-300 dark:hover:bg-zinc-900"
                              >
                                {copiedId === `${acc.id}-ip` ? '✓ IP' : 'IP'}
                              </button>
                            )}
                          </div>
                        </div>
                        <div
                          className="mt-1 break-all font-mono text-[11px] font-semibold text-slate-900 dark:text-zinc-100"
                          dir="ltr"
                        >
                          {acc.host}
                        </div>
                        <div
                          className="mt-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"
                          dir="ltr"
                        >
                          IP: {acc.serverIp || 'غير متاح'}
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-[#09090b]">
                        <div>
                          <span className="block text-[10px] font-medium text-slate-500 dark:text-zinc-400">
                            البينج الحي
                          </span>
                          <span
                            className={`mt-0.5 block font-mono text-xs font-bold tabular-nums ${
                              pingVal === null
                                ? 'text-slate-500'
                                : pingVal <= 45
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : pingVal <= 110
                                ? 'text-sky-600 dark:text-sky-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {pingVal !== null ? `${pingVal} ms` : '--'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void onPingAccount(acc.id)}
                          disabled={isBusy}
                          title="تحديث البينج ومتصلي السيرفر"
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-zinc-800 dark:text-slate-400 dark:hover:bg-zinc-900 dark:hover:text-white"
                        >
                          <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-[#09090b]">
                        <span className="block text-[10px] font-medium text-slate-500 dark:text-zinc-400">
                          متصلو السيرفر
                        </span>
                        <div className="mt-0.5 flex items-center gap-1.5 font-mono text-xs font-bold text-slate-800 tabular-nums dark:text-zinc-200">
                          <Server className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                          <span>{serverConnectedCount} متصل</span>
                        </div>
                      </div>
                    </div>

                    {/* Expiration Date & Gradual Red Countdown */}
                    {isEditingExpiry ? (
                      <div className="space-y-2 rounded-lg border border-emerald-500/50 bg-white p-3 dark:bg-[#09090b]">
                        <input
                          type="datetime-local"
                          dir="ltr"
                          value={editingExpiryValue}
                          onChange={(e) => setEditingExpiryValue(e.target.value)}
                          aria-label="تعديل تاريخ الانتهاء"
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-slate-100"
                        />
                        <div className="flex flex-wrap items-center gap-1.5">
                          {[1, 3, 7, 14, 30].map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setEditingExpiryValue(addDaysToDatetimeLocal(d))}
                              className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:border-emerald-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-200"
                            >
                              +{d}ي
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleSaveEditedExpiry(acc.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            <Check className="h-3 w-3" aria-hidden="true" />
                            <span>حفظ</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleClearEditedExpiry(acc.id)}
                            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-zinc-700 dark:bg-black dark:text-zinc-300"
                          >
                            مسح
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingExpiryId(null)}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-black dark:text-rose-300"
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                            <span>إلغاء</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-[#09090b]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                            <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                              الانتهاء: {expiry.hasDate ? formatArabicExpiryDate(acc.expiresAt) : 'غير محدد'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => startEditExpiry(acc)}
                            disabled={isBusy}
                            title="تعديل تاريخ الانتهاء يدوياً"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:border-emerald-500 hover:text-emerald-700 dark:border-zinc-700 dark:bg-black dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:text-emerald-300"
                          >
                            <Pencil className="h-2.5 w-2.5" aria-hidden="true" />
                            <span>{expiry.hasDate ? 'تعديل المدة' : 'تحديد'}</span>
                          </button>
                        </div>

                        <div
                          className={`flex flex-col gap-1 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold tabular-nums transition-colors ${urgency.badgeClass}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                              <span>
                                {expiry.hasDate
                                  ? `العداد: ${expiry.daysRemainingText}`
                                  : 'العداد: غير محدد'}
                              </span>
                            </span>
                            {expiry.hasDate && (
                              <span className="font-mono" dir="ltr">
                                {expiry.countdownLabel}
                              </span>
                            )}
                          </div>
                          {expiry.hasDate && urgency.level > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold">
                                {urgency.stageLabel}
                              </span>
                              <span className="h-1 flex-1 overflow-hidden rounded-full bg-black/30">
                                <span className={`block h-full rounded-full ${urgency.barClass}`} />
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Responsive Action Buttons Bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openFormatsModal(acc, true)}
                        disabled={isBusy}
                        title="تحقق من الحساب بكل الصيغ التسع"
                        className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                      >
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>تحقق بكل الصيغ</span>
                      </button>

                      {canRealRenew && (
                        <button
                          type="button"
                          onClick={() => void onRenewNow(acc.id)}
                          disabled={isBusy}
                          title="تجديد الحساب الآن عبر ssh-tunnel.net"
                          className="inline-flex min-h-[36px] items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isBusy ? 'animate-spin' : ''}`} aria-hidden="true" />
                          <span>تجديد</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleCopy(acc.id, bundle.primaryUri)}
                        title="نسخ الرابط السريع"
                        className="inline-flex min-h-[36px] items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                      >
                        {copiedId === acc.id ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        )}
                        <span>{copiedId === acc.id ? 'نُسخ' : 'نسخ'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openFormatsModal(acc, false)}
                        className="inline-flex min-h-[36px] items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-black dark:hover:bg-white"
                      >
                        <FileCode2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>كل الصيغ</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void onDeleteAccount(acc.id)}
                        disabled={isBusy}
                        title="حذف الحساب"
                        className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {modalAccount && activeModalBundle && (
        <div
          onClick={closeFormatsModal}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="تصدير والتحقق من الحساب بجميع الصيغ"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-[#09090b]"
          >
            {/* Sticky Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-zinc-800 sm:px-6">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-slate-950 dark:text-white">
                  تصدير والتحقق بكل الصيغ:{' '}
                  <span>{modalAccount.customName || modalAccount.username}</span>
                </h3>
                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                  {modalAccount.serverName || modalAccount.serverCode} · {modalAccount.serverCountryAr || 'ألمانيا'} ·{' '}
                  <span className="font-mono">{modalAccount.host}</span>
                  {modalAccount.serverIp ? (
                    <>
                      {' · '}
                      <span className="font-mono text-emerald-700 dark:text-emerald-400">
                        IP: {modalAccount.serverIp}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={closeFormatsModal}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">إغلاق</span>
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  فحص جاهزية الخادم والحساب عبر البروتوكولات التسعة:
                </span>
                <button
                  type="button"
                  disabled={verifyingFormats}
                  onClick={() => void runVerifyModalFormats(modalAccount)}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-emerald-600 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                >
                  <ShieldCheck className={`h-3.5 w-3.5 ${verifyingFormats ? 'animate-pulse' : ''}`} aria-hidden="true" />
                  <span>{verifyingFormats ? 'جارٍ الفحص الفوري...' : 'إعادة فحص جميع الصيغ الآن'}</span>
                </button>
              </div>

              {modalError && (
                <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
                  {modalError}
                </div>
              )}

              {modalFormatChecks.length > 0 && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {modalFormatChecks.map((chk) => {
                    const selected = modalProtocol === chk.protocol;
                    return (
                      <button
                        key={chk.protocol}
                        type="button"
                        onClick={() => setModalProtocol(chk.protocol)}
                        className={`rounded-lg border p-2.5 text-right transition-colors ${
                          selected
                            ? 'border-emerald-600 bg-emerald-50/70 dark:border-emerald-500 dark:bg-emerald-950/40'
                            : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-zinc-800 dark:bg-black'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">
                            {chk.nameEn} (:{chk.port})
                          </span>
                          {chk.status === 'verified' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                          ) : chk.reachable ? (
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" aria-hidden="true" />
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                          {chk.detailAr}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="modal-proto" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    الصيغة المختارة للتصدير والحفظ:
                  </label>
                  <select
                    id="modal-proto"
                    value={modalProtocol}
                    onChange={(e) => setModalProtocol(e.target.value as ProtocolFormatId)}
                    className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-900 dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                  >
                    {protocols.map((p) => (
                      <option key={p.id} value={p.id}>
                        {getProtocolLabelAr(p.id)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="modal-sni" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    SNI / Bug Host:
                  </label>
                  <input
                    id="modal-sni"
                    type="text"
                    dir="ltr"
                    value={modalSni}
                    onChange={(e) => setModalSni(e.target.value)}
                    className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                  />
                </div>
              </div>

              <pre
                dir="ltr"
                className="mt-4 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-black p-4 text-left font-mono text-xs leading-relaxed text-emerald-300 dark:border-zinc-800"
              >
                {activeModalBundle.payloadText}
              </pre>

              <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
                {activeModalBundle.connectionGuideAr}
              </p>

              {presetSavedNotice && (
                <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {presetSavedNotice}
                </p>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3.5 dark:border-zinc-800 dark:bg-black sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={closeFormatsModal}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900/70 dark:bg-[#09090b] dark:text-rose-300 dark:hover:bg-rose-950/40"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>إلغاء</span>
                </button>

                <button
                  type="button"
                  disabled={savingPreset}
                  onClick={() => void handleSaveModalPreset()}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-[#09090b] dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{savingPreset ? 'جارٍ الحفظ...' : 'حفظ هذه الصيغة كافتراضية'}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy('modal-payload', activeModalBundle.payloadText)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  {copiedId === 'modal-payload' ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{copiedId === 'modal-payload' ? 'تم النسخ' : 'نسخ الإعدادات'}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleDownload(
                      `${modalAccount.username}-${modalProtocol}.${activeModalBundle.extension}`,
                      activeModalBundle.payloadText,
                    )
                  }
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-[#09090b] dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>تحميل الملف</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

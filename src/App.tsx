import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { AccountCreator } from './components/AccountCreator.tsx';
import { AdSenseBanner } from './components/AdSenseBanner.tsx';
import { AuthGatePanel } from './components/AuthGatePanel.tsx';
import { InAppWebViewModal } from './components/InAppWebViewModal.tsx';
import { NetworkToolsPanel } from './components/NetworkToolsPanel.tsx';
import { OwnerChatPanel } from './components/OwnerChatPanel.tsx';
import { OfflineIndicator } from './components/PWAInstallControls.tsx';
import { ReadyConfigsPanel } from './components/ReadyConfigsPanel.tsx';
import { SavedAccountsVault } from './components/SavedAccountsVault.tsx';
import { TopBar, type WorkspaceTab } from './components/TopBar.tsx';
import { TrafficAndPortsPanel } from './components/TrafficAndPortsPanel.tsx';
import { TunnelRunnerPanel } from './components/TunnelRunnerPanel.tsx';
import {
  InAppBrowserProvider,
  useHardwareBackRoot,
  useInAppBrowser,
} from './context/InAppBrowserContext.tsx';
import {
  auth,
  createReadyConfigInFirestore,
  createUserWithEmailAndPassword,
  deleteReadyConfigFromFirestore,
  deleteVpnAccountFromFirestore,
  ensureUserProfile,
  fetchReadyConfigsFromServer,
  isTransientFirestoreNetworkError,
  onAuthStateChanged,
  reload,
  resolveReadyConfigContent,
  saveDiscoveredProviderToFirestore,
  saveVerifiedVpnAccountToFirestore,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  subscribeReadyConfigs,
  subscribeUserAccounts,
  subscribeUserDiscoveredProviders,
  updateProfile,
  updateVpnAccountAutoRenew,
  updateVpnAccountConnectionPreset,
  updateVpnAccountCustomName,
  updateVpnAccountExpiresAt,
  updateVpnAccountProbeMetrics,
  updateVpnAccountRenewed,
  type User,
} from './firebase.ts';
import type {
  AccountProbeResult,
  AuthUser,
  CreateAccountPayload,
  DiscoverProvidersResponse,
  FormatCheckResult,
  PingProbeResponse,
  ProtocolFormatId,
  ReadyConfigItem,
  ReadyConfigProtocolId,
  SavedVpnAccount,
  ServerDetailResponse,
  VerifyAccountPayload,
  VerifyAccountResponse,
  VpnProviderSummary,
} from './types.ts';

const PINNED_PROVIDERS_STORAGE_KEY = 'vpn_fastore_pinned_providers_v1';

function isRealRenewalSupported(acc: SavedVpnAccount): boolean {
  return (
    (acc.serverPageUrl || '').includes('ssh-tunnel.net') ||
    (acc.host || '').toLowerCase().endsWith('.stunnel.cc')
  );
}

function dedupeProviderServersClient(
  servers: VpnProviderSummary['servers'],
  globalSeen = new Set<string>(),
): VpnProviderSummary['servers'] {
  const localSeen = new Set<string>();
  return servers.map((srv) => {
    const baseId = srv.serverId || `${srv.providerId}_${srv.code || 'srv'}`;
    let uniqueId = baseId;
    if (localSeen.has(uniqueId) || globalSeen.has(uniqueId)) {
      const hostTag = (srv.host || '').split('.').slice(1).join('_').replace(/[^a-z0-9]/gi, '_');
      uniqueId = hostTag ? `${baseId}_${hostTag}` : `${baseId}_2`;
    }
    let counter = 2;
    while (localSeen.has(uniqueId) || globalSeen.has(uniqueId)) {
      uniqueId = `${baseId}_${counter++}`;
    }
    localSeen.add(uniqueId);
    globalSeen.add(uniqueId);
    return uniqueId === srv.serverId ? srv : { ...srv, serverId: uniqueId };
  });
}

function normalizeServerDataUniqueIds(data: ServerDetailResponse): ServerDetailResponse {
  const globalSeen = new Set<string>();
  const providers = (data.providers || []).map((prov) => ({
    ...prov,
    servers: dedupeProviderServersClient(prov.servers || [], globalSeen),
  }));
  const allServers = providers.flatMap((p) => p.servers);
  const effectiveAllServers =
    allServers.length > 0 ? allServers : dedupeProviderServersClient(data.allServers || []);
  const matchedActiveServer =
    effectiveAllServers.find(
      (s) =>
        s.providerId === data.server.providerId &&
        s.host === data.server.host &&
        s.code === data.server.code,
    ) ??
    effectiveAllServers.find((s) => s.serverId === data.server.serverId) ??
    data.server;
  const resolveNormalizedId = (providerId: string, host: string, code: string, fallbackId: string) => {
    const match =
      effectiveAllServers.find(
        (s) => s.providerId === providerId && s.host === host && s.code === code,
      ) ?? effectiveAllServers.find((s) => s.serverId === fallbackId);
    return match ? match.serverId : fallbackId;
  };
  const strongestServer = data.strongestServer
    ? {
        ...data.strongestServer,
        serverId: resolveNormalizedId(
          data.strongestServer.providerId,
          data.strongestServer.host,
          data.strongestServer.code,
          data.strongestServer.serverId,
        ),
        topCandidates: (data.strongestServer.topCandidates || []).map((c) => ({
          ...c,
          serverId: resolveNormalizedId(c.providerId, c.host, c.code, c.serverId),
        })),
      }
    : undefined;
  const discoveredProviders = Array.isArray(data.discoveredProviders)
    ? data.discoveredProviders.map((prov) => ({
        ...prov,
        servers: dedupeProviderServersClient(prov.servers || []),
      }))
    : data.discoveredProviders;
  return {
    ...data,
    server: matchedActiveServer,
    providers,
    allServers: effectiveAllServers,
    discoveredProviders,
    strongestServer,
  };
}

function mergeProviderLists(
  ...lists: (VpnProviderSummary[] | undefined)[]
): VpnProviderSummary[] {
  const byId = new Map<string, VpnProviderSummary>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item.providerId !== 'string' || !item.providerId.trim()) continue;
      if (!Array.isArray(item.servers) || item.servers.length === 0) continue;
      const existing = byId.get(item.providerId);
      if (!existing || item.servers.length >= existing.servers.length) {
        byId.set(item.providerId, {
          ...item,
          servers: dedupeProviderServersClient(item.servers),
        });
      }
    }
  }
  return Array.from(byId.values());
}

function loadLocalPinnedProviders(): VpnProviderSummary[] {
  try {
    const raw = localStorage.getItem(PINNED_PROVIDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return mergeProviderLists(parsed as VpnProviderSummary[]);
  } catch {
    return [];
  }
}

function saveLocalPinnedProviders(providers: VpnProviderSummary[]): void {
  try {
    const cleaned = mergeProviderLists(providers);
    localStorage.setItem(PINNED_PROVIDERS_STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // ignore storage quota/privacy restrictions
  }
}

function mapFirebaseAuthErrorAr(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  const rawMessage = err instanceof Error ? err.message : String(err ?? '');

  if (
    code === 'auth/missing-or-invalid-nonce' ||
    code === 'auth/web-storage-unsupported' ||
    /sessionstorage|missing initial state/i.test(rawMessage)
  ) {
    return 'تعذر الوصول إلى sessionStorage داخل WebView لتسجيل الدخول بحساب Google. تأكد من تفعيل domStorageEnabled و setSupportMultipleWindows في إعدادات WebView بتطبيق Android، أو استخدم تسجيل الدخول بالبريد الإلكتروني وكلمة السر.';
  }

  switch (code) {
    case 'auth/operation-not-allowed':
      return 'تسجيل الدخول بالبريد وكلمة السر غير مفعّل حالياً في Firebase Console (Authentication > Sign-in method > Email/Password). يرجى تفعيله من لوحة التحكم.';
    case 'auth/email-already-in-use':
      return 'هذا البريد الإلكتروني مسجل بالفعل، يمكنك تسجيل الدخول مباشرة.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    case 'auth/weak-password':
      return 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.';
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return 'صيغة البريد الإلكتروني غير صحيحة.';
    case 'auth/user-disabled':
      return 'تم تعطيل هذا الحساب من قبل المسؤول.';
    case 'auth/popup-blocked':
      return 'تم حظر نافذة تسجيل الدخول المنبثقة من المتصفح. افتح التطبيق في نافذة مستقلة أو اسمح بالنوافذ المنبثقة داخل WebView ثم حاول مجدداً.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.';
    case 'auth/unauthorized-domain':
      return 'هذا النطاق غير مضاف في قائمة النطاقات المصرح بها (Authorized domains) في إعدادات Firebase Authentication.';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بخوادم المصادقة، يرجى التأكد من اتصال الإنترنت والمحاولة مجدداً.';
    case 'auth/too-many-requests':
      return 'تم تنفيذ محاولات كثيرة متتالية، يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.';
    default:
      return rawMessage || 'حدث خطأ أثناء المصادقة.';
  }
}

function toAuthUser(fbUser: User): AuthUser {
  return {
    uid: fbUser.uid,
    email: fbUser.email || '',
    displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
    emailVerified: fbUser.emailVerified,
    providerId: fbUser.providerData[0]?.providerId || 'password',
  };
}

function AppShell() {
  const { syncAppRouteTab } = useInAppBrowser();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('auth');
  const [selectedServerId, setSelectedServerId] = useState<string>('15');
  const [sniHost, setSniHost] = useState<string>('creativecommons.org');
  const [serverData, setServerData] = useState<ServerDetailResponse | null>(null);
  const [pingData, setPingData] = useState<PingProbeResponse | null>(null);
  const [accounts, setAccounts] = useState<SavedVpnAccount[]>([]);
  const [readyConfigs, setReadyConfigs] = useState<ReadyConfigItem[]>([]);
  const [readyConfigsLoading, setReadyConfigsLoading] = useState<boolean>(true);
  const [readyConfigsRefreshing, setReadyConfigsRefreshing] = useState<boolean>(false);
  const [readyConfigsError, setReadyConfigsError] = useState<string | null>(null);

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const [serverLoading, setServerLoading] = useState<boolean>(true);
  const [pingLoading, setPingLoading] = useState<boolean>(false);
  const [accountsLoading, setAccountsLoading] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [probingAll, setProbingAll] = useState<boolean>(false);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [discoveringMode, setDiscoveringMode] = useState<'servers' | 'autorenew' | null>(null);
  const [discoveryResults, setDiscoveryResults] = useState<{
    servers: DiscoverProvidersResponse | null;
    autorenew: DiscoverProvidersResponse | null;
  }>({
    servers: null,
    autorenew: null,
  });
  const discoveryTimersRef = useRef<{
    servers: number | null;
    autorenew: number | null;
  }>({
    servers: null,
    autorenew: null,
  });
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [refreshBanner, setRefreshBanner] = useState<string | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const serverDataRef = useRef<ServerDetailResponse | null>(null);
  const selectedServerIdRef = useRef<string>(selectedServerId);
  const didInitialAutoBestRef = useRef<boolean>(false);
  const skipNextServerEffectRef = useRef<string | null>(null);
  const prevAuthUidRef = useRef<string | null>(null);
  const [firestoreFatalError, setFirestoreFatalError] = useState<Error | null>(null);

  useEffect(() => {
    serverDataRef.current = serverData;
  }, [serverData]);

  useEffect(() => {
    selectedServerIdRef.current = selectedServerId;
  }, [selectedServerId]);

  const [sessionCookie, setSessionCookie] = useState<string>(() => {
    try {
      return localStorage.getItem('sshtunnel_session_cookie') || '';
    } catch {
      return '';
    }
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('theme_mode');
      return saved ? saved === 'dark' : true;
    } catch {
      return true;
    }
  });

  if (firestoreFatalError) {
    throw firestoreFatalError;
  }

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('theme_mode', isDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [isDark]);

  const handleSessionCookieChange = (cookie: string) => {
    setSessionCookie(cookie);
    try {
      localStorage.setItem('sshtunnel_session_cookie', cookie);
    } catch {
      // ignore
    }
  };

  // Persistent Firebase Authentication listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      const prevUid = prevAuthUidRef.current;
      const nextUid = fbUser?.uid ?? null;
      prevAuthUidRef.current = nextUid;

      setFirebaseUser(fbUser);
      setUser(fbUser ? toAuthUser(fbUser) : null);
      setAuthLoading(false);

      if (fbUser) {
        if (!prevUid) {
          setActiveTab('overview');
          syncAppRouteTab('overview');
        }
        void ensureUserProfile(fbUser).catch((err) => {
          if (isTransientFirestoreNetworkError(err)) {
            setErrorBanner(
              'تعذر الوصول إلى خادم قاعدة البيانات السحابي مؤقتاً — سيعيد التطبيق المزامنة تلقائياً عند استقرار الاتصال.',
            );
            return;
          }
          setFirestoreFatalError(err instanceof Error ? err : new Error(String(err)));
        });
      } else {
        setActiveTab('auth');
        syncAppRouteTab('auth');
        setAccounts([]);
        setAccountsLoading(false);
        setReadyConfigs([]);
        setReadyConfigsLoading(false);
        setServerData(null);
        setPingData(null);
        didInitialAutoBestRef.current = false;
      }
    });
    return () => {
      unsubscribe();
    };
  }, [syncAppRouteTab]);

  // Real-time Cloud Firestore subscription scoped to authenticated UID owner
  useEffect(() => {
    if (!firebaseUser) {
      setAccounts([]);
      setAccountsLoading(false);
      return;
    }

    setAccountsLoading(true);
    const unsubscribe = subscribeUserAccounts(
      firebaseUser.uid,
      (list) => {
        setAccounts(list);
        setAccountsLoading(false);
      },
      (err) => {
        setAccountsLoading(false);
        if (isTransientFirestoreNetworkError(err)) {
          setErrorBanner(
            'تعذر الوصول إلى خادم قاعدة البيانات السحابي مؤقتاً — سيتم استئناف المزامنة عند عودة الاتصال.',
          );
          return;
        }
        setFirestoreFatalError(err);
      },
    );

    return () => unsubscribe();
  }, [firebaseUser]);

  // Subscription to Ready Configs (only active once user signs in)
  useEffect(() => {
    if (!firebaseUser) {
      setReadyConfigs([]);
      setReadyConfigsLoading(false);
      setReadyConfigsError(null);
      return;
    }

    setReadyConfigsLoading(true);
    const unsubscribe = subscribeReadyConfigs(
      (list) => {
        setReadyConfigs(list);
        setReadyConfigsError(null);
        setReadyConfigsLoading(false);
      },
      (err) => {
        setReadyConfigsLoading(false);
        if (isTransientFirestoreNetworkError(err)) {
          setReadyConfigsError('تعذر الاتصال بقاعدة البيانات مؤقتاً لعرض الكونفجات الجاهزة.');
          return;
        }
        setReadyConfigsError(err.message);
      },
    );

    return () => unsubscribe();
  }, [firebaseUser]);

  // Cloud Firestore subscription for user's pinned/discovered VPN providers
  useEffect(() => {
    if (!firebaseUser) return;

    const unsubscribe = subscribeUserDiscoveredProviders(
      firebaseUser.uid,
      (cloudProviders) => {
        if (cloudProviders.length === 0) return;
        const localPinned = loadLocalPinnedProviders();
        const mergedPinned = mergeProviderLists(localPinned, cloudProviders);
        saveLocalPinnedProviders(mergedPinned);

        const loadedIds = new Set(
          (serverDataRef.current?.providers || []).map((p) => p.providerId),
        );
        const needsServerSync = mergedPinned.some((p) => !loadedIds.has(p.providerId));
        if (!needsServerSync) return;

        void fetch('/api/providers/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverId: selectedServerIdRef.current,
            providers: mergedPinned,
          }),
        })
          .then(async (res) => {
            if (!res.ok) return;
            const syncJson = (await res.json()) as {
              discoveredProviders?: VpnProviderSummary[];
              serverData?: ServerDetailResponse;
            };
            if (syncJson.discoveredProviders) {
              saveLocalPinnedProviders(
                mergeProviderLists(mergedPinned, syncJson.discoveredProviders),
              );
            }
            if (syncJson.serverData) {
              setServerData(normalizeServerDataUniqueIds(syncJson.serverData));
            }
          })
          .catch(() => {
            // keep local pinned list even if sync fails transiently
          });
      },
      (err) => {
        if (isTransientFirestoreNetworkError(err)) return;
        console.warn('Could not subscribe to pinned providers:', err);
      },
    );

    return () => unsubscribe();
  }, [firebaseUser]);

  const showRefreshBanner = useCallback((message: string) => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    setRefreshBanner(message);
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      setRefreshBanner(null);
    }, 10_000);
  }, []);

  const runPing = useCallback(
    async (hostToProbe?: string, notifyOnComplete = false) => {
      const targetHost = hostToProbe || serverData?.server.host || 'de-2.stunnel.cc';
      setPingLoading(true);
      try {
        const res = await fetch(`/api/ping?host=${encodeURIComponent(targetHost)}`);
        if (res.ok) {
          const json = (await res.json()) as PingProbeResponse;
          setPingData(json);
          if (notifyOnComplete) {
            showRefreshBanner(
              json.bestLatencyMs !== null
                ? `نتيجة فحص البينج للخادم ${json.host}: ${json.bestLatencyMs} ms (المتوسط ${json.avgLatencyMs ?? json.bestLatencyMs} ms · فقد ${json.packetLossPercent}%).`
                : `تم فحص الخادم ${json.host}: تعذر الوصول إلى المنافذ المختبرة حالياً.`,
            );
          }
        }
      } catch {
        // keep previous ping data on transient error
      } finally {
        setPingLoading(false);
      }
    },
    [serverData?.server.host, showRefreshBanner],
  );

  const loadServerData = useCallback(
    async (serverId: string, forceRefresh = false, autoBest = false) => {
      setServerLoading(true);
      setErrorBanner(null);
      try {
        const localPinned = loadLocalPinnedProviders();

        // Ensure client-pinned sites exist on backend before full live refresh
        if (forceRefresh && localPinned.length > 0) {
          await fetch('/api/providers/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serverId, providers: localPinned }),
          }).catch(() => null);
        }

        const params = new URLSearchParams({ serverId });
        if (forceRefresh) params.set('refresh', '1');
        if (autoBest) params.set('autoBest', '1');
        const url = `/api/server?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error('تعذر جلب بيانات الخوادم والمواقع الحية');
        }
        let json = (await res.json()) as ServerDetailResponse;

        // If server restarted and lost local/cloud pinned sites, restore them immediately
        if (localPinned.length > 0) {
          const loadedProviderIds = new Set((json.providers || []).map((p) => p.providerId));
          const missingOnServer = localPinned.filter((p) => !loadedProviderIds.has(p.providerId));
          if (missingOnServer.length > 0) {
            const syncRes = await fetch('/api/providers/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                serverId: json.server.serverId || serverId,
                providers: localPinned,
              }),
            }).catch(() => null);
            if (syncRes && syncRes.ok) {
              const syncJson = (await syncRes.json()) as {
                serverData?: ServerDetailResponse;
                discoveredProviders?: VpnProviderSummary[];
              };
              if (syncJson.serverData) {
                json = syncJson.serverData;
              }
            }
          }
        }

        const normalized = normalizeServerDataUniqueIds(json);
        if (Array.isArray(normalized.discoveredProviders)) {
          saveLocalPinnedProviders(mergeProviderLists(localPinned, normalized.discoveredProviders));
        }

        setServerData(normalized);
        if (autoBest && normalized.server.serverId && normalized.server.serverId !== selectedServerIdRef.current) {
          skipNextServerEffectRef.current = normalized.server.serverId;
          setSelectedServerId(normalized.server.serverId);
        }
        void runPing(normalized.server.host);

        if (forceRefresh) {
          const latencyInfo =
            normalized.strongestServer &&
            normalized.strongestServer.serverId === normalized.server.serverId &&
            normalized.strongestServer.latencyMs > 0
              ? ` · ${normalized.strongestServer.latencyMs}ms`
              : '';
          showRefreshBanner(
            autoBest
              ? `تم التنشيط واختيار أقوى موقع وسيرفر الآن: ${normalized.server.providerName ?? ''} (${normalized.server.code}${latencyInfo}) من أصل ${normalized.providers.length} موقع و ${normalized.allServers.length} سيرفر.`
              : `تم تحديث كل المواقع (${normalized.providers.length} موقع) و (${normalized.allServers.length} سيرفر) بالبيانات الحية بنجاح.`,
          );
        }
      } catch (err) {
        setErrorBanner(err instanceof Error ? err.message : 'حدث خطأ أثناء الاتصال بالخادم');
      } finally {
        setServerLoading(false);
      }
    },
    [runPing, showRefreshBanner],
  );

  useEffect(() => {
    if (!firebaseUser) {
      setServerLoading(false);
      return;
    }
    if (!didInitialAutoBestRef.current) {
      didInitialAutoBestRef.current = true;
      void loadServerData(selectedServerId, false, true);
      return;
    }
    if (skipNextServerEffectRef.current === selectedServerId) {
      skipNextServerEffectRef.current = null;
      return;
    }
    void loadServerData(selectedServerId);
  }, [firebaseUser, selectedServerId, loadServerData]);

  const handleLogin = async (email: string, password: string, username?: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const cleanName = username?.trim().slice(0, 80) || '';
      if (cleanName && cleanName !== (cred.user.displayName || '').trim()) {
        await updateProfile(cred.user, { displayName: cleanName }).catch(() => null);
      }
      await ensureUserProfile(cred.user, cleanName || undefined).catch(() => null);
      setFirebaseUser(cred.user);
      setUser(toAuthUser(cred.user));
    } catch (err) {
      throw new Error(mapFirebaseAuthErrorAr(err));
    }
  };

  const handleRegister = async (email: string, password: string, username?: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const cleanName = username?.trim().slice(0, 80) || '';
      if (cleanName) {
        await updateProfile(cred.user, { displayName: cleanName }).catch(() => null);
      }
      await ensureUserProfile(cred.user, cleanName || undefined);
      setFirebaseUser(cred.user);
      setUser(toAuthUser(cred.user));
      if (!cred.user.emailVerified) {
        void sendEmailVerification(cred.user).catch(() => {
          // Optional verification email should never block immediate sign-up
        });
      }
    } catch (err) {
      throw new Error(mapFirebaseAuthErrorAr(err));
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      throw new Error(mapFirebaseAuthErrorAr(err));
    }
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err) {
      throw new Error(mapFirebaseAuthErrorAr(err));
    }
  };

  const handleRefreshVerification = async () => {
    if (!auth.currentUser) return;
    try {
      await reload(auth.currentUser);
      const refreshed = auth.currentUser;
      setFirebaseUser(refreshed);
      setUser(refreshed ? toAuthUser(refreshed) : null);
      if (refreshed && refreshed.emailVerified) {
        await ensureUserProfile(refreshed);
      }
    } catch (err) {
      throw new Error(mapFirebaseAuthErrorAr(err));
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setFirebaseUser(null);
    setActiveTab('auth');
    syncAppRouteTab('auth');
  };

  const handleNavigateTab = (tab: WorkspaceTab, anchorId?: string) => {
    if (!firebaseUser && tab !== 'auth') {
      setActiveTab('auth');
      syncAppRouteTab('auth');
      return;
    }
    setActiveTab(tab);
    syncAppRouteTab(tab);
    if (anchorId) {
      setTimeout(() => {
        document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  };

  const handleSelectServer = (nextServerId: string) => {
    if (!firebaseUser) {
      setActiveTab('auth');
      syncAppRouteTab('auth');
      return;
    }
    setSelectedServerId(nextServerId);
    setActiveTab('overview');
    syncAppRouteTab('overview');
    setTimeout(() => {
      document.getElementById('create-account')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const handleCreateAccount = async (
    payload: CreateAccountPayload,
  ): Promise<SavedVpnAccount | null> => {
    if (!firebaseUser) {
      setActiveTab('auth');
      throw new Error('يرجى تسجيل الدخول أولاً لحفظ الحساب في السحابة.');
    }

    setCreating(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/accounts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          ownerId: firebaseUser.uid,
          ownerEmail: firebaseUser.email || '',
        }),
      });
      const json = (await res.json()) as {
        account?: SavedVpnAccount;
        ping?: PingProbeResponse;
        error?: string;
      };
      if (!res.ok || !json.account) {
        throw new Error(json.error || 'تعذر إنشاء الحساب الحقيقي على الخادم');
      }
      if (json.ping) {
        setPingData(json.ping);
      }
      const saved = await saveVerifiedVpnAccountToFirestore(firebaseUser, json.account);
      return saved;
    } finally {
      setCreating(false);
    }
  };

  const handleVerifyAccount = async (
    payload: VerifyAccountPayload,
  ): Promise<VerifyAccountResponse | null> => {
    if (!firebaseUser) {
      setActiveTab('auth');
      throw new Error('يرجى تسجيل الدخول أولاً لحفظ الحساب في السحابة.');
    }

    setCreating(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/accounts/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          ownerId: firebaseUser.uid,
          ownerEmail: firebaseUser.email || '',
        }),
      });
      const json = (await res.json()) as VerifyAccountResponse & { error?: string };
      if (!res.ok || !json.account) {
        throw new Error(json.error || 'تعذر التحقق من الحساب على الخادم');
      }
      if (json.ping) {
        setPingData(json.ping);
      }
      const saved = await saveVerifiedVpnAccountToFirestore(firebaseUser, json.account);
      return {
        ...json,
        account: saved,
      };
    } finally {
      setCreating(false);
    }
  };

  const dismissDiscoveryResult = useCallback((mode: 'servers' | 'autorenew') => {
    const existing = discoveryTimersRef.current[mode];
    if (existing !== null) {
      window.clearTimeout(existing);
      discoveryTimersRef.current[mode] = null;
    }
    setDiscoveryResults((prev) => ({
      ...prev,
      [mode]: null,
    }));
  }, []);

  useEffect(() => {
    return () => {
      (['servers', 'autorenew'] as const).forEach((m) => {
        const timer = discoveryTimersRef.current[m];
        if (timer !== null) {
          window.clearTimeout(timer);
        }
      });
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const handleDiscoverProviders = async (mode: 'servers' | 'autorenew') => {
    setDiscoveringMode(mode);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/providers/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: selectedServerId, mode }),
      });
      const json = (await res.json()) as DiscoverProvidersResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'تعذر جلب مواقع جديدة حالياً');
      }
      if (json.serverData) {
        setServerData(normalizeServerDataUniqueIds(json.serverData));
      }

      // Pin newly discovered sites locally & in Cloud Firestore so they never disappear
      const newlyFetchedList =
        json.discoveredProviders || json.serverData?.discoveredProviders || [];
      if (newlyFetchedList.length > 0) {
        const mergedPinned = mergeProviderLists(loadLocalPinnedProviders(), newlyFetchedList);
        saveLocalPinnedProviders(mergedPinned);

        if (firebaseUser) {
          const addedIds = new Set(json.addedProviders.map((a) => a.providerId));
          const toSaveCloud =
            addedIds.size > 0
              ? newlyFetchedList.filter((p) => addedIds.has(p.providerId))
              : newlyFetchedList;
          void Promise.allSettled(
            toSaveCloud.map((prov) => saveDiscoveredProviderToFirestore(firebaseUser, prov)),
          );
        }
      }

      const existing = discoveryTimersRef.current[mode];
      if (existing !== null) {
        window.clearTimeout(existing);
      }
      setDiscoveryResults((prev) => ({
        ...prev,
        [mode]: json,
      }));
      discoveryTimersRef.current[mode] = window.setTimeout(() => {
        discoveryTimersRef.current[mode] = null;
        setDiscoveryResults((prev) => ({
          ...prev,
          [mode]: null,
        }));
      }, 10_000);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'تعذر جلب مواقع جديدة حالياً');
    } finally {
      setDiscoveringMode(null);
    }
  };

  const handleToggleAutoRenew = async (id: string, nextValue: boolean) => {
    if (!firebaseUser) return;
    const target = accounts.find((a) => a.id === id);
    if (nextValue && target && !isRealRenewalSupported(target)) {
      setErrorBanner(
        'التجديد التلقائي الحقيقي متاح فقط لحسابات ssh-tunnel.net عند توفر جلسة صالحة — لا يتم تفعيل تجديد وهمي.',
      );
      return;
    }
    setBusyAccountId(id);
    setErrorBanner(null);
    try {
      await updateVpnAccountAutoRenew(firebaseUser.uid, id, nextValue);
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleRenewNow = useCallback(
    async (id: string) => {
      if (!firebaseUser) return;
      const target = accounts.find((a) => a.id === id);
      if (!target) return;
      if (!isRealRenewalSupported(target)) {
        setErrorBanner('التجديد التلقائي واليدوي الحقيقي غير مدعوم من هذا المصدر.');
        return;
      }

      setBusyAccountId(id);
      setErrorBanner(null);
      try {
        const res = await fetch('/api/accounts/renew', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverId: target.serverId,
            username: target.username,
            password: target.password,
            sni: target.sni,
            durationDays: target.durationDays,
            sessionCookie: sessionCookie.trim() || undefined,
          }),
        });
        const json = (await res.json()) as {
          error?: string;
          expiresAt?: string;
          lastRenewedAt?: string;
          lastPingMs?: number | null;
          lastPingCheckedAt?: string;
          connectedUsersAtCheck?: number;
          upstreamMessage?: string;
          ping?: PingProbeResponse;
        };

        if (!res.ok || !json.expiresAt) {
          setErrorBanner(json.error || 'تعذر تجديد الحساب عبر خادم ssh-tunnel.net');
          return;
        }

        await updateVpnAccountRenewed(firebaseUser.uid, id, {
          expiresAt: json.expiresAt,
          renewCount: (target.renewCount || 0) + 1,
          lastRenewedAt: json.lastRenewedAt || new Date().toISOString(),
          lastPingMs: json.lastPingMs ?? null,
          lastPingCheckedAt: json.lastPingCheckedAt || new Date().toISOString(),
          connectedUsersAtCheck: json.connectedUsersAtCheck ?? 0,
          upstreamMessage: json.upstreamMessage || 'تم تجديد الحساب عبر خادم الموقع بنجاح',
        });

        if (json.ping) setPingData(json.ping);
      } finally {
        setBusyAccountId(null);
      }
    },
    [accounts, firebaseUser, sessionCookie],
  );

  // Automatic real upstream renewal check when a verified sessionCookie is configured
  useEffect(() => {
    if (!firebaseUser || !sessionCookie.trim()) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const soon = accounts.find(
        (a) =>
          a.autoRenew &&
          isRealRenewalSupported(a) &&
          !Number.isNaN(Date.parse(a.expiresAt)) &&
          Date.parse(a.expiresAt) - now <= 5 * 60 * 1000,
      );
      if (soon && !busyAccountId) {
        void handleRenewNow(soon.id);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [accounts, busyAccountId, firebaseUser, handleRenewNow, sessionCookie]);

  const handlePingAccount = useCallback(
    async (id: string): Promise<AccountProbeResult | null> => {
      if (!firebaseUser) return null;
      const target = accounts.find((a) => a.id === id);
      if (!target) return null;

      setBusyAccountId(id);
      try {
        const res = await fetch('/api/accounts/probe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverId: target.serverId,
            host: target.host,
          }),
        });
        if (!res.ok) return null;
        const json = (await res.json()) as AccountProbeResult;
        await updateVpnAccountProbeMetrics(firebaseUser.uid, id, {
          lastPingMs: json.lastPingMs,
          lastPingCheckedAt: json.lastPingCheckedAt,
          connectedUsersAtCheck: json.connectedUsersAtCheck,
        });
        if (json.ping) setPingData(json.ping);
        return json;
      } finally {
        setBusyAccountId(null);
      }
    },
    [accounts, firebaseUser],
  );

  const handleProbeAllAccounts = async () => {
    if (!firebaseUser || accounts.length === 0) return;
    setProbingAll(true);
    try {
      for (const acc of accounts) {
        await handlePingAccount(acc.id);
      }
    } finally {
      setProbingAll(false);
    }
  };

  const handleVerifyAllFormats = async (
    account: SavedVpnAccount,
  ): Promise<FormatCheckResult[]> => {
    setBusyAccountId(account.id);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/accounts/verify-formats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId: account.serverId,
          host: account.host,
          slowDnsHost: account.slowDnsHost,
          sni: account.sni,
          username: account.username,
          password: account.password,
          uuid: account.uuid,
          wireguardPrivateKey: account.wireguardPrivateKey,
          wireguardPublicKey: account.wireguardPublicKey,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        checkedAt?: string;
        ping?: PingProbeResponse;
        connectedUsersAtCheck?: number;
        formatChecks?: FormatCheckResult[];
      };

      if (!res.ok || !json.formatChecks) {
        throw new Error(json.error || 'تعذر التحقق من صيغ الحساب عبر الخادم');
      }

      if (json.ping) {
        setPingData(json.ping);
      }

      if (firebaseUser) {
        await updateVpnAccountProbeMetrics(firebaseUser.uid, account.id, {
          lastPingMs: json.ping?.bestLatencyMs ?? account.lastPingMs ?? null,
          lastPingCheckedAt: json.checkedAt || new Date().toISOString(),
          connectedUsersAtCheck:
            typeof json.connectedUsersAtCheck === 'number'
              ? json.connectedUsersAtCheck
              : account.connectedUsersAtCheck ?? 0,
        });
      }

      return json.formatChecks;
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleSavePreset = async (
    id: string,
    preset: { protocol: ProtocolFormatId; port: number; sni: string },
  ) => {
    if (!firebaseUser) return;
    setBusyAccountId(id);
    try {
      await updateVpnAccountConnectionPreset(firebaseUser.uid, id, preset);
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleUpdateExpiresAt = async (id: string, expiresAtIso: string) => {
    if (!firebaseUser) return;
    setBusyAccountId(id);
    setErrorBanner(null);
    try {
      await updateVpnAccountExpiresAt(firebaseUser.uid, id, expiresAtIso);
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleUpdateCustomName = async (id: string, customName: string) => {
    if (!firebaseUser) return;
    setBusyAccountId(id);
    setErrorBanner(null);
    try {
      await updateVpnAccountCustomName(firebaseUser.uid, id, customName);
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!firebaseUser) return;
    setBusyAccountId(id);
    try {
      await deleteVpnAccountFromFirestore(firebaseUser.uid, id);
    } finally {
      setBusyAccountId(null);
    }
  };

  const handleCreateReadyConfig = async (input: {
    title: string;
    protocol: ReadyConfigProtocolId;
    fileName: string;
    serverLabel: string;
    notes: string;
    content: string;
    encoding: 'text' | 'base64';
    sourceMode?: 'paste' | 'upload';
    totalBytes?: number;
    onProgress?: (percent: number) => void;
  }) => {
    if (!firebaseUser) {
      setActiveTab('auth');
      throw new Error('يرجى تسجيل الدخول بحساب المالك أولاً.');
    }
    await createReadyConfigInFirestore(firebaseUser, input);
  };

  const handleDeleteReadyConfig = async (configId: string, chunkCount = 0) => {
    if (!firebaseUser) return;
    await deleteReadyConfigFromFirestore(firebaseUser, configId, chunkCount);
  };

  const handleRefreshReadyConfigs = async (): Promise<number> => {
    if (!firebaseUser) return 0;
    setReadyConfigsRefreshing(true);
    setReadyConfigsError(null);
    try {
      const freshList = await fetchReadyConfigsFromServer();
      setReadyConfigs(freshList);
      return freshList.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر جلب الكونفجات الجديدة حالياً.';
      setReadyConfigsError(msg);
      throw err;
    } finally {
      setReadyConfigsRefreshing(false);
    }
  };

  const [refreshingSiteData, setRefreshingSiteData] = useState<boolean>(false);

  const handleRefreshAllSiteData = async () => {
    if (!firebaseUser || refreshingSiteData) return;
    setRefreshingSiteData(true);
    try {
      await Promise.allSettled([
        loadServerData(selectedServerId, true, true),
        fetchReadyConfigsFromServer().then((freshList) => setReadyConfigs(freshList)),
      ]);
    } finally {
      setRefreshingSiteData(false);
    }
  };

  const isSignedInAuth = Boolean(user);
  const effectiveTab: WorkspaceTab = isSignedInAuth ? activeTab : 'auth';

  useHardwareBackRoot(
    effectiveTab === (isSignedInAuth ? 'overview' : 'auth'),
    () => {
      const rootTab: WorkspaceTab = isSignedInAuth ? 'overview' : 'auth';
      setActiveTab(rootTab);
      syncAppRouteTab(rootTab);
    },
  );

  return (
    <div
      id="top"
      className="min-h-screen bg-slate-50 text-slate-900 dark:bg-black dark:text-zinc-100"
    >
      <TopBar
        activeTab={effectiveTab}
        savedCount={accounts.length}
        isAuthenticated={isSignedInAuth}
        isDark={isDark}
        onToggleDark={() => setIsDark((prev) => !prev)}
        onNavigateTab={handleNavigateTab}
        providers={isSignedInAuth ? serverData?.providers : []}
        servers={isSignedInAuth ? serverData?.allServers : []}
        accounts={isSignedInAuth ? accounts : []}
        onSelectServer={handleSelectServer}
        onRefreshSiteData={() => void handleRefreshAllSiteData()}
        refreshingSiteData={refreshingSiteData || serverLoading}
      />

      <main className="mx-auto max-w-[1280px] space-y-6 px-4 py-6 sm:px-6">
        {refreshBanner && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{refreshBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setRefreshBanner(null)}
              aria-label="إغلاق إشعار التحديث"
              className="rounded p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {errorBanner && (
          <div
            role="alert"
            className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs leading-relaxed font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
          >
            {errorBanner}
          </div>
        )}

        {/* Top Responsive Google AdSense Slot (above server list / active workspace) */}
        <AdSenseBanner key={`ad-top-${effectiveTab}`} placement="top" />

        {(!isSignedInAuth || effectiveTab === 'auth') && (
          <>
            <AuthGatePanel
              user={user}
              authLoading={authLoading}
              onLogin={handleLogin}
              onRegister={handleRegister}
              onResetPassword={handleResetPassword}
              onResendVerification={handleResendVerification}
              onRefreshVerification={handleRefreshVerification}
              onLogout={handleLogout}
            />

            {isSignedInAuth && effectiveTab === 'auth' && firebaseUser && user && (
              <OwnerChatPanel
                firebaseUser={firebaseUser}
                user={user}
                onResendVerification={handleResendVerification}
                onRefreshVerification={handleRefreshVerification}
              />
            )}
          </>
        )}

        {isSignedInAuth && effectiveTab === 'overview' && (
          <AccountCreator
            serverData={serverData}
            selectedServerId={selectedServerId}
            onSelectServer={handleSelectServer}
            onRefreshStrongest={() => void loadServerData(selectedServerId, true, true)}
            serverLoading={serverLoading}
            sessionCookie={sessionCookie}
            onSessionCookieChange={handleSessionCookieChange}
            sniValue={sniHost}
            onSniChange={setSniHost}
            isAuthenticated={isSignedInAuth}
            onRequireAuth={() => setActiveTab('auth')}
            onCreateAccount={handleCreateAccount}
            onVerifyAccount={handleVerifyAccount}
            creating={creating}
          />
        )}

        {isSignedInAuth && effectiveTab === 'readyConfigs' && (
          <ReadyConfigsPanel
            configs={readyConfigs}
            loading={readyConfigsLoading}
            refreshing={readyConfigsRefreshing}
            errorMsg={readyConfigsError}
            user={user}
            onCreateConfig={handleCreateReadyConfig}
            onDeleteConfig={handleDeleteReadyConfig}
            onRefreshConfigs={handleRefreshReadyConfigs}
            onResolveConfigContent={resolveReadyConfigContent}
            onResendVerification={handleResendVerification}
            onRefreshVerification={handleRefreshVerification}
            onRequireAuth={() => setActiveTab('auth')}
          />
        )}

        {isSignedInAuth && effectiveTab === 'tunnel' && (
          <TunnelRunnerPanel
            serverData={serverData}
            accounts={accounts}
            defaultSni={sniHost}
          />
        )}

        {isSignedInAuth && effectiveTab === 'saved' && (
          <SavedAccountsVault
            accounts={accounts}
            loading={accountsLoading}
            isAuthenticated={isSignedInAuth}
            onRequireAuth={() => setActiveTab('auth')}
            protocols={serverData?.protocols ?? []}
            liveConnectedUsers={serverData?.server.estimatedConnectedUsers ?? 0}
            onToggleAutoRenew={handleToggleAutoRenew}
            onRenewNow={handleRenewNow}
            onPingAccount={handlePingAccount}
            onProbeAllAccounts={handleProbeAllAccounts}
            probingAll={probingAll}
            onVerifyAllFormats={handleVerifyAllFormats}
            onSavePreset={handleSavePreset}
            onUpdateExpiresAt={handleUpdateExpiresAt}
            onUpdateCustomName={handleUpdateCustomName}
            onDeleteAccount={handleDeleteAccount}
            busyAccountId={busyAccountId}
          />
        )}

        {isSignedInAuth && effectiveTab === 'servers' && (
          <TrafficAndPortsPanel
            serverData={serverData}
            selectedServerId={selectedServerId}
            onSelectServer={handleSelectServer}
            mode="servers"
            onDiscoverProviders={handleDiscoverProviders}
            discoveringProviders={discoveringMode === 'servers'}
            discoveryResult={discoveryResults.servers}
            onDismissDiscoveryResult={() => dismissDiscoveryResult('servers')}
          />
        )}

        {isSignedInAuth && effectiveTab === 'autorenew' && (
          <TrafficAndPortsPanel
            serverData={serverData}
            selectedServerId={selectedServerId}
            onSelectServer={handleSelectServer}
            mode="autorenew"
            onDiscoverProviders={handleDiscoverProviders}
            discoveringProviders={discoveringMode === 'autorenew'}
            discoveryResult={discoveryResults.autorenew}
            onDismissDiscoveryResult={() => dismissDiscoveryResult('autorenew')}
          />
        )}

        {isSignedInAuth && effectiveTab === 'tools' && (
          <NetworkToolsPanel
            serverHost={serverData?.server.host ?? 'de-2.stunnel.cc'}
            serverPing={pingData}
            onUseSniHost={(host) => setSniHost(host)}
          />
        )}

        {/* Bottom Responsive Google AdSense Slot */}
        <AdSenseBanner key={`ad-bottom-${effectiveTab}`} placement="bottom" />
      </main>

      <footer className="mt-12 border-t border-slate-200 py-6 text-center text-xs text-slate-500 dark:border-zinc-900 dark:text-zinc-500">
        {isSignedInAuth ? (
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
            <span>
              VPN Fastore Pro — {serverData?.server.providerName ?? 'ssh-tunnel.net'} ({serverData?.providers?.length ?? 25} موقع VPN)
            </span>
            <span>
              إجمالي السيرفرات المتاحة: {serverData?.allServers?.length ?? 110} سيرفر · جميع الصيغ التسعة مدعومة
            </span>
          </div>
        ) : (
          <div className="mx-auto flex max-w-[1280px] items-center justify-center px-4 sm:px-6">
            <span>VPN Fastore Pro — جميع الخيارات مغلقة لحين تسجيل الدخول</span>
          </div>
        )}
      </footer>
      <OfflineIndicator />
      <InAppWebViewModal />
    </div>
  );
}

export default function App() {
  return (
    <InAppBrowserProvider>
      <AppShell />
    </InAppBrowserProvider>
  );
}

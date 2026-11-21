import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  inMemoryPersistence,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  getFirestore,
  initializeFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type {
  OwnerChatMessage,
  OwnerChatThread,
  ProtocolFormatId,
  ReadyConfigItem,
  ReadyConfigProtocolId,
  SavedVpnAccount,
  VpnProviderSummary,
} from './types.ts';

export const APP_OWNER_EMAIL = 'ledokishk@gmail.com';

export function isOwnerEmailOnly(
  user: { email?: string | null } | null | undefined,
): boolean {
  return Boolean(user?.email && user.email.trim().toLowerCase() === APP_OWNER_EMAIL);
}

export function isAppOwnerUser(
  user: { email?: string | null; emailVerified?: boolean } | null | undefined,
): boolean {
  return isOwnerEmailOnly(user) && Boolean(user?.emailVerified);
}

export function isSameOriginOAuthHost(): boolean {
  if (typeof window === 'undefined') return false;
  const { protocol, hostname } = window.location;
  if (protocol !== 'https:') return false;
  return (
    hostname.endsWith('.run.app') ||
    hostname === 'carbide-pen-tpd8p.firebaseapp.com' ||
    hostname === 'carbide-pen-tpd8p.web.app'
  );
}

const effectiveFirebaseConfig = isSameOriginOAuthHost()
  ? { ...firebaseConfig, authDomain: window.location.host }
  : firebaseConfig;

const app = initializeApp(effectiveFirebaseConfig);

function createFirestoreInstance(): Firestore {
  try {
    return initializeFirestore(
      app,
      { experimentalForceLongPolling: true },
      firebaseConfig.firestoreDatabaseId,
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

function createAuthInstance(): Auth {
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    return getAuth(app);
  }
}

export const db = createFirestoreInstance();
export const auth = createAuthInstance();
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

void setPersistence(auth, indexedDBLocalPersistence)
  .catch(() => setPersistence(auth, browserLocalPersistence))
  .catch(() => setPersistence(auth, inMemoryPersistence))
  .catch((err) => {
    console.warn('Could not enforce Auth persistence:', err);
  });

const DIRECT_OAUTH_STATE_KEY = 'vpnfastore_google_oauth_state';

function makeOAuthRandomToken(len = 24): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(len);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

export function shouldUseDirectGoogleOAuth(): boolean {
  if (typeof window === 'undefined' || !isSameOriginOAuthHost()) return false;
  const ua = navigator.userAgent || '';
  const isAndroidOrWebViewOrMobile =
    /android|\bwv\b|via\/|micromessenger|fbav|instagram|line\/|iphone|ipad|ipod/i.test(ua);
  const isStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  let sessionStorageWorks = false;
  try {
    const k = '__vpn_fastore_ss_check__';
    window.sessionStorage.setItem(k, '1');
    sessionStorageWorks = window.sessionStorage.getItem(k) === '1';
    window.sessionStorage.removeItem(k);
  } catch {
    sessionStorageWorks = false;
  }
  return isAndroidOrWebViewOrMobile || isStandalone || !sessionStorageWorks;
}

export function startDirectGoogleOAuthRedirect(): void {
  const clientId = firebaseConfig.oAuthClientId;
  if (!clientId) {
    throw new Error('معرّف عميل Google OAuth غير متوفر.');
  }
  const state = `vpnfastore_direct_${Date.now()}_${makeOAuthRandomToken(16)}`;
  const nonce = makeOAuthRandomToken(24);
  try {
    window.localStorage.setItem(
      DIRECT_OAUTH_STATE_KEY,
      JSON.stringify({ state, createdAt: Date.now() }),
    );
  } catch {
    // Continue even if localStorage is cleared/restricted in WebView
  }
  const redirectUri = `${window.location.origin}/__/auth/handler`;
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'id_token',
      scope: 'openid email profile',
      prompt: 'select_account',
      nonce,
      state,
    }).toString();
  window.location.assign(authUrl);
}

export async function signInWithGoogleSmart(): Promise<'signed-in' | 'redirecting'> {
  if (shouldUseDirectGoogleOAuth()) {
    startDirectGoogleOAuthRedirect();
    return 'redirecting';
  }
  try {
    await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
    return 'signed-in';
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    const msg = err instanceof Error ? err.message : String(err ?? '');
    const shouldFallbackToDirect =
      isSameOriginOAuthHost() &&
      (code === 'auth/popup-blocked' ||
        code === 'auth/missing-or-invalid-nonce' ||
        code === 'auth/web-storage-unsupported' ||
        code === 'auth/internal-error' ||
        /sessionstorage|missing initial state|popup/i.test(msg));
    if (shouldFallbackToDirect) {
      startDirectGoogleOAuthRedirect();
      return 'redirecting';
    }
    throw err;
  }
}

export async function consumeDirectGoogleOAuthCallback(): Promise<{
  handled: boolean;
  signedIn: boolean;
  error?: string;
}> {
  if (typeof window === 'undefined' || !window.location.hash) {
    return { handled: false, signedIn: false };
  }
  const rawHash = window.location.hash.slice(1);
  if (!rawHash.includes('vpnfastore_google_oauth=1')) {
    return { handled: false, signedIn: false };
  }
  const params = new URLSearchParams(rawHash);
  const idToken = params.get('id_token') || '';
  const state = params.get('state') || '';
  const oauthError = params.get('error') || '';

  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {
    // ignore
  }

  let savedState: string | null = null;
  try {
    const rawSaved = window.localStorage.getItem(DIRECT_OAUTH_STATE_KEY);
    window.localStorage.removeItem(DIRECT_OAUTH_STATE_KEY);
    if (rawSaved) {
      const parsed = JSON.parse(rawSaved) as { state?: string };
      savedState = parsed.state || null;
    }
  } catch {
    // ignore
  }

  if (!state.startsWith('vpnfastore_direct_') || (savedState && savedState !== state)) {
    return {
      handled: true,
      signedIn: false,
      error: 'تعذر التحقق من حالة تسجيل الدخول بـ Google. يرجى المحاولة مرة أخرى.',
    };
  }

  if (oauthError) {
    return {
      handled: true,
      signedIn: false,
      error:
        oauthError === 'access_denied'
          ? 'تم إلغاء تسجيل الدخول بحساب Google.'
          : `تعذر إتمام تسجيل الدخول بحساب Google (${oauthError}).`,
    };
  }

  if (!idToken) {
    return {
      handled: true,
      signedIn: false,
      error: 'لم يتم استلام رمز التحقق من Google (id_token).',
    };
  }

  const cred = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(auth, cred);
  return { handled: true, signedIn: true };
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function isTransientFirestoreNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lower = message.toLowerCase();
  return (
    lower.includes('code=unavailable') ||
    lower.includes('[unavailable]') ||
    lower.includes('the client is offline') ||
    lower.includes('could not reach cloud firestore backend') ||
    lower.includes('the operation could not be completed') ||
    lower.includes('network-request-failed')
  );
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function clampStr(value: string | null | undefined, maxLen: number, fallback = ''): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  return (raw || fallback).slice(0, maxLen);
}

function clampInt(value: number | null | undefined, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || `acc_${Date.now()}`;
}

export async function ensureUserProfile(
  user: User,
  preferredDisplayName?: string,
): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const email = clampStr(user.email, 320, `${user.uid}@user.local`);
  const explicitName = clampStr(preferredDisplayName || user.displayName, 120, '');
  const fallbackName = clampStr(email.split('@')[0], 120, 'مستخدم');

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email,
        displayName: explicitName || fallbackName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = snap.data() as Record<string, unknown>;
      const existingName =
        typeof existingData.displayName === 'string' ? existingData.displayName.trim() : '';
      await updateDoc(ref, {
        email,
        displayName: explicitName || existingName || fallbackName,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserAccounts(
  uid: string,
  onData: (accounts: SavedVpnAccount[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = `users/${uid}/accounts`;
  const q = query(collection(db, 'users', uid, 'accounts'), where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: SavedVpnAccount[] = snapshot.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: String(data.id || d.id),
          ownerId: String(data.ownerId || uid),
          ownerEmail: String(data.ownerEmail || ''),
          serverId: String(data.serverId || '15'),
          serverCode: String(data.serverCode || 'DE 2'),
          serverName: String(data.serverName || 'SSH Tunnel Server DE 2'),
          serverCountryAr: String(data.serverCountryAr || 'ألمانيا (فرانكفورت)'),
          serverLocation: String(data.serverLocation || 'Frankfurt'),
          serverPageUrl: String(data.serverPageUrl || ''),
          host: String(data.host || 'de-2.stunnel.cc'),
          serverIp:
            typeof data.serverIp === 'string' && data.serverIp.trim()
              ? data.serverIp.trim()
              : undefined,
          slowDnsHost: String(data.slowDnsHost || 'dns.de-2.stunnel.cc'),
          protocol: (data.protocol as SavedVpnAccount['protocol']) || 'ssh_ws',
          port: typeof data.port === 'number' ? data.port : 80,
          username: String(data.username || ''),
          customName:
            typeof data.customName === 'string' && data.customName.trim()
              ? data.customName.trim()
              : undefined,
          password: String(data.password || ''),
          uuid: String(data.uuid || ''),
          sni: String(data.sni || 'creativecommons.org'),
          wireguardPrivateKey: String(data.wireguardPrivateKey || ''),
          wireguardPublicKey: String(data.wireguardPublicKey || ''),
          createdAt: String(data.createdAtIso || new Date().toISOString()),
          expiresAt: String(data.expiresAt || new Date().toISOString()),
          durationDays: typeof data.durationDays === 'number' ? data.durationDays : 3,
          autoRenew: Boolean(data.autoRenew),
          renewCount: typeof data.renewCount === 'number' ? data.renewCount : 0,
          lastRenewedAt: typeof data.lastRenewedAt === 'string' ? data.lastRenewedAt : null,
          lastPingMs: typeof data.lastPingMs === 'number' ? data.lastPingMs : null,
          lastPingCheckedAt: typeof data.lastPingCheckedAt === 'string' ? data.lastPingCheckedAt : null,
          connectedUsersAtCheck:
            typeof data.connectedUsersAtCheck === 'number' ? data.connectedUsersAtCheck : null,
          upstreamProvisioned: Boolean(data.upstreamProvisioned),
          upstreamMessage: String(data.upstreamMessage || ''),
          rawUpstreamHtml: typeof data.rawUpstreamHtml === 'string' ? data.rawUpstreamHtml : undefined,
        };
      });

      list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        } else {
          throw wrapped;
        }
      }
    },
  );
}

export async function saveVerifiedVpnAccountToFirestore(
  user: User,
  account: SavedVpnAccount,
): Promise<SavedVpnAccount> {
  if (!account.upstreamProvisioned) {
    throw new Error('لا يمكن حفظ حساب غير موثق من خادم ssh-tunnel.net.');
  }
  await ensureUserProfile(user);

  const accountId = sanitizeId(account.id);
  const path = `users/${user.uid}/accounts/${accountId}`;
  const docRef = doc(db, 'users', user.uid, 'accounts', accountId);

  const cleanAccount: SavedVpnAccount = {
    ...account,
    id: accountId,
    ownerId: user.uid,
    ownerEmail: clampStr(user.email, 320, `${user.uid}@user.local`),
    port: clampInt(account.port, 1, 65535, 80),
    durationDays: clampInt(account.durationDays, 1, 30, 3),
    renewCount: clampInt(account.renewCount, 0, 10000, 0),
    lastPingMs:
      typeof account.lastPingMs === 'number' ? clampInt(account.lastPingMs, 0, 60000, 0) : null,
    connectedUsersAtCheck:
      typeof account.connectedUsersAtCheck === 'number'
        ? clampInt(account.connectedUsersAtCheck, 0, 100000, 0)
        : null,
  };

  const payload = {
    id: cleanAccount.id,
    ownerId: cleanAccount.ownerId,
    ownerEmail: cleanAccount.ownerEmail,
    serverId: clampStr(cleanAccount.serverId, 32, '15').replace(/[^a-zA-Z0-9_-]/g, ''),
    serverCode: clampStr(cleanAccount.serverCode, 32, 'DE 2'),
    serverName: clampStr(cleanAccount.serverName, 128, 'SSH Tunnel Server DE 2'),
    serverCountryAr: clampStr(cleanAccount.serverCountryAr, 128, 'ألمانيا (فرانكفورت)'),
    serverLocation: clampStr(cleanAccount.serverLocation, 128, 'Frankfurt'),
    serverPageUrl: clampStr(cleanAccount.serverPageUrl, 256, ''),
    host: clampStr(cleanAccount.host, 128, 'de-2.stunnel.cc'),
    serverIp:
      cleanAccount.serverIp && cleanAccount.serverIp.trim()
        ? clampStr(cleanAccount.serverIp, 64)
        : null,
    slowDnsHost: clampStr(cleanAccount.slowDnsHost, 128, 'dns.de-2.stunnel.cc'),
    protocol: cleanAccount.protocol,
    port: cleanAccount.port,
    username: clampStr(cleanAccount.username, 64),
    customName:
      cleanAccount.customName && cleanAccount.customName.trim()
        ? clampStr(cleanAccount.customName, 80)
        : null,
    password: clampStr(cleanAccount.password, 128),
    uuid: clampStr(cleanAccount.uuid, 64),
    sni: clampStr(cleanAccount.sni, 256, 'creativecommons.org'),
    wireguardPrivateKey: clampStr(cleanAccount.wireguardPrivateKey, 128),
    wireguardPublicKey: clampStr(cleanAccount.wireguardPublicKey, 128),
    createdAtIso: clampStr(cleanAccount.createdAt, 64, new Date().toISOString()),
    expiresAt: clampStr(cleanAccount.expiresAt, 64, new Date().toISOString()),
    durationDays: cleanAccount.durationDays,
    autoRenew: Boolean(cleanAccount.autoRenew),
    renewCount: cleanAccount.renewCount,
    lastRenewedAt: cleanAccount.lastRenewedAt ? clampStr(cleanAccount.lastRenewedAt, 64) : null,
    lastPingMs: cleanAccount.lastPingMs,
    lastPingCheckedAt: cleanAccount.lastPingCheckedAt
      ? clampStr(cleanAccount.lastPingCheckedAt, 64)
      : null,
    connectedUsersAtCheck: cleanAccount.connectedUsersAtCheck,
    upstreamProvisioned: true,
    upstreamMessage: clampStr(cleanAccount.upstreamMessage, 512, 'تم التحقق من الحساب الحقيقي'),
    rawUpstreamHtml: cleanAccount.rawUpstreamHtml
      ? clampStr(cleanAccount.rawUpstreamHtml, 8192)
      : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(docRef, payload);
    return cleanAccount;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateVpnAccountAutoRenew(
  uid: string,
  accountId: string,
  autoRenew: boolean,
): Promise<void> {
  const path = `users/${uid}/accounts/${accountId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'accounts', accountId), {
      autoRenew: Boolean(autoRenew),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateVpnAccountConnectionPreset(
  uid: string,
  accountId: string,
  preset: {
    protocol: SavedVpnAccount['protocol'];
    port: number;
    sni: string;
  },
): Promise<void> {
  const path = `users/${uid}/accounts/${accountId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'accounts', accountId), {
      protocol: preset.protocol,
      port: clampInt(preset.port, 1, 65535, 80),
      sni: clampStr(preset.sni, 256, 'creativecommons.org'),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateVpnAccountExpiresAt(
  uid: string,
  accountId: string,
  expiresAt: string,
): Promise<void> {
  const path = `users/${uid}/accounts/${accountId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'accounts', accountId), {
      expiresAt: clampStr(expiresAt, 64, 'unverified-date'),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateVpnAccountCustomName(
  uid: string,
  accountId: string,
  customName: string,
): Promise<void> {
  const path = `users/${uid}/accounts/${accountId}`;
  const trimmed = clampStr(customName, 80);
  try {
    await updateDoc(doc(db, 'users', uid, 'accounts', accountId), {
      customName: trimmed || null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateVpnAccountProbeMetrics(
  uid: string,
  accountId: string,
  metrics: {
    lastPingMs: number | null;
    lastPingCheckedAt: string;
    connectedUsersAtCheck: number;
  },
): Promise<void> {
  const path = `users/${uid}/accounts/${accountId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'accounts', accountId), {
      lastPingMs:
        typeof metrics.lastPingMs === 'number'
          ? clampInt(metrics.lastPingMs, 0, 60000, 0)
          : null,
      lastPingCheckedAt: clampStr(metrics.lastPingCheckedAt, 64),
      connectedUsersAtCheck: clampInt(metrics.connectedUsersAtCheck, 0, 100000, 0),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateVpnAccountRenewed(
  uid: string,
  accountId: string,
  renewal: {
    expiresAt: string;
    renewCount: number;
    lastRenewedAt: string;
    lastPingMs: number | null;
    lastPingCheckedAt: string;
    connectedUsersAtCheck: number;
    upstreamMessage: string;
  },
): Promise<void> {
  const path = `users/${uid}/accounts/${accountId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'accounts', accountId), {
      expiresAt: clampStr(renewal.expiresAt, 64),
      renewCount: clampInt(renewal.renewCount, 0, 10000, 1),
      lastRenewedAt: clampStr(renewal.lastRenewedAt, 64),
      lastPingMs:
        typeof renewal.lastPingMs === 'number'
          ? clampInt(renewal.lastPingMs, 0, 60000, 0)
          : null,
      lastPingCheckedAt: clampStr(renewal.lastPingCheckedAt, 64),
      connectedUsersAtCheck: clampInt(renewal.connectedUsersAtCheck, 0, 100000, 0),
      upstreamProvisioned: true,
      upstreamMessage: clampStr(renewal.upstreamMessage, 512),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteVpnAccountFromFirestore(
  uid: string,
  accountId: string,
): Promise<void> {
  const path = `users/${uid}/accounts/${accountId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'accounts', accountId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveDiscoveredProviderToFirestore(
  user: User,
  provider: VpnProviderSummary,
): Promise<void> {
  if (!provider || !provider.providerId || !Array.isArray(provider.servers) || provider.servers.length === 0) {
    return;
  }
  await ensureUserProfile(user);

  const providerId = sanitizeId(provider.providerId).slice(0, 64);
  const path = `users/${user.uid}/discoveredProviders/${providerId}`;
  const docRef = doc(db, 'users', user.uid, 'discoveredProviders', providerId);

  const protocols = (provider.supportedProtocols || ['v2ray_vless'])
    .filter((p) => typeof p === 'string' && p.length > 0)
    .slice(0, 9);
  if (protocols.length === 0) protocols.push('v2ray_vless');

  const compactServers = provider.servers.slice(0, 15).map((s) => ({
    serverId: clampStr(s.serverId, 48, `srv_${providerId}`),
    providerId,
    providerName: clampStr(s.providerName || provider.name, 128, provider.name),
    code: clampStr(s.code, 32, 'NODE'),
    name: clampStr(s.name, 128, provider.name),
    host: clampStr(s.host, 128, provider.domain),
    slowDnsHost: clampStr(s.slowDnsHost, 128, `dns.${s.host || provider.domain}`),
    regionPath: clampStr(s.regionPath, 64, '/'),
    pageUrl: clampStr(s.pageUrl || provider.baseUrl, 256, provider.baseUrl),
    regionLabelAr: clampStr(s.regionLabelAr, 64, 'عالمي'),
    location: clampStr(s.location, 64, 'Global'),
    country: clampStr(s.country, 64, 'Global'),
    countryAr: clampStr(s.countryAr, 64, 'سيرفر حي'),
    status: s.status === 'Offline' ? 'Offline' : 'Online',
    accountUsagePercent: clampInt(s.accountUsagePercent, 0, 100, 12),
    estimatedConnectedUsers: clampInt(s.estimatedConnectedUsers, 0, 100000, 18),
    supportedProtocols: (s.supportedProtocols || protocols).slice(0, 9),
    validityDaysLabelAr: clampStr(s.validityDaysLabelAr || provider.validityDaysLabelAr, 128, 'عقد حية'),
    resetScheduleAr: clampStr(s.resetScheduleAr || provider.resetScheduleAr, 128, 'تحديث دوري'),
    services: s.services || {
      dnstt: 'DOWN',
      v2ray: 'UP',
      wireguard: 'DOWN',
      noobzvpn: 'DOWN',
      squid: 'DOWN',
    },
  }));

  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      await updateDoc(docRef, {
        servers: compactServers,
        resetScheduleAr: clampStr(provider.resetScheduleAr, 128, 'تحديث دوري'),
        validityDaysLabelAr: clampStr(provider.validityDaysLabelAr, 128, 'عقد حية'),
        descriptionAr: clampStr(provider.descriptionAr, 512, provider.nameAr),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        providerId,
        ownerId: user.uid,
        name: clampStr(provider.name, 128, providerId),
        nameAr: clampStr(provider.nameAr, 128, provider.name),
        domain: clampStr(provider.domain, 128, 'github.com'),
        baseUrl: clampStr(provider.baseUrl, 256, 'https://github.com'),
        resetScheduleAr: clampStr(provider.resetScheduleAr, 128, 'تحديث دوري'),
        validityDaysLabelAr: clampStr(provider.validityDaysLabelAr, 128, 'عقد حية'),
        supportedProtocols: protocols,
        descriptionAr: clampStr(provider.descriptionAr, 512, provider.nameAr),
        supportsAutoRenew: Boolean(provider.supportsAutoRenew),
        requiresCookies: Boolean(provider.requiresCookies),
        servers: compactServers,
        pinnedAtIso: new Date().toISOString(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserDiscoveredProviders(
  uid: string,
  onData: (providers: VpnProviderSummary[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = `users/${uid}/discoveredProviders`;
  const q = query(collection(db, 'users', uid, 'discoveredProviders'), where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: VpnProviderSummary[] = snapshot.docs
        .map((d): VpnProviderSummary => {
          const data = d.data() as Record<string, unknown>;
          const servers = Array.isArray(data.servers)
            ? (data.servers as VpnProviderSummary['servers'])
            : [];
          const supportedProtocols: ProtocolFormatId[] =
            Array.isArray(data.supportedProtocols) && data.supportedProtocols.length > 0
              ? (data.supportedProtocols as ProtocolFormatId[])
              : ['v2ray_vless'];
          return {
            providerId: String(data.providerId || d.id),
            name: String(data.name || ''),
            nameAr: String(data.nameAr || data.name || ''),
            domain: String(data.domain || ''),
            baseUrl: String(data.baseUrl || ''),
            resetScheduleAr: String(data.resetScheduleAr || ''),
            validityDaysLabelAr: String(data.validityDaysLabelAr || ''),
            supportedProtocols,
            descriptionAr: String(data.descriptionAr || ''),
            liveStatus: 'Online',
            supportsAutoRenew: Boolean(data.supportsAutoRenew),
            requiresCookies: Boolean(data.requiresCookies),
            servers,
          };
        })
        .filter((p) => p.providerId && p.servers.length > 0);

      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    },
  );
}

export const MAX_READY_CONFIG_BYTES = 5 * 1024 * 1024;
export const READY_CONFIG_CHUNK_MARKER = '__CHUNKED_CONFIG__';
const INLINE_READY_CONFIG_CHAR_LIMIT = 200_000;
const READY_CONFIG_CHUNK_CHAR_SIZE = 500_000;
const MAX_READY_CONFIG_CHUNKS = 20;

function mapReadyConfigDoc(
  id: string,
  data: Record<string, unknown>,
): ReadyConfigItem {
  return {
    id: String(data.id || id),
    title: String(data.title || 'كونفج جاهز'),
    protocol: (data.protocol as ReadyConfigProtocolId) || 'ssh_ws',
    fileName: String(data.fileName || 'config.txt'),
    serverLabel: String(data.serverLabel || ''),
    notes: String(data.notes || ''),
    content: String(data.content || ''),
    encoding: data.encoding === 'base64' ? 'base64' : 'text',
    sourceMode:
      data.sourceMode === 'upload'
        ? 'upload'
        : data.sourceMode === 'paste'
          ? 'paste'
          : undefined,
    chunkCount: typeof data.chunkCount === 'number' ? data.chunkCount : 0,
    totalBytes: typeof data.totalBytes === 'number' ? data.totalBytes : undefined,
    isPublished: Boolean(data.isPublished),
    authorUid: String(data.authorUid || ''),
    createdAtIso: String(data.createdAtIso || new Date().toISOString()),
  };
}

export function subscribeReadyConfigs(
  onData: (configs: ReadyConfigItem[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = 'readyConfigs';
  const q = query(collection(db, 'readyConfigs'), where('isPublished', '==', true));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ReadyConfigItem[] = snapshot.docs.map((d) =>
        mapReadyConfigDoc(d.id, d.data() as Record<string, unknown>),
      );

      list.sort((a, b) => Date.parse(b.createdAtIso) - Date.parse(a.createdAtIso));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    },
  );
}

export async function fetchReadyConfigsFromServer(): Promise<ReadyConfigItem[]> {
  const path = 'readyConfigs';
  const q = query(collection(db, 'readyConfigs'), where('isPublished', '==', true));
  try {
    const snapshot = await getDocsFromServer(q);
    const list = snapshot.docs.map((d) =>
      mapReadyConfigDoc(d.id, d.data() as Record<string, unknown>),
    );
    list.sort((a, b) => Date.parse(b.createdAtIso) - Date.parse(a.createdAtIso));
    return list;
  } catch (serverErr) {
    try {
      const fallbackSnap = await getDocs(q);
      const list = fallbackSnap.docs.map((d) =>
        mapReadyConfigDoc(d.id, d.data() as Record<string, unknown>),
      );
      list.sort((a, b) => Date.parse(b.createdAtIso) - Date.parse(a.createdAtIso));
      return list;
    } catch (err) {
      handleFirestoreError(err ?? serverErr, OperationType.LIST, path);
    }
  }
}

export async function resolveReadyConfigContent(
  item: ReadyConfigItem,
): Promise<string> {
  const chunkCount = item.chunkCount ?? 0;
  if (chunkCount <= 0 && item.content !== READY_CONFIG_CHUNK_MARKER) {
    return item.content;
  }
  if (chunkCount <= 0 || chunkCount > MAX_READY_CONFIG_CHUNKS) {
    throw new Error('بيانات أجزاء الملف غير صالحة أو غير مكتملة.');
  }

  const indices = Array.from({ length: chunkCount }, (_, i) => i);
  const parts = await Promise.all(
    indices.map(async (idx) => {
      const chunkId = `chunk_${idx}`;
      const chunkRef = doc(db, 'readyConfigs', item.id, 'chunks', chunkId);
      const path = `readyConfigs/${item.id}/chunks/${chunkId}`;
      try {
        let snap = await getDoc(chunkRef);
        if (!snap.exists()) {
          snap = await getDocFromServer(chunkRef);
        }
        if (!snap.exists()) {
          throw new Error(`الجزء رقم ${idx + 1} من الملف غير موجود.`);
        }
        const data = snap.data() as Record<string, unknown>;
        return String(data.data || '');
      } catch (err) {
        if (err instanceof Error && err.message.includes('الجزء رقم')) {
          throw err;
        }
        handleFirestoreError(err, OperationType.GET, path);
      }
    }),
  );

  return parts.join('');
}

export async function createReadyConfigInFirestore(
  user: User,
  input: {
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
  },
): Promise<ReadyConfigItem> {
  if (!isOwnerEmailOnly(user)) {
    throw new Error('هذه الصلاحية متاحة لحساب المالك فقط.');
  }
  if (!user.emailVerified) {
    throw new Error('يرجى تأكيد البريد الإلكتروني لحساب المالك أولاً لتفعيل صلاحية النشر.');
  }
  if (!input.content.trim()) {
    throw new Error('محتوى الكونفج فارغ. يرجى رفع ملف أو لصق الكونفج أولاً.');
  }
  if (typeof input.totalBytes === 'number' && input.totalBytes > MAX_READY_CONFIG_BYTES) {
    throw new Error('حجم الملف يتجاوز الحد الأقصى المسموح (5 ميجابايت).');
  }

  const configId = sanitizeId(`rc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const path = `readyConfigs/${configId}`;
  const docRef = doc(db, 'readyConfigs', configId);
  const createdAtIso = new Date().toISOString();

  const baseMeta = {
    id: configId,
    title: clampStr(input.title, 120, 'كونفج VPN جاهز'),
    protocol: input.protocol,
    fileName: clampStr(input.fileName, 128, 'config.txt'),
    serverLabel: clampStr(input.serverLabel, 120, ''),
    notes: clampStr(input.notes, 500, ''),
    encoding: (input.encoding === 'base64' ? 'base64' : 'text') as 'text' | 'base64',
    sourceMode: (input.sourceMode === 'upload' ? 'upload' : 'paste') as 'paste' | 'upload',
    authorUid: user.uid,
    createdAtIso,
  };

  // Fast single-document path for inline configs <= 200k chars
  if (input.content.length <= INLINE_READY_CONFIG_CHAR_LIMIT) {
    const cleanItem: ReadyConfigItem = {
      ...baseMeta,
      content: input.content,
      chunkCount: 0,
      totalBytes: input.totalBytes ?? input.content.length,
      isPublished: true,
    };

    try {
      input.onProgress?.(40);
      await setDoc(docRef, {
        ...cleanItem,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      input.onProgress?.(100);
      return cleanItem;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  // Chunked path for large configs up to 5 MB
  const chunks: string[] = [];
  for (let offset = 0; offset < input.content.length; offset += READY_CONFIG_CHUNK_CHAR_SIZE) {
    chunks.push(input.content.slice(offset, offset + READY_CONFIG_CHUNK_CHAR_SIZE));
  }
  if (chunks.length > MAX_READY_CONFIG_CHUNKS) {
    throw new Error('حجم الملف يتجاوز الحد الأقصى المسموح (5 ميجابايت).');
  }

  const draftItem: ReadyConfigItem = {
    ...baseMeta,
    content: READY_CONFIG_CHUNK_MARKER,
    chunkCount: chunks.length,
    totalBytes: input.totalBytes ?? input.content.length,
    isPublished: false,
  };

  try {
    input.onProgress?.(5);
    await setDoc(docRef, {
      ...draftItem,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  const uploadedChunkIds: string[] = [];
  try {
    const concurrency = 2;
    for (let i = 0; i < chunks.length; i += concurrency) {
      const batchIndices = Array.from(
        { length: Math.min(concurrency, chunks.length - i) },
        (_, offset) => i + offset,
      );
      await Promise.all(
        batchIndices.map(async (idx) => {
          const chunkId = `chunk_${idx}`;
          const chunkRef = doc(db, 'readyConfigs', configId, 'chunks', chunkId);
          await setDoc(chunkRef, {
            index: idx,
            data: chunks[idx],
            authorUid: user.uid,
            createdAt: serverTimestamp(),
          });
          uploadedChunkIds.push(chunkId);
        }),
      );
      const pct = Math.min(95, Math.round(((i + batchIndices.length) / chunks.length) * 90) + 5);
      input.onProgress?.(pct);
    }

    await updateDoc(docRef, {
      isPublished: true,
      updatedAt: serverTimestamp(),
    });
    input.onProgress?.(100);
    return {
      ...draftItem,
      isPublished: true,
    };
  } catch (error) {
    // Best-effort cleanup of incomplete upload
    await Promise.allSettled(
      uploadedChunkIds.map((cid) =>
        deleteDoc(doc(db, 'readyConfigs', configId, 'chunks', cid)),
      ),
    );
    await deleteDoc(docRef).catch(() => null);
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteReadyConfigFromFirestore(
  user: User,
  configId: string,
  chunkCount = 0,
): Promise<void> {
  if (!isOwnerEmailOnly(user)) {
    throw new Error('حذف الكونفجات متاح لحساب المالك فقط.');
  }
  const safeId = sanitizeId(configId);
  const path = `readyConfigs/${safeId}`;
  try {
    if (chunkCount > 0) {
      const indices = Array.from({ length: Math.min(chunkCount, MAX_READY_CONFIG_CHUNKS) }, (_, i) => i);
      await Promise.allSettled(
        indices.map((idx) =>
          deleteDoc(doc(db, 'readyConfigs', safeId, 'chunks', `chunk_${idx}`)),
        ),
      );
    }
    await deleteDoc(doc(db, 'readyConfigs', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function mapOwnerChatThread(
  id: string,
  data: Record<string, unknown>,
): OwnerChatThread {
  return {
    userId: String(data.userId || id),
    userEmail: String(data.userEmail || ''),
    userName: String(data.userName || ''),
    lastMessageText: String(data.lastMessageText || ''),
    lastSenderRole: data.lastSenderRole === 'owner' ? 'owner' : 'user',
    lastMessageAtIso: String(data.lastMessageAtIso || new Date().toISOString()),
    unreadByOwner: Boolean(data.unreadByOwner),
    unreadByUser: Boolean(data.unreadByUser),
  };
}

export function subscribeUserOwnerChatThread(
  userId: string,
  onData: (thread: OwnerChatThread | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const safeUid = sanitizeId(userId);
  const path = `ownerChats/${safeUid}`;
  const docRef = doc(db, 'ownerChats', safeUid);

  return onSnapshot(
    docRef,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(mapOwnerChatThread(snap.id, snap.data() as Record<string, unknown>));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        if (onError) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    },
  );
}

export function subscribeAllOwnerChatThreads(
  onData: (threads: OwnerChatThread[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const path = 'ownerChats';
  return onSnapshot(
    collection(db, 'ownerChats'),
    (snapshot) => {
      const list = snapshot.docs.map((d) =>
        mapOwnerChatThread(d.id, d.data() as Record<string, unknown>),
      );
      list.sort((a, b) => Date.parse(b.lastMessageAtIso) - Date.parse(a.lastMessageAtIso));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    },
  );
}

export function subscribeOwnerChatMessages(
  threadUserId: string,
  onData: (messages: OwnerChatMessage[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const safeUid = sanitizeId(threadUserId);
  const path = `ownerChats/${safeUid}/messages`;
  const q = query(
    collection(db, 'ownerChats', safeUid, 'messages'),
    where('threadUserId', '==', safeUid),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: OwnerChatMessage[] = snapshot.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: String(data.id || d.id),
          threadUserId: String(data.threadUserId || safeUid),
          senderUid: String(data.senderUid || ''),
          senderEmail: String(data.senderEmail || ''),
          senderRole: data.senderRole === 'owner' ? 'owner' : 'user',
          text: String(data.text || ''),
          createdAtIso: String(data.createdAtIso || new Date().toISOString()),
        };
      });
      list.sort((a, b) => Date.parse(a.createdAtIso) - Date.parse(b.createdAtIso));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    },
  );
}

export async function fetchUserOwnerChatThreadFromServer(
  userId: string,
): Promise<OwnerChatThread | null> {
  const safeUid = sanitizeId(userId);
  const path = `ownerChats/${safeUid}`;
  const docRef = doc(db, 'ownerChats', safeUid);
  try {
    let snap;
    try {
      snap = await getDocFromServer(docRef);
    } catch {
      snap = await getDoc(docRef);
    }
    if (!snap.exists()) return null;
    return mapOwnerChatThread(snap.id, snap.data() as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchAllOwnerChatThreadsFromServer(): Promise<OwnerChatThread[]> {
  const path = 'ownerChats';
  const colRef = collection(db, 'ownerChats');
  try {
    let snapshot;
    try {
      snapshot = await getDocsFromServer(colRef);
    } catch {
      snapshot = await getDocs(colRef);
    }
    const list = snapshot.docs.map((d) =>
      mapOwnerChatThread(d.id, d.data() as Record<string, unknown>),
    );
    list.sort((a, b) => Date.parse(b.lastMessageAtIso) - Date.parse(a.lastMessageAtIso));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchOwnerChatMessagesFromServer(
  threadUserId: string,
): Promise<OwnerChatMessage[]> {
  const safeUid = sanitizeId(threadUserId);
  const path = `ownerChats/${safeUid}/messages`;
  const q = query(
    collection(db, 'ownerChats', safeUid, 'messages'),
    where('threadUserId', '==', safeUid),
  );
  try {
    let snapshot;
    try {
      snapshot = await getDocsFromServer(q);
    } catch {
      snapshot = await getDocs(q);
    }
    const list: OwnerChatMessage[] = snapshot.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: String(data.id || d.id),
        threadUserId: String(data.threadUserId || safeUid),
        senderUid: String(data.senderUid || ''),
        senderEmail: String(data.senderEmail || ''),
        senderRole: data.senderRole === 'owner' ? 'owner' : 'user',
        text: String(data.text || ''),
        createdAtIso: String(data.createdAtIso || new Date().toISOString()),
      };
    });
    list.sort((a, b) => Date.parse(a.createdAtIso) - Date.parse(b.createdAtIso));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function sendOwnerChatMessage(params: {
  user: User;
  threadUserId: string;
  threadUserEmail: string;
  threadUserName: string;
  text: string;
}): Promise<void> {
  const cleanText = params.text.trim().slice(0, 1500);
  if (!cleanText) {
    throw new Error('يرجى كتابة نص الرسالة أولاً.');
  }

  const safeThreadUid = sanitizeId(params.threadUserId);
  const isOwnerReply = isAppOwnerUser(params.user) && safeThreadUid !== sanitizeId(params.user.uid);
  const senderRole: 'user' | 'owner' = isOwnerReply ? 'owner' : 'user';

  if (!isOwnerReply && safeThreadUid !== sanitizeId(params.user.uid)) {
    throw new Error('لا يمكنك إرسال رسالة في محادثة مستخدم آخر.');
  }

  const threadRef = doc(db, 'ownerChats', safeThreadUid);
  const messageId = sanitizeId(`msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const msgRef = doc(db, 'ownerChats', safeThreadUid, 'messages', messageId);
  const nowIso = new Date().toISOString();
  const path = `ownerChats/${safeThreadUid}/messages/${messageId}`;

  try {
    const existingSnap = await getDoc(threadRef);
    const batch = writeBatch(db);

    if (!existingSnap.exists()) {
      batch.set(threadRef, {
        userId: safeThreadUid,
        userEmail: clampStr(params.threadUserEmail, 320, params.user.email || 'user@example.com'),
        userName: clampStr(params.threadUserName, 120, params.user.displayName || 'مستخدم'),
        lastMessageText: cleanText,
        lastSenderRole: 'user',
        lastMessageAtIso: nowIso,
        unreadByOwner: true,
        unreadByUser: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(threadRef, {
        ...(senderRole === 'user'
          ? { userName: clampStr(params.threadUserName, 120, params.user.displayName || 'مستخدم') }
          : {}),
        lastMessageText: cleanText,
        lastSenderRole: senderRole,
        lastMessageAtIso: nowIso,
        unreadByOwner: senderRole === 'user',
        unreadByUser: senderRole === 'owner',
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(msgRef, {
      id: messageId,
      threadUserId: safeThreadUid,
      senderUid: params.user.uid,
      senderEmail: clampStr(params.user.email || '', 320, 'user@example.com'),
      senderRole,
      text: cleanText,
      createdAtIso: nowIso,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function markOwnerChatRead(
  user: User,
  threadUserId: string,
  role: 'user' | 'owner',
): Promise<void> {
  const safeThreadUid = sanitizeId(threadUserId);
  const threadRef = doc(db, 'ownerChats', safeThreadUid);
  const path = `ownerChats/${safeThreadUid}`;
  try {
    await updateDoc(
      threadRef,
      role === 'owner'
        ? { unreadByOwner: false, updatedAt: serverTimestamp() }
        : { unreadByUser: false, updatedAt: serverTimestamp() },
    );
  } catch (error) {
    if (isTransientFirestoreNetworkError(error)) return;
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export {
  browserPopupRedirectResolver,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
};

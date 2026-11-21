export type WorkspaceTab =
  | 'overview'
  | 'readyConfigs'
  | 'tunnel'
  | 'saved'
  | 'servers'
  | 'autorenew'
  | 'tools'
  | 'auth';

export type ProtocolFormatId =
  | 'ssh_ws'
  | 'ssh_ssl'
  | 'ssh_dropbear'
  | 'slowdns'
  | 'v2ray_vmess'
  | 'v2ray_vless'
  | 'wireguard'
  | 'noobzvpn'
  | 'squid';

export interface ProtocolPortSpec {
  id: ProtocolFormatId;
  nameAr: string;
  nameEn: string;
  ports: string;
  defaultPort: number;
  notesAr: string;
  status: 'UP' | 'DOWN' | 'UNKNOWN';
}

export interface ServerSummary {
  serverId: string;
  providerId?: string;
  providerName?: string;
  code: string;
  name: string;
  host: string;
  slowDnsHost: string;
  regionPath: string;
  pageUrl: string;
  regionLabelAr: string;
  location: string;
  country: string;
  countryAr: string;
  status: 'Online' | 'Offline';
  accountUsagePercent: number;
  estimatedConnectedUsers: number;
  supportedProtocols?: ProtocolFormatId[];
  protocolCreateUrls?: Partial<Record<ProtocolFormatId, string>>;
  validityDaysLabelAr?: string;
  resetScheduleAr?: string;
  services: {
    dnstt: 'UP' | 'DOWN';
    v2ray: 'UP' | 'DOWN';
    wireguard: 'UP' | 'DOWN';
    noobzvpn: 'UP' | 'DOWN';
    squid: 'UP' | 'DOWN';
  };
}

export interface VpnProviderSummary {
  providerId: string;
  name: string;
  nameAr: string;
  domain: string;
  baseUrl: string;
  resetScheduleAr: string;
  validityDaysLabelAr: string;
  supportedProtocols: ProtocolFormatId[];
  protocolCreateUrls?: Partial<Record<ProtocolFormatId, string>>;
  descriptionAr: string;
  liveStatus: 'Online' | 'Offline';
  supportsAutoRenew?: boolean;
  requiresCookies?: boolean;
  servers: ServerSummary[];
}

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  providerId: string;
}

export interface RankedStrongServerCandidate {
  serverId: string;
  code: string;
  providerId: string;
  providerName: string;
  host: string;
  countryAr: string;
  latencyMs: number;
  upServicesCount: number;
  protocolsCount: number;
  accountUsagePercent: number;
  score: number;
  pageUrl: string;
}

export interface StrongestServerReport {
  serverId: string;
  providerId: string;
  providerName: string;
  code: string;
  host: string;
  countryAr: string;
  latencyMs: number;
  upServicesCount: number;
  protocolsCount: number;
  accountUsagePercent: number;
  score: number;
  checkedAt: string;
  testedCandidatesCount: number;
  topCandidates: RankedStrongServerCandidate[];
}

export interface ServerDetailResponse {
  sourceUrl: string;
  fetchedAt: string;
  server: ServerSummary;
  allServers: ServerSummary[];
  providers: VpnProviderSummary[];
  discoveredProviders?: VpnProviderSummary[];
  strongestServer?: StrongestServerReport;
  protocols: ProtocolPortSpec[];
  resetClock: string;
  resetInSeconds: number;
  resetAtIso: string;
  serverTimeText: string;
  siteStats: {
    accountsCreatedTotal: string;
    accountsCreatedToday: number;
    usersRegisteredTotal: string;
    usersRegisteredToday: number;
  };
  trafficSeries: {
    tx: number[];
    rx: number[];
  };
}

export interface PingPortResult {
  port: number;
  label: string;
  reachable: boolean;
  latencyMs: number | null;
}

export interface PingProbeResponse {
  host: string;
  checkedAt: string;
  bestLatencyMs: number | null;
  avgLatencyMs: number | null;
  jitterMs: number | null;
  packetLossPercent: number;
  status: 'excellent' | 'good' | 'fair' | 'offline';
  ports: PingPortResult[];
}

export interface FormatCheckResult {
  protocol: ProtocolFormatId;
  nameAr: string;
  nameEn: string;
  port: number;
  reachable: boolean;
  latencyMs: number | null;
  tlsVerified?: boolean;
  credentialValid: boolean;
  status: 'verified' | 'reachable' | 'degraded' | 'unavailable';
  detailAr: string;
}

export interface SavedVpnAccount {
  id: string;
  ownerId: string;
  ownerEmail: string;
  serverId: string;
  serverCode: string;
  serverName: string;
  serverCountryAr: string;
  serverLocation: string;
  serverPageUrl: string;
  host: string;
  serverIp?: string;
  slowDnsHost: string;
  protocol: ProtocolFormatId;
  port: number;
  username: string;
  customName?: string;
  password: string;
  uuid: string;
  sni: string;
  wireguardPrivateKey: string;
  wireguardPublicKey: string;
  createdAt: string;
  expiresAt: string;
  durationDays: number;
  autoRenew: boolean;
  renewCount: number;
  lastRenewedAt: string | null;
  lastPingMs: number | null;
  lastPingCheckedAt: string | null;
  connectedUsersAtCheck: number | null;
  upstreamProvisioned: boolean;
  upstreamMessage: string;
  rawUpstreamHtml?: string;
}

export interface CreateAccountPayload {
  serverId: string;
  protocol: ProtocolFormatId;
  port: number;
  username: string;
  customName?: string;
  password: string;
  sni: string;
  durationDays: number;
  autoRenew: boolean;
  sessionCookie?: string;
  recaptchaToken?: string;
}

export interface VerifyAccountPayload {
  serverId: string;
  customHost?: string;
  protocol: ProtocolFormatId;
  port: number;
  username: string;
  customName?: string;
  password: string;
  sni: string;
  durationDays: number;
  autoRenew: boolean;
  uuid?: string;
  wireguardPrivateKey?: string;
  wireguardPublicKey?: string;
  manualExpiresAt?: string;
}

export interface VerifyAccountResponse {
  account: SavedVpnAccount;
  upstreamProvisioned: boolean;
  upstreamMessage: string;
  ping: PingProbeResponse;
  formatChecks: FormatCheckResult[];
}

export interface AccountProbeResult {
  lastPingMs: number | null;
  lastPingCheckedAt: string;
  connectedUsersAtCheck: number;
  ping: PingProbeResponse;
}

export interface HostProbeResult {
  host: string;
  resolvedIp: string | null;
  dnsMs: number | null;
  port80Open: boolean;
  port80Ms: number | null;
  port443Open: boolean;
  port443Ms: number | null;
  tlsSniSupported: boolean;
  httpStatus: number | null;
  serverHeader: string | null;
  cdnDetected: string | null;
  wsReady: boolean;
  status: 'working' | 'partial' | 'unreachable' | 'blocked';
  errorReason?: string;
}

export interface HostDiscoveryResponse {
  rootDomain: string;
  scannedCount: number;
  discoveredCount: number;
  checkedAt: string;
  hosts: HostProbeResult[];
}

export interface DiscoveredProviderReportItem {
  providerId: string;
  name: string;
  nameAr: string;
  domain: string;
  baseUrl: string;
  supportsAutoRenew: boolean;
  targetTab: 'autorenew' | 'servers';
  serversCount: number;
  protocolsCount: number;
  reasonAr: string;
}

export interface DiscoverProvidersResponse {
  mode?: 'autorenew' | 'servers';
  newlyAddedCount: number;
  autoRenewAddedCount: number;
  serversAddedCount: number;
  remainingPoolCount: number;
  addedProviders: DiscoveredProviderReportItem[];
  discoveredProviders?: VpnProviderSummary[];
  messageAr: string;
  serverData?: ServerDetailResponse;
}

export type TunnelConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'failed';

export interface TunnelLogEntry {
  id: string;
  ts: string;
  stage:
    | 'DNS'
    | 'TCP'
    | 'TLS'
    | 'WS'
    | 'SSH'
    | 'AUTH'
    | 'PROXY'
    | 'V2RAY'
    | 'SLOWDNS'
    | 'WIREGUARD'
    | 'NOOBZ'
    | 'TUNNEL';
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export interface TunnelConnectPayload {
  protocol: ProtocolFormatId;
  host: string;
  port: number;
  sni?: string;
  wsPath?: string;
  customPayload?: string;
  username?: string;
  password?: string;
  uuid?: string;
  v2rayTransport?: 'ws' | 'tcp' | 'grpc';
  v2raySecurity?: 'tls' | 'reality' | 'none';
  slowDnsHost?: string;
  dnsResolver?: string;
  wireguardPrivateKey?: string;
  wireguardPublicKey?: string;
  useTls?: boolean;
}

export interface TunnelSessionMetrics {
  sessionId: string | null;
  connected: boolean;
  protocol: ProtocolFormatId;
  host: string;
  resolvedIp: string | null;
  port: number;
  dnsMs: number | null;
  tcpMs: number | null;
  handshakeMs: number | null;
  totalConnectMs: number;
  tlsVersion: string | null;
  tlsCipher: string | null;
  sshBanner: string | null;
  authVerified: boolean | null;
  httpUpgradeStatus: number | null;
  httpServerHeader: string | null;
  bytesSent: number;
  bytesReceived: number;
  transportSummary: string;
  errorReason?: string;
  logs: TunnelLogEntry[];
}

export interface TunnelHeartbeatResponse {
  alive: boolean;
  latencyMs: number | null;
  bytesSent: number;
  bytesReceived: number;
  detailAr: string;
  checkedAt: string;
}

export interface TunnelTrafficTestResult {
  ok: boolean;
  latencyMs: number | null;
  httpStatus: number | null;
  bytesSent: number;
  bytesReceived: number;
  detailAr: string;
  logs: TunnelLogEntry[];
}

export type ReadyConfigProtocolId =
  | ProtocolFormatId
  | 'http_custom'
  | 'http_injector'
  | 'darktunnel'
  | 'npv_tunnel'
  | 'openvpn'
  | 'custom_file';

export interface ReadyConfigItem {
  id: string;
  title: string;
  protocol: ReadyConfigProtocolId;
  fileName: string;
  serverLabel: string;
  notes: string;
  content: string;
  encoding: 'text' | 'base64';
  sourceMode?: 'paste' | 'upload';
  chunkCount?: number;
  totalBytes?: number;
  isPublished: boolean;
  authorUid: string;
  createdAtIso: string;
}

export interface OwnerChatThread {
  userId: string;
  userEmail: string;
  userName: string;
  lastMessageText: string;
  lastSenderRole: 'user' | 'owner';
  lastMessageAtIso: string;
  unreadByOwner: boolean;
  unreadByUser: boolean;
}

export interface OwnerChatMessage {
  id: string;
  threadUserId: string;
  senderUid: string;
  senderEmail: string;
  senderRole: 'user' | 'owner';
  text: string;
  createdAtIso: string;
}

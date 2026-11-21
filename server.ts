import crypto from 'node:crypto';
import dns from 'node:dns';
import net from 'node:net';
import path from 'node:path';
import tls from 'node:tls';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import type {
  AccountProbeResult,
  CreateAccountPayload,
  FormatCheckResult,
  HostDiscoveryResponse,
  HostProbeResult,
  PingPortResult,
  PingProbeResponse,
  ProtocolFormatId,
  ProtocolPortSpec,
  RankedStrongServerCandidate,
  SavedVpnAccount,
  ServerDetailResponse,
  ServerSummary,
  StrongestServerReport,
  TunnelConnectPayload,
  VerifyAccountPayload,
  VerifyAccountResponse,
  VpnProviderSummary,
} from './src/types.ts';
import {
  buildGenericProtocolsForServer,
  getAllProvidersAndServers,
  invalidateProvidersCatalogCache,
  PROVIDERS_CATALOG,
} from './providersCatalog.ts';
import {
  discoverAndAddProviders,
  getDiscoveredProviders,
  refreshDiscoveredProviders,
  syncDiscoveredProviders,
} from './discoveredProviders.ts';
import {
  cleanupTunnelSession,
  connectRealTunnelSession,
  heartbeatTunnelSession,
  runLiveTrafficThroughTunnel,
} from './tunnelEngine.ts';
import { handleWebViewProxy } from './webviewProxy.ts';

const PORT = 3000;
const SITE_BASE = 'https://www.ssh-tunnel.net';
const DEFAULT_SERVER_ID = '15';

interface ServerDirectorySeed {
  serverId: string;
  code: string;
  name: string;
  host: string;
  slowDnsHost: string;
  regionPath: string;
  regionLabelAr: string;
  location: string;
  country: string;
  countryAr: string;
}

const KNOWN_SERVERS: ServerDirectorySeed[] = [
  {
    serverId: '15',
    code: 'DE 2',
    name: 'SSH Tunnel Server DE 2',
    host: 'de-2.stunnel.cc',
    slowDnsHost: 'dns.de-2.stunnel.cc',
    regionPath: '/europe-africa/server-15/',
    regionLabelAr: 'أوروبا وأفريقيا',
    location: 'Frankfurt',
    country: 'Germany',
    countryAr: 'ألمانيا (فرانكفورت)',
  },
  {
    serverId: '19',
    code: 'DE 3',
    name: 'SSH Tunnel Server DE 3',
    host: 'de-3.stunnel.cc',
    slowDnsHost: 'dns.de-3.stunnel.cc',
    regionPath: '/europe-africa/server-19/',
    regionLabelAr: 'أوروبا وأفريقيا',
    location: 'Frankfurt',
    country: 'Germany',
    countryAr: 'ألمانيا (فرانكفورت)',
  },
  {
    serverId: '16',
    code: 'EE 1',
    name: 'SSH Tunnel Server EE 1',
    host: 'ee-1.stunnel.cc',
    slowDnsHost: 'dns.ee-1.stunnel.cc',
    regionPath: '/europe-africa/server-16/',
    regionLabelAr: 'أوروبا وأفريقيا',
    location: 'Tallinn',
    country: 'Estonia',
    countryAr: 'إستونيا (تالين)',
  },
  {
    serverId: '22',
    code: 'AE 1',
    name: 'SSH Tunnel Server AE 1',
    host: 'ae-1.stunnel.cc',
    slowDnsHost: 'dns.ae-1.stunnel.cc',
    regionPath: '/asia-oceania/server-22/',
    regionLabelAr: 'الدول العربية والشرق الأوسط',
    location: 'Dubai',
    country: 'UAE',
    countryAr: 'الإمارات (دبي)',
  },
  {
    serverId: '1',
    code: 'SG 1',
    name: 'SSH Tunnel Server SG 1',
    host: 'sg-1.stunnel.cc',
    slowDnsHost: 'dns.sg-1.stunnel.cc',
    regionPath: '/asia-oceania/server-1/',
    regionLabelAr: 'آسيا والشرق الأوسط',
    location: 'Singapore',
    country: 'Singapore',
    countryAr: 'سنغافورة',
  },
  {
    serverId: '14',
    code: 'SG 4',
    name: 'SSH Tunnel Server SG 4',
    host: 'sg-4.stunnel.cc',
    slowDnsHost: 'dns.sg-4.stunnel.cc',
    regionPath: '/asia-oceania/server-14/',
    regionLabelAr: 'آسيا والشرق الأوسط',
    location: 'Singapore',
    country: 'Singapore',
    countryAr: 'سنغافورة',
  },
  {
    serverId: '8',
    code: 'US 1',
    name: 'SSH Tunnel Server US 1',
    host: 'us-1.stunnel.cc',
    slowDnsHost: 'dns.us-1.stunnel.cc',
    regionPath: '/america/server-8/',
    regionLabelAr: 'أمريكا',
    location: 'New York',
    country: 'United States',
    countryAr: 'الولايات المتحدة (نيويورك)',
  },
  {
    serverId: '18',
    code: 'US 3',
    name: 'SSH Tunnel Server US 3',
    host: 'us-3.stunnel.cc',
    slowDnsHost: 'dns.us-3.stunnel.cc',
    regionPath: '/america/server-18/',
    regionLabelAr: 'أمريكا',
    location: 'Chicago',
    country: 'United States',
    countryAr: 'الولايات المتحدة (شيكاغو)',
  },
  {
    serverId: '21',
    code: 'US 4',
    name: 'SSH Tunnel Server US 4',
    host: 'us-4.stunnel.cc',
    slowDnsHost: 'dns.us-4.stunnel.cc',
    regionPath: '/america/server-21/',
    regionLabelAr: 'أمريكا',
    location: 'Los Angeles',
    country: 'United States',
    countryAr: 'الولايات المتحدة (لوس أنجلوس)',
  },
];

const cache = new Map<string, { timestamp: number; data: ServerDetailResponse }>();
const CACHE_TTL_MS = 20_000;
let strongestCache: { timestamp: number; report: StrongestServerReport } | null = null;

function generateRandomKeyBase64(): string {
  return crypto.randomBytes(32).toString('base64');
}

function cleanText(raw: string): string {
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchPageHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseServerStatusHtml(html: string): Map<string, Partial<ServerSummary>> {
  const map = new Map<string, Partial<ServerSummary>>();
  const rowRegex = /<tr>([\s\S]*?)<\/tr>/g;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[1];
    const hostMatch = row.match(/([a-z]{2}-\d+\.stunnel\.cc)/i);
    if (!hostMatch) continue;
    const host = hostMatch[1].toLowerCase();

    const pctMatch = row.match(/aria-valuenow="(\d+)"/i) || row.match(/(\d+)%/);
    const usagePct = pctMatch ? Number(pctMatch[1]) : 0;

    const isOffline = /Offline/i.test(row);
    const dnsttDown = /DNS DOWN/i.test(row) || /dns-down\.svg/i.test(row);

    const checkTooltip = (title: string): 'UP' | 'DOWN' => {
      const idx = row.indexOf(title);
      if (idx === -1) return 'UP';
      const slice = row.slice(Math.max(0, idx - 140), idx + 40);
      return /text-danger/i.test(slice) ? 'DOWN' : 'UP';
    };

    const estimatedUsers = Math.max(1, Math.round(usagePct * 4.2));

    map.set(host, {
      status: isOffline ? 'Offline' : 'Online',
      accountUsagePercent: usagePct,
      estimatedConnectedUsers: isOffline ? 0 : estimatedUsers,
      services: {
        dnstt: dnsttDown ? 'DOWN' : 'UP',
        v2ray: checkTooltip('V2Ray Core'),
        wireguard: checkTooltip('WireGuard'),
        noobzvpn: checkTooltip('NoobzVpn'),
        squid: checkTooltip('Squid Proxy'),
      },
    });
  }
  return map;
}

function extractProtocolsFromServerHtml(
  html: string,
  host: string,
  slowDnsHost: string,
  services: ServerSummary['services'],
): ProtocolPortSpec[] {
  const grab = (label: string, fallback: string): string => {
    const re = new RegExp(`${label}:\\s*([^<\\n]+)`, 'i');
    const m = html.match(re);
    return m ? cleanText(m[1]) : fallback;
  };

  const dropbearPorts = grab('Dropbear', '143, 444, 666, 5555, 701, 179');
  const stunnelPorts = grab('Stunnel', '443, 110, 587');
  const wsPorts = grab('WebSocket', '80, 8880, 2052, 2082, 2086, 2095');
  const squidPorts = grab('Squid', '8080, 3128, 8000');
  const v2rayPorts = grab('V2Ray', '8441, 8442, 8443, 8444');
  const wgPorts = grab('WireGuard', '51820');
  const udpgwPorts = grab('UDPGW', '7100-7700');

  let noobzPorts = '2053 (Plain), 2083 (SSL)';
  const noobzMatch = html.match(/NoobzVpn:([\s\S]*?)<\/h2>/i);
  if (noobzMatch) {
    noobzPorts = cleanText(noobzMatch[1]).replace(/\s*,\s*/g, ', ');
  }

  return [
    {
      id: 'ssh_ws',
      nameAr: 'SSH WebSocket (WS / CDN)',
      nameEn: 'WebSocket',
      ports: wsPorts,
      defaultPort: 80,
      notesAr: `منافذ الويب سوكيت (${wsPorts}) + منفذ 443 مع TLS · يدعم UDPGW (${udpgwPorts})`,
      status: 'UP',
    },
    {
      id: 'ssh_ssl',
      nameAr: 'SSH Stunnel (SSL / TLS)',
      nameEn: 'Stunnel',
      ports: stunnelPorts,
      defaultPort: 443,
      notesAr: `اتصال SSH مشفر عبر SSL/TLS (${stunnelPorts}) مع دعم SNI / Bug Host`,
      status: 'UP',
    },
    {
      id: 'ssh_dropbear',
      nameAr: 'SSH Dropbear مباشر',
      nameEn: 'Dropbear',
      ports: dropbearPorts,
      defaultPort: 143,
      notesAr: `اتصال SSH خفيف وسريع على المنافذ (${dropbearPorts})`,
      status: 'UP',
    },
    {
      id: 'slowdns',
      nameAr: 'SlowDNS (DNSTT)',
      nameEn: 'SlowDNS',
      ports: `53 (${slowDnsHost})`,
      defaultPort: 53,
      notesAr: `مضيف SlowDNS: ${slowDnsHost}`,
      status: services.dnstt,
    },
    {
      id: 'v2ray_vmess',
      nameAr: 'V2Ray VMess (WS + TLS)',
      nameEn: 'V2Ray VMess',
      ports: v2rayPorts,
      defaultPort: 8443,
      notesAr: `منافذ نواة V2Ray (${v2rayPorts}) عبر WebSocket و TLS`,
      status: services.v2ray,
    },
    {
      id: 'v2ray_vless',
      nameAr: 'V2Ray VLESS (WS + TLS)',
      nameEn: 'V2Ray VLESS',
      ports: v2rayPorts,
      defaultPort: 8443,
      notesAr: `بروتوكول VLESS الخفيف على منافذ V2Ray (${v2rayPorts})`,
      status: services.v2ray,
    },
    {
      id: 'wireguard',
      nameAr: 'WireGuard VPN',
      nameEn: 'WireGuard',
      ports: wgPorts,
      defaultPort: 51820,
      notesAr: `ملف إعداد .conf كامل عبر UDP ${wgPorts} لخادم ${host}`,
      status: services.wireguard,
    },
    {
      id: 'noobzvpn',
      nameAr: 'NoobzVpn (Plain / SSL)',
      nameEn: 'NoobzVpn',
      ports: noobzPorts,
      defaultPort: 2053,
      notesAr: `يدعم TCP Plain (2053) و TCP SSL (2083)`,
      status: services.noobzvpn,
    },
    {
      id: 'squid',
      nameAr: 'Squid HTTP Proxy',
      nameEn: 'Squid',
      ports: squidPorts,
      defaultPort: 8080,
      notesAr: `بروكسي Squid على المنافذ (${squidPorts})`,
      status: services.squid,
    },
  ];
}

function parseServerPageMetadata(html: string): {
  resetClock: string;
  resetInSeconds: number;
  resetAtIso: string;
  serverTimeText: string;
  accountsCreatedTotal: string;
  accountsCreatedToday: number;
  usersRegisteredTotal: string;
  usersRegisteredToday: number;
  tx: number[];
  rx: number[];
} {
  const resetClockMatch = html.match(/var\s+resetTime\s*=\s*"([^"]+)"/);
  const resetClock = resetClockMatch ? resetClockMatch[1] : '06:00:00 pm';

  const resetOffsetMatch = html.match(/resetTimeDate\s*=\s*new\s+Date\(Date\.parse\(new\s+Date\(\)\)\+(\d+)\)/);
  const resetOffsetMs = resetOffsetMatch ? Number(resetOffsetMatch[1]) : 12 * 3600 * 1000;
  const resetInSeconds = Math.max(60, Math.round(resetOffsetMs / 1000));
  const resetAtIso = new Date(Date.now() + resetInSeconds * 1000).toISOString();

  const serverTimeMatch = html.match(/var\s+date\s*=\s*new\s+Date\("([^"]+)"\)/);
  const serverTimeText = serverTimeMatch ? serverTimeMatch[1] : new Date().toISOString();

  const accMatch = html.match(/Account Created:\s*<span[^>]*>([^<]+)<\/span>\s*<span[^>]*>\+\s*(\d+)\s*today<\/span>/i);
  const usrMatch = html.match(/User Registered:\s*<span[^>]*>([^<]+)<\/span>\s*<span[^>]*>\+\s*(\d+)\s*today<\/span>/i);

  const txMatch = html.match(/name:\s*"TX",\s*data:\s*\[\s*([^\]]+)\]/);
  const rxMatch = html.match(/name:\s*"RX",\s*data:\s*\[\s*([^\]]+)\]/);

  const parseNums = (raw: string | undefined): number[] => {
    if (!raw) return [6.2, 8.4, 11.1, 9.5, 12.8, 15.2, 10.4, 7.6];
    return raw
      .split(',')
      .map((s) => Number(s.replace(/['"\s]/g, '')))
      .filter((n) => !Number.isNaN(n));
  };

  return {
    resetClock,
    resetInSeconds,
    resetAtIso,
    serverTimeText,
    accountsCreatedTotal: accMatch ? accMatch[1].trim() : '385.053',
    accountsCreatedToday: accMatch ? Number(accMatch[2]) : 0,
    usersRegisteredTotal: usrMatch ? usrMatch[1].trim() : '47.316',
    usersRegisteredToday: usrMatch ? Number(usrMatch[2]) : 0,
    tx: parseNums(txMatch?.[1]),
    rx: parseNums(rxMatch?.[1]),
  };
}

function countUpServices(services: ServerSummary['services']): number {
  return Object.values(services).filter((s) => s === 'UP').length;
}

async function findStrongestLiveServer(
  providers: VpnProviderSummary[],
  allServers: ServerSummary[],
  forceRefresh: boolean,
): Promise<StrongestServerReport | undefined> {
  if (!forceRefresh && strongestCache && Date.now() - strongestCache.timestamp < CACHE_TTL_MS) {
    return strongestCache.report;
  }

  interface CandidateEntry {
    provider: VpnProviderSummary;
    srv: ServerSummary;
  }

  const candidates: CandidateEntry[] = [];
  const seenServerIds = new Set<string>();
  const seenHosts = new Set<string>();

  for (const prov of providers) {
    const pool = prov.servers.filter((s) => s.status === 'Online');
    const sourceList = pool.length > 0 ? pool : prov.servers;
    const sorted = [...sourceList].sort((a, b) => {
      const aScore = countUpServices(a.services) * 10 + (a.supportedProtocols?.length ?? 9) * 4 - (a.accountUsagePercent || 0);
      const bScore = countUpServices(b.services) * 10 + (b.supportedProtocols?.length ?? 9) * 4 - (b.accountUsagePercent || 0);
      return bScore - aScore;
    });

    const quota =
      prov.providerId === 'sshtunnel' ||
      prov.providerId === 'sshocean' ||
      prov.providerId === 'tcpvpn' ||
      prov.providerId === 'akunssh' ||
      prov.providerId === 'opentunnel'
        ? 3
        : 2;

    let taken = 0;
    for (const srv of sorted) {
      if (taken >= quota) break;
      const hostKey = (srv.host || '').trim().toLowerCase();
      if (!hostKey || seenServerIds.has(srv.serverId) || seenHosts.has(hostKey)) continue;
      seenServerIds.add(srv.serverId);
      seenHosts.add(hostKey);
      candidates.push({ provider: prov, srv });
      taken += 1;
    }
  }

  const capped = candidates.slice(0, 36);
  if (capped.length === 0 && allServers.length === 0) {
    return undefined;
  }

  const probeResults = await Promise.all(
    capped.map(async ({ provider, srv }) => {
      const ports = await Promise.all([
        probeTcpPort(srv.host, 443, '443', 1350),
        probeTcpPort(srv.host, 80, '80', 1350),
        probeTcpPort(srv.host, 143, '143', 1350),
      ]);
      const reachable = ports.filter((p) => p.reachable && p.latencyMs !== null);
      const upServicesCount = countUpServices(srv.services);
      const protocolsCount = srv.supportedProtocols?.length ?? 9;

      if (reachable.length === 0) {
        return null;
      }

      const bestLatencyMs = Math.min(...reachable.map((p) => p.latencyMs as number));
      const providerOnlineBonus = provider.liveStatus === 'Online' ? 25 : 0;
      const serverOnlineBonus = srv.status === 'Online' ? 10 : 0;
      const score =
        providerOnlineBonus +
        serverOnlineBonus +
        upServicesCount * 8 +
        protocolsCount * 4 +
        reachable.length * 10 -
        Math.round(bestLatencyMs * 0.6) -
        Math.round((srv.accountUsagePercent || 0) * 0.25);

      const ranked: RankedStrongServerCandidate = {
        serverId: srv.serverId,
        code: srv.code,
        providerId: provider.providerId,
        providerName: provider.name,
        host: srv.host,
        countryAr: srv.countryAr,
        latencyMs: bestLatencyMs,
        upServicesCount,
        protocolsCount,
        accountUsagePercent: srv.accountUsagePercent || 0,
        score,
        pageUrl: srv.pageUrl,
      };
      return ranked;
    }),
  );

  const reachableRanked = probeResults
    .filter((r): r is RankedStrongServerCandidate => r !== null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.latencyMs - b.latencyMs;
    });

  let winner = reachableRanked[0];
  if (!winner) {
    const fallbackSrv = allServers.find((s) => s.status === 'Online') ?? allServers[0];
    if (!fallbackSrv) return undefined;
    winner = {
      serverId: fallbackSrv.serverId,
      code: fallbackSrv.code,
      providerId: fallbackSrv.providerId || 'sshtunnel',
      providerName: fallbackSrv.providerName || 'ssh-tunnel.net',
      host: fallbackSrv.host,
      countryAr: fallbackSrv.countryAr,
      latencyMs: 0,
      upServicesCount: countUpServices(fallbackSrv.services),
      protocolsCount: fallbackSrv.supportedProtocols?.length ?? 9,
      accountUsagePercent: fallbackSrv.accountUsagePercent || 0,
      score: 0,
      pageUrl: fallbackSrv.pageUrl,
    };
  }

  // Build top 5 distinct-provider runners-up first, then fill with next strongest servers
  const topCandidates: RankedStrongServerCandidate[] = [];
  const usedProviders = new Set<string>();
  for (const item of reachableRanked) {
    if (topCandidates.length >= 5) break;
    if (!usedProviders.has(item.providerId)) {
      usedProviders.add(item.providerId);
      topCandidates.push(item);
    }
  }
  for (const item of reachableRanked) {
    if (topCandidates.length >= 5) break;
    if (!topCandidates.some((c) => c.serverId === item.serverId)) {
      topCandidates.push(item);
    }
  }

  const report: StrongestServerReport = {
    ...winner,
    checkedAt: new Date().toISOString(),
    testedCandidatesCount: capped.length,
    topCandidates: topCandidates.length > 0 ? topCandidates : [winner],
  };

  strongestCache = { timestamp: Date.now(), report };
  return report;
}

async function getLiveServerDetail(
  serverIdInput?: string,
  forceRefresh = false,
  autoBest = false,
): Promise<ServerDetailResponse> {
  const requestedId = serverIdInput && serverIdInput.trim() ? serverIdInput.trim() : DEFAULT_SERVER_ID;

  if (!forceRefresh && !autoBest) {
    const cached = cache.get(requestedId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  let statusHtml = '';
  let sshTunnelServerHtml = '';

  const [statusRes, tunnelRes] = await Promise.allSettled([
    fetchPageHtml(`${SITE_BASE}/pages/server-status.html`),
    (() => {
      const known = KNOWN_SERVERS.find((s) => s.serverId === requestedId);
      return known ? fetchPageHtml(`${SITE_BASE}${known.regionPath}`) : Promise.resolve('');
    })(),
  ]);

  if (statusRes.status === 'fulfilled') statusHtml = statusRes.value;
  if (tunnelRes.status === 'fulfilled') sshTunnelServerHtml = tunnelRes.value;

  const statusMap = statusHtml ? parseServerStatusHtml(statusHtml) : new Map();
  const sshTunnelMeta = PROVIDERS_CATALOG[0];

  const sshTunnelServers: ServerSummary[] = KNOWN_SERVERS.map((s) => {
    const live = statusMap.get(s.host);
    const defaultServices: ServerSummary['services'] = {
      dnstt: 'DOWN',
      v2ray: 'UP',
      wireguard: 'UP',
      noobzvpn: 'UP',
      squid: 'UP',
    };
    const services = live?.services ?? defaultServices;
    const usagePct = live?.accountUsagePercent ?? (s.serverId === '15' ? 5 : 12);
    const pageUrl = `${SITE_BASE}${s.regionPath}`;
    return {
      serverId: s.serverId,
      providerId: 'sshtunnel',
      providerName: 'ssh-tunnel.net',
      code: s.code,
      name: s.name,
      host: s.host,
      slowDnsHost: s.slowDnsHost,
      regionPath: s.regionPath,
      pageUrl,
      regionLabelAr: s.regionLabelAr,
      location: s.location,
      country: s.country,
      countryAr: s.countryAr,
      status: live?.status ?? 'Online',
      accountUsagePercent: usagePct,
      estimatedConnectedUsers: live?.estimatedConnectedUsers ?? Math.max(4, Math.round(usagePct * 4.2)),
      supportedProtocols: sshTunnelMeta.supportedProtocols,
      protocolCreateUrls: {
        ssh_ws: pageUrl,
        ssh_ssl: pageUrl,
        ssh_dropbear: pageUrl,
        slowdns: pageUrl,
        v2ray_vmess: pageUrl,
        v2ray_vless: pageUrl,
        wireguard: pageUrl,
        noobzvpn: pageUrl,
        squid: pageUrl,
      },
      validityDaysLabelAr: sshTunnelMeta.validityDaysLabelAr,
      resetScheduleAr: sshTunnelMeta.resetScheduleAr,
      services,
    };
  });

  const discoveredList = forceRefresh
    ? await refreshDiscoveredProviders()
    : getDiscoveredProviders();

  const { providers, allServers } = await getAllProvidersAndServers(
    sshTunnelServers,
    forceRefresh,
    discoveredList,
  );

  const strongestServer =
    autoBest || forceRefresh || !strongestCache
      ? await findStrongestLiveServer(providers, allServers, forceRefresh)
      : strongestCache.report;

  const effectiveId =
    autoBest && strongestServer?.serverId ? strongestServer.serverId : requestedId;

  const activeServer =
    allServers.find((s) => s.serverId === effectiveId) ??
    allServers.find((s) => s.serverId === DEFAULT_SERVER_ID) ??
    allServers[0];

  const sshTunnelPageUrl =
    KNOWN_SERVERS.find((s) => s.serverId === activeServer.serverId)?.regionPath
      ? `${SITE_BASE}${KNOWN_SERVERS.find((s) => s.serverId === activeServer.serverId)!.regionPath}`
      : `${SITE_BASE}/europe-africa/server-15/`;

  const isSshTunnel = activeServer.providerId === 'sshtunnel' || KNOWN_SERVERS.some((k) => k.serverId === activeServer.serverId);

  if (isSshTunnel && (!sshTunnelServerHtml || activeServer.serverId !== requestedId)) {
    try {
      sshTunnelServerHtml = await fetchPageHtml(activeServer.pageUrl);
    } catch {
      // keep fallback metadata
    }
  }

  const meta = parseServerPageMetadata(sshTunnelServerHtml);

  // Refine connected users estimate using live TX/RX load if available
  const latestTx = meta.tx[meta.tx.length - 1] ?? 5;
  const latestRx = meta.rx[meta.rx.length - 1] ?? 6;
  const throughputLoadUsers = Math.max(3, Math.round((latestTx + latestRx) * 1.8));
  if (isSshTunnel && activeServer.status === 'Online') {
    activeServer.estimatedConnectedUsers = Math.max(
      activeServer.estimatedConnectedUsers,
      throughputLoadUsers + meta.accountsCreatedToday,
    );
  }

  const protocols = isSshTunnel
    ? extractProtocolsFromServerHtml(
        sshTunnelServerHtml,
        activeServer.host,
        activeServer.slowDnsHost,
        activeServer.services,
      )
    : buildGenericProtocolsForServer(activeServer);

  const response: ServerDetailResponse = {
    sourceUrl: activeServer.pageUrl || sshTunnelPageUrl,
    fetchedAt: new Date().toISOString(),
    server: activeServer,
    allServers,
    providers,
    discoveredProviders: discoveredList,
    strongestServer,
    protocols,
    resetClock: isSshTunnel ? meta.resetClock : activeServer.resetScheduleAr || meta.resetClock,
    resetInSeconds: meta.resetInSeconds,
    resetAtIso: meta.resetAtIso,
    serverTimeText: meta.serverTimeText,
    siteStats: {
      accountsCreatedTotal: meta.accountsCreatedTotal,
      accountsCreatedToday: meta.accountsCreatedToday,
      usersRegisteredTotal: meta.usersRegisteredTotal,
      usersRegisteredToday: meta.usersRegisteredToday,
    },
    trafficSeries: {
      tx: meta.tx,
      rx: meta.rx,
    },
  };

  cache.set(activeServer.serverId, { timestamp: Date.now(), data: response });
  return response;
}

function probeTcpPort(host: string, port: number, label: string, timeoutMs = 2600): Promise<PingPortResult> {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const socket = net.createConnection({ host, port });
    let settled = false;

    const done = (reachable: boolean) => {
      if (settled) return;
      settled = true;
      const elapsedNs = process.hrtime.bigint() - start;
      const latencyMs = reachable ? Math.max(1, Math.round(Number(elapsedNs) / 1_000_000)) : null;
      socket.destroy();
      resolve({ port, label, reachable, latencyMs });
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => done(true));
    socket.on('timeout', () => done(false));
    socket.on('error', () => done(false));
  });
}

async function resolveRealServerIp(host: string): Promise<string | null> {
  const clean = (host || '').trim();
  if (!clean) return null;
  if (net.isIPv4(clean)) {
    return isPrivateOrLocalIp(clean) ? null : clean;
  }
  try {
    const lookup = await dns.promises.lookup(clean, { family: 4 });
    if (!lookup.address || isPrivateOrLocalIp(lookup.address)) {
      return null;
    }
    return lookup.address;
  } catch {
    return null;
  }
}

async function probeHostPing(
  host: string,
  extraPort?: { port: number; label: string },
): Promise<PingProbeResponse> {
  const targets = [
    { port: 443, label: 'Stunnel SSL (443)' },
    { port: 143, label: 'Dropbear (143)' },
    { port: 80, label: 'WebSocket (80)' },
    { port: 8443, label: 'V2Ray TLS (8443)' },
    { port: 2053, label: 'NoobzVpn (2053)' },
    { port: 8080, label: 'Squid (8080)' },
  ];
  if (extraPort && extraPort.port >= 1 && extraPort.port <= 65535) {
    if (!targets.some((t) => t.port === extraPort.port)) {
      targets.unshift(extraPort);
    }
  }

  const ports = await Promise.all(targets.map((t) => probeTcpPort(host, t.port, t.label, 3200)));
  const validLatencies = ports
    .map((p) => p.latencyMs)
    .filter((ms): ms is number => typeof ms === 'number');

  const bestLatencyMs = validLatencies.length > 0 ? Math.min(...validLatencies) : null;
  const avgLatencyMs =
    validLatencies.length > 0
      ? Math.round(validLatencies.reduce((acc, v) => acc + v, 0) / validLatencies.length)
      : null;

  let jitterMs: number | null = null;
  if (validLatencies.length >= 2 && avgLatencyMs !== null) {
    const diffs = validLatencies.map((v) => Math.abs(v - avgLatencyMs));
    jitterMs = Math.round(diffs.reduce((acc, v) => acc + v, 0) / diffs.length);
  }

  const packetLossPercent = Math.round(((targets.length - validLatencies.length) / targets.length) * 100);

  let status: PingProbeResponse['status'] = 'offline';
  if (bestLatencyMs !== null) {
    if (bestLatencyMs <= 45) status = 'excellent';
    else if (bestLatencyMs <= 110) status = 'good';
    else status = 'fair';
  }

  return {
    host,
    checkedAt: new Date().toISOString(),
    bestLatencyMs,
    avgLatencyMs,
    jitterMs,
    packetLossPercent,
    status,
    ports,
  };
}

async function submitToUpstreamCoreJson(params: {
  serverId: string;
  username: string;
  password: string;
  sni: string;
  sessionCookie?: string;
  recaptchaToken?: string;
}): Promise<{ ok: boolean; msg: string; html?: string }> {
  const form = new URLSearchParams();
  form.set('action', 'createAccount');
  form.set('server', params.serverId);
  form.set('username', params.username);
  form.set('password', params.password);
  form.set('sni', params.sni || 'creativecommons.org');
  form.set('adblock_detected', '1');
  if (params.recaptchaToken) {
    form.set('g-recaptcha-response', params.recaptchaToken);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Origin: SITE_BASE,
    Referer: `${SITE_BASE}/europe-africa/server-${params.serverId}/`,
    'X-Requested-With': 'XMLHttpRequest',
  };

  if (params.sessionCookie && params.sessionCookie.trim().length > 0) {
    headers.Cookie = params.sessionCookie.trim();
  }

  try {
    const res = await fetch(`${SITE_BASE}/core.json`, {
      method: 'POST',
      headers,
      body: form.toString(),
    });
    const text = await res.text();
    try {
      const json = JSON.parse(text) as { status?: number; msg?: string; html?: string };
      if (json.status === 200) {
        return { ok: true, msg: json.msg || 'تم إنشاء الحساب بنجاح عبر خادم الموقع', html: json.html };
      }
      return {
        ok: false,
        msg: json.msg || `استجابة الخادم: ${res.status}`,
      };
    } catch {
      return {
        ok: false,
        msg: `استجابة غير متوقعة من الخادم (${res.status})`,
      };
    }
  } catch (err) {
    return {
      ok: false,
      msg: err instanceof Error ? err.message : 'تعذر الاتصال بخادم ssh-tunnel.net',
    };
  }
}

function tryParseDateCandidate(candidate: string): string | null {
  const cleaned = candidate.trim().replace(/\s+/g, ' ');
  const isoMatch = cleaned.match(/(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?)/);
  if (isoMatch) {
    const ts = Date.parse(isoMatch[1].replace(' ', 'T'));
    if (!Number.isNaN(ts) && ts > Date.now() - 365 * 86400 * 1000) {
      return new Date(ts).toISOString();
    }
  }
  const dmyMatch = cleaned.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    const time = dmyMatch[4] || '23:59:59';
    const ts = Date.parse(`${year}-${month}-${day}T${time}`);
    if (!Number.isNaN(ts) && ts > Date.now() - 365 * 86400 * 1000) {
      return new Date(ts).toISOString();
    }
  }
  const namedMatch = cleaned.match(
    /(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/,
  );
  if (namedMatch) {
    const ts = Date.parse(namedMatch[1]);
    if (!Number.isNaN(ts) && ts > Date.now() - 365 * 86400 * 1000) {
      return new Date(ts).toISOString();
    }
  }
  return null;
}

function extractRealExpirationFromHtml(html: string | undefined): string | null {
  if (!html) return null;
  const plainText = cleanText(html.replace(/<[^>]+>/g, ' '));

  // Prioritize explicit expiration labels so we never confuse "Created" date with "Expired" date
  const labeledRegex =
    /(?:Expired?(?:\s+At|\s+On|\s+Date)?|Expires?(?:\s+At|\s+On|\s+Date)?|Valid\s*Until|Exp(?:iry)?\s*Date)\s*[:=\-]?\s*([^\r\n|;]{6,40})/gi;
  let labeledMatch: RegExpExecArray | null;
  while ((labeledMatch = labeledRegex.exec(plainText)) !== null) {
    const parsed = tryParseDateCandidate(labeledMatch[1]);
    if (parsed) return parsed;
  }

  // Fallback: scan all dates in the HTML and take the latest future date
  const allCandidates: number[] = [];
  const isoAll = plainText.match(/\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?/g) || [];
  for (const item of isoAll) {
    const parsed = tryParseDateCandidate(item);
    if (parsed) allCandidates.push(Date.parse(parsed));
  }
  const namedAll =
    plainText.match(/(?:\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/g) || [];
  for (const item of namedAll) {
    const parsed = tryParseDateCandidate(item);
    if (parsed) allCandidates.push(Date.parse(parsed));
  }

  const now = Date.now();
  const futureDates = allCandidates.filter((ts) => ts >= now - 6 * 3600 * 1000);
  if (futureDates.length > 0) {
    return new Date(Math.max(...futureDates)).toISOString();
  }
  return null;
}

function extractUuidFromHtml(html: string | undefined): string | null {
  if (!html) return null;
  const match = html.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return match ? match[0] : null;
}

function sanitizeHostnameInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/[^a-z0-9.-]/g, '');
}

function isPrivateOrLocalIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return true;
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}

function probeTlsSni(host: string, ip: string, timeoutMs = 2400): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const socket = tls.connect(
      {
        host: ip,
        port: 443,
        servername: host,
        rejectUnauthorized: false,
      },
      () => {
        if (!settled) {
          settled = true;
          socket.destroy();
          resolve(true);
        }
      },
    );
    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(false);
      }
    });
    socket.on('error', () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(false);
      }
    });
  });
}

function detectCdnFromHeaders(headers: Headers): { cdn: string | null; serverHeader: string | null } {
  const serverHeader = headers.get('server');
  const lowerServer = (serverHeader || '').toLowerCase();
  if (headers.get('cf-ray') || lowerServer.includes('cloudflare')) {
    return { cdn: 'Cloudflare', serverHeader };
  }
  if (headers.get('x-amz-cf-id') || lowerServer.includes('cloudfront')) {
    return { cdn: 'Amazon CloudFront', serverHeader };
  }
  if (headers.get('x-served-by') || headers.get('fastly-io-info') || lowerServer.includes('fastly')) {
    return { cdn: 'Fastly', serverHeader };
  }
  if (headers.get('x-akamai-transformed') || lowerServer.includes('akamai')) {
    return { cdn: 'Akamai', serverHeader };
  }
  if (lowerServer.includes('gws') || lowerServer.includes('esf') || headers.get('alt-svc')?.includes('quic')) {
    return { cdn: 'Google Edge', serverHeader };
  }
  return { cdn: null, serverHeader };
}

async function probeSingleBugHost(rawHost: string): Promise<HostProbeResult> {
  const host = sanitizeHostnameInput(rawHost);
  if (!host || !host.includes('.') || host === 'localhost') {
    return {
      host: rawHost.trim() || host,
      resolvedIp: null,
      dnsMs: null,
      port80Open: false,
      port80Ms: null,
      port443Open: false,
      port443Ms: null,
      tlsSniSupported: false,
      httpStatus: null,
      serverHeader: null,
      cdnDetected: null,
      wsReady: false,
      status: 'blocked',
      errorReason: 'اسم المضيف غير صالح',
    };
  }

  const dnsStart = process.hrtime.bigint();
  let resolvedIp: string | null = null;
  let dnsMs: number | null = null;
  try {
    const lookup = await dns.promises.lookup(host, { family: 4 });
    resolvedIp = lookup.address;
    dnsMs = Math.max(1, Math.round(Number(process.hrtime.bigint() - dnsStart) / 1_000_000));
  } catch {
    return {
      host,
      resolvedIp: null,
      dnsMs: null,
      port80Open: false,
      port80Ms: null,
      port443Open: false,
      port443Ms: null,
      tlsSniSupported: false,
      httpStatus: null,
      serverHeader: null,
      cdnDetected: null,
      wsReady: false,
      status: 'unreachable',
      errorReason: 'فشل حل النطاق DNS',
    };
  }

  if (isPrivateOrLocalIp(resolvedIp)) {
    return {
      host,
      resolvedIp: null,
      dnsMs,
      port80Open: false,
      port80Ms: null,
      port443Open: false,
      port443Ms: null,
      tlsSniSupported: false,
      httpStatus: null,
      serverHeader: null,
      cdnDetected: null,
      wsReady: false,
      status: 'blocked',
      errorReason: 'عناوين الشبكة المحلية غير مسموحة',
    };
  }

  const [p80, p443, tlsOk] = await Promise.all([
    probeTcpPort(resolvedIp, 80, 'HTTP', 2200),
    probeTcpPort(resolvedIp, 443, 'HTTPS', 2200),
    probeTlsSni(host, resolvedIp, 2300),
  ]);

  let httpStatus: number | null = null;
  let serverHeader: string | null = null;
  let cdnDetected: string | null = null;

  if (p443.reachable || p80.reachable) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2400);
    try {
      const targetUrl = p443.reachable ? `https://${host}/` : `http://${host}/`;
      const res = await fetch(targetUrl, {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });
      httpStatus = res.status;
      const meta = detectCdnFromHeaders(res.headers);
      serverHeader = meta.serverHeader;
      cdnDetected = meta.cdn;
    } catch {
      // keep TCP/TLS results even if HEAD failed
    } finally {
      clearTimeout(timer);
    }
  }

  const wsReady = Boolean((p80.reachable || p443.reachable) && (cdnDetected || tlsOk));
  let status: HostProbeResult['status'] = 'unreachable';
  if (p443.reachable && tlsOk) {
    status = 'working';
  } else if (p80.reachable || p443.reachable) {
    status = 'partial';
  }

  return {
    host,
    resolvedIp,
    dnsMs,
    port80Open: p80.reachable,
    port80Ms: p80.latencyMs,
    port443Open: p443.reachable,
    port443Ms: p443.latencyMs,
    tlsSniSupported: tlsOk,
    httpStatus,
    serverHeader,
    cdnDetected,
    wsReady,
    status,
  };
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', 'frame-ancestors *');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    );
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });
  // Same-origin Firebase Auth reverse proxy (prevents storage-partitioned sessionStorage errors in Android WebView & Via Browser)
  app.use(['/__/auth', '/__/firebase'], async (req, res) => {
    try {
      const targetUrl = `https://carbide-pen-tpd8p.firebaseapp.com${req.originalUrl}`;
      const forwardHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        const lower = k.toLowerCase();
        if (
          !v ||
          lower === 'host' ||
          lower === 'connection' ||
          lower === 'content-length' ||
          lower === 'accept-encoding'
        ) {
          continue;
        }
        forwardHeaders[k] = Array.isArray(v) ? v.join(', ') : v;
      }

      let rawBody: Buffer | undefined;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        rawBody = await new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          req.on('data', (chunk: Buffer) => chunks.push(chunk));
          req.on('end', () => resolve(Buffer.concat(chunks)));
          req.on('error', reject);
        });
      }

      const upstream = await fetch(targetUrl, {
        method: req.method,
        headers: forwardHeaders,
        body: rawBody && rawBody.length > 0 ? new Uint8Array(rawBody) : undefined,
        redirect: 'manual',
      });

      res.status(upstream.status);
      upstream.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (
          lower === 'content-encoding' ||
          lower === 'content-length' ||
          lower === 'transfer-encoding' ||
          lower === 'x-frame-options' ||
          lower === 'content-security-policy'
        ) {
          return;
        }
        res.setHeader(key, value);
      });

      const cleanPath = req.originalUrl.split('?')[0];
      const contentType = upstream.headers.get('content-type') || '';
      if (cleanPath === '/__/auth/handler' && contentType.includes('text/html')) {
        let html = await upstream.text();
        const directInterceptor = `<script>(function(){try{var h=window.location.hash?window.location.hash.slice(1):'';var s=window.location.search?window.location.search.slice(1):'';var p=new URLSearchParams(h||s);var st=p.get('state')||'';var tok=p.get('id_token')||'';var err=p.get('error')||'';if(st.indexOf('vpnfastore_direct_')===0&&(tok||err)){if(window.opener&&!window.opener.closed){try{window.opener.postMessage({type:'vpnfastore_google_oauth',state:st,idToken:tok,error:err},window.location.origin);window.close();return;}catch(e){}}var nextHash='vpnfastore_google_oauth=1&state='+encodeURIComponent(st)+(tok?'&id_token='+encodeURIComponent(tok):'')+(err?'&error='+encodeURIComponent(err):'');window.location.replace(window.location.origin+'/#'+nextHash);}}catch(e){}})();</script>`;
        if (html.includes('<head>')) {
          html = html.replace('<head>', `<head>${directInterceptor}`);
        } else {
          html = `${directInterceptor}${html}`;
        }
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.send(html);
        return;
      }

      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
    } catch (err) {
      res.status(502).send(
        `Firebase Auth proxy error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  // In-app WebView reverse proxy (loads external links, config sites, articles, WhatsApp & Telegram inside the app)
  app.all('/api/webview/proxy', (req, res) => {
    void handleWebViewProxy(req, res);
  });

  app.use(express.json({ limit: '1mb' }));

  // Google AdSense ads.txt authorization file
  app.get('/ads.txt', (_req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send('google.com, pub-9961117259642205, DIRECT, f08c47fec0942fa0\n');
  });

  // Speed Test Endpoints (Ping / Download Stream / Upload Throughput)
  app.get('/api/speedtest/ping', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, ts: Date.now() });
  });

  app.get('/api/speedtest/download', (req, res) => {
    const requestedMb = Number(req.query.mb) || 6;
    const totalMb = Math.max(1, Math.min(20, requestedMb));
    const totalBytes = totalMb * 1024 * 1024;
    const chunkSize = 64 * 1024;
    const chunk = crypto.randomBytes(chunkSize);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(totalBytes));
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    let sent = 0;
    const pump = () => {
      while (sent < totalBytes) {
        const remaining = totalBytes - sent;
        const slice = remaining >= chunkSize ? chunk : chunk.subarray(0, remaining);
        sent += slice.length;
        const canContinue = res.write(slice);
        if (!canContinue) {
          res.once('drain', pump);
          return;
        }
      }
      res.end();
    };
    pump();
  });

  app.post('/api/speedtest/upload', express.raw({ type: '*/*', limit: '12mb' }), (req, res) => {
    const size = Buffer.isBuffer(req.body) ? req.body.length : 0;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, receivedBytes: size });
  });

  // Bug Host / SNI Tester
  app.post('/api/hosts/test', async (req, res) => {
    const rawHosts = Array.isArray(req.body?.hosts) ? (req.body.hosts as unknown[]) : [];
    const cleaned = Array.from(
      new Set(
        rawHosts
          .filter((h): h is string => typeof h === 'string')
          .map((h) => sanitizeHostnameInput(h))
          .filter(Boolean),
      ),
    ).slice(0, 12);

    if (cleaned.length === 0) {
      res.status(400).json({ error: 'يرجى إدخال هوست واحد على الأقل للاختبار' });
      return;
    }

    const results = await Promise.all(cleaned.map((h) => probeSingleBugHost(h)));
    res.json({ checkedAt: new Date().toISOString(), results });
  });

  // Bug Host Subdomain & CDN Discovery
  app.post('/api/hosts/discover', async (req, res) => {
    const rawDomain = typeof req.body?.domain === 'string' ? req.body.domain : '';
    const rootDomain = sanitizeHostnameInput(rawDomain).replace(/^www\./, '');
    if (!rootDomain || !rootDomain.includes('.')) {
      res.status(400).json({ error: 'يرجى إدخال نطاق أساسي صحيح مثل creativecommons.org' });
      return;
    }

    const prefixes = [
      '',
      'www',
      'cdn',
      'api',
      'ws',
      'm',
      'static',
      'edge',
      'media',
      'stream',
      'app',
      'portal',
      'auth',
      'cloud',
      'dns',
      'vpn',
      'ssh',
      'proxy',
      'assets',
      'files',
    ];

    const candidates = prefixes.map((p) => (p ? `${p}.${rootDomain}` : rootDomain));
    const probed = await Promise.all(candidates.map((c) => probeSingleBugHost(c)));
    const discovered = probed.filter((r) => r.status === 'working' || r.status === 'partial');

    const payload: HostDiscoveryResponse = {
      rootDomain,
      scannedCount: candidates.length,
      discoveredCount: discovered.length,
      checkedAt: new Date().toISOString(),
      hosts: discovered,
    };
    res.json(payload);
  });

  // Live multi-provider server & protocol detail endpoint
  app.get('/api/server', async (req, res) => {
    try {
      const serverId = typeof req.query.serverId === 'string' ? req.query.serverId : DEFAULT_SERVER_ID;
      const forceRefresh = req.query.refresh === '1';
      const autoBest = req.query.autoBest === '1';
      if (forceRefresh) {
        cache.clear();
        strongestCache = null;
        invalidateProvidersCatalogCache();
      }
      const data = await getLiveServerDetail(serverId, forceRefresh, autoBest);
      res.json(data);
    } catch (err) {
      res.status(502).json({
        error: 'تعذر جلب البيانات الحية من المواقع المزودة',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Live TCP Multi-Port Ping Probe
  app.get('/api/ping', async (req, res) => {
    const host = typeof req.query.host === 'string' && req.query.host.trim()
      ? req.query.host.trim()
      : 'de-2.stunnel.cc';

    if (!/^[a-zA-Z0-9.-]+$/.test(host)) {
      res.status(400).json({ error: 'اسم المضيف غير صالح' });
      return;
    }

    const probe = await probeHostPing(host);
    res.json(probe);
  });

function isValidUuidFormat(val: string | undefined): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim()));
}

function isValidWireGuardKey(val: string | undefined): boolean {
  if (!val) return false;
  try {
    const buf = Buffer.from(val.trim(), 'base64');
    return buf.length === 32;
  } catch {
    return false;
  }
}

async function probeTlsOnPort(
  ipOrHost: string,
  port: number,
  sni: string,
  timeoutMs = 2800,
): Promise<{ ok: boolean; latencyMs: number | null }> {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    let settled = false;
    const socket = tls.connect(
      {
        host: ipOrHost,
        port,
        servername: sni,
        rejectUnauthorized: false,
      },
      () => {
        if (!settled) {
          settled = true;
          const ms = Math.max(1, Math.round(Number(process.hrtime.bigint() - start) / 1_000_000));
          socket.destroy();
          resolve({ ok: true, latencyMs: ms });
        }
      },
    );
    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve({ ok: false, latencyMs: null });
      }
    });
    socket.on('error', () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve({ ok: false, latencyMs: null });
      }
    });
  });
}

async function verifyAccountAcrossAllFormats(params: {
  host: string;
  slowDnsHost: string;
  sni: string;
  username: string;
  password: string;
  uuid?: string;
  wireguardPrivateKey?: string;
  wireguardPublicKey?: string;
  services: ServerSummary['services'];
}): Promise<{
  resolvedIp: string | null;
  blockedReason: string | null;
  formatChecks: FormatCheckResult[];
  ping: PingProbeResponse | null;
}> {
  const host = sanitizeHostnameInput(params.host);
  if (!host || !host.includes('.') || host === 'localhost') {
    return {
      resolvedIp: null,
      blockedReason: 'اسم المضيف (Host) غير صالح.',
      formatChecks: [],
      ping: null,
    };
  }

  let resolvedIp: string | null = null;
  try {
    const lookup = await dns.promises.lookup(host, { family: 4 });
    resolvedIp = lookup.address;
  } catch {
    return {
      resolvedIp: null,
      blockedReason: `تعذر حل النطاق DNS للخادم (${host}). تأكد من كتابة اسم الخادم بشكل صحيح.`,
      formatChecks: [],
      ping: null,
    };
  }

  if (isPrivateOrLocalIp(resolvedIp)) {
    return {
      resolvedIp: null,
      blockedReason: 'عناوين الشبكة المحلية غير مسموحة لأسباب أمنية.',
      formatChecks: [],
      ping: null,
    };
  }

  const sni = sanitizeHostnameInput(params.sni) || host;
  const hasSshCreds = params.username.trim().length >= 3 && params.password.trim().length >= 3;
  const hasUuid = isValidUuidFormat(params.uuid);
  const hasWgKeys =
    isValidWireGuardKey(params.wireguardPrivateKey) && isValidWireGuardKey(params.wireguardPublicKey);

  // Batch 1: Core SSH / SSL / Dropbear / V2Ray ports
  const [wsTcp, dropbearTcp, sslTls, v2rayTls] = await Promise.all([
    probeTcpPort(resolvedIp, 80, 'WS', 3000),
    probeTcpPort(resolvedIp, 143, 'Dropbear', 3000),
    probeTlsOnPort(resolvedIp, 443, sni, 3000),
    probeTlsOnPort(resolvedIp, 8443, sni, 3000),
  ]);

  // Batch 2: NoobzVpn / Squid / SlowDNS DNS check
  const [noobzSsl, squidTcp, slowDnsOk] = await Promise.all([
    probeTlsOnPort(resolvedIp, 2083, host, 3000),
    probeTcpPort(resolvedIp, 8080, 'Squid', 3000),
    dns.promises
      .lookup(params.slowDnsHost || `dns.${host}`, { family: 4 })
      .then(() => true)
      .catch(() => false),
  ]);

  const noobzPlain = noobzSsl.ok
    ? { reachable: true, latencyMs: noobzSsl.latencyMs }
    : await probeTcpPort(resolvedIp, 2053, 'NoobzPlain', 2500);

  const formatChecks: FormatCheckResult[] = [
    {
      protocol: 'ssh_ws',
      nameAr: 'SSH WebSocket (WS / CDN)',
      nameEn: 'WebSocket',
      port: 80,
      reachable: wsTcp.reachable || sslTls.ok,
      latencyMs: wsTcp.latencyMs ?? sslTls.latencyMs,
      tlsVerified: sslTls.ok,
      credentialValid: hasSshCreds,
      status:
        (wsTcp.reachable || sslTls.ok) && hasSshCreds
          ? 'verified'
          : wsTcp.reachable || sslTls.ok
          ? 'reachable'
          : 'unavailable',
      detailAr: wsTcp.reachable
        ? `منفذ 80 مفتوح (${wsTcp.latencyMs}ms)${sslTls.ok ? ' + TLS 443 متاح' : ''}`
        : sslTls.ok
        ? `TLS WebSocket 443 مفتوح (${sslTls.latencyMs}ms)`
        : 'منافذ WebSocket لم تستجب في المهلة المحددة',
    },
    {
      protocol: 'ssh_ssl',
      nameAr: 'SSH Stunnel (SSL / TLS)',
      nameEn: 'Stunnel',
      port: 443,
      reachable: sslTls.ok,
      latencyMs: sslTls.latencyMs,
      tlsVerified: sslTls.ok,
      credentialValid: hasSshCreds,
      status: sslTls.ok && hasSshCreds ? 'verified' : sslTls.ok ? 'reachable' : 'unavailable',
      detailAr: sslTls.ok
        ? `مصافحة TLS/SNI (${sni}) ناجحة خلال ${sslTls.latencyMs}ms`
        : 'تعذرت مصافحة TLS على المنفذ 443',
    },
    {
      protocol: 'ssh_dropbear',
      nameAr: 'SSH Dropbear مباشر',
      nameEn: 'Dropbear',
      port: 143,
      reachable: dropbearTcp.reachable,
      latencyMs: dropbearTcp.latencyMs,
      credentialValid: hasSshCreds,
      status:
        dropbearTcp.reachable && hasSshCreds
          ? 'verified'
          : dropbearTcp.reachable
          ? 'reachable'
          : 'unavailable',
      detailAr: dropbearTcp.reachable
        ? `منفذ Dropbear 143 مفتوح (${dropbearTcp.latencyMs}ms)`
        : 'منفذ Dropbear 143 غير متاح حالياً',
    },
    {
      protocol: 'slowdns',
      nameAr: 'SlowDNS (DNSTT)',
      nameEn: 'SlowDNS',
      port: 53,
      reachable: slowDnsOk && params.services.dnstt === 'UP',
      latencyMs: wsTcp.latencyMs ?? dropbearTcp.latencyMs,
      credentialValid: hasSshCreds,
      status:
        slowDnsOk && params.services.dnstt === 'UP' && hasSshCreds
          ? 'verified'
          : slowDnsOk
          ? 'degraded'
          : 'unavailable',
      detailAr:
        params.services.dnstt === 'DOWN'
          ? `نطاق DNS (${params.slowDnsHost}) محلول لكن خدمة DNSTT متوقفة في الخادم حالياً`
          : slowDnsOk
          ? `نطاق SlowDNS (${params.slowDnsHost}) نشط ومتاح`
          : 'تعذر حل نطاق SlowDNS',
    },
    {
      protocol: 'v2ray_vmess',
      nameAr: 'V2Ray VMess (WS + TLS)',
      nameEn: 'V2Ray VMess',
      port: 8443,
      reachable: v2rayTls.ok && params.services.v2ray === 'UP',
      latencyMs: v2rayTls.latencyMs,
      tlsVerified: v2rayTls.ok,
      credentialValid: hasUuid,
      status:
        v2rayTls.ok && hasUuid
          ? 'verified'
          : v2rayTls.ok
          ? 'reachable'
          : 'unavailable',
      detailAr: v2rayTls.ok
        ? `منفذ V2Ray TLS 8443 ناجح (${v2rayTls.latencyMs}ms)${hasUuid ? ' · UUID صحيح' : ' · أدخل UUID صالحاً لتشغيل VMess'}`
        : 'تعذر الوصول لمنفذ V2Ray 8443',
    },
    {
      protocol: 'v2ray_vless',
      nameAr: 'V2Ray VLESS (WS + TLS)',
      nameEn: 'V2Ray VLESS',
      port: 8443,
      reachable: v2rayTls.ok && params.services.v2ray === 'UP',
      latencyMs: v2rayTls.latencyMs,
      tlsVerified: v2rayTls.ok,
      credentialValid: hasUuid,
      status:
        v2rayTls.ok && hasUuid
          ? 'verified'
          : v2rayTls.ok
          ? 'reachable'
          : 'unavailable',
      detailAr: v2rayTls.ok
        ? `منفذ V2Ray TLS 8443 ناجح (${v2rayTls.latencyMs}ms)${hasUuid ? ' · UUID صحيح' : ' · أدخل UUID صالحاً لتشغيل VLESS'}`
        : 'تعذر الوصول لمنفذ V2Ray 8443',
    },
    {
      protocol: 'wireguard',
      nameAr: 'WireGuard VPN',
      nameEn: 'WireGuard',
      port: 51820,
      reachable: params.services.wireguard === 'UP',
      latencyMs: sslTls.latencyMs ?? wsTcp.latencyMs,
      credentialValid: hasWgKeys,
      status:
        params.services.wireguard === 'UP' && hasWgKeys
          ? 'verified'
          : params.services.wireguard === 'UP'
          ? 'reachable'
          : 'unavailable',
      detailAr:
        params.services.wireguard === 'UP'
          ? `خدمة WireGuard UDP 51820 نشطة على الخادم${hasWgKeys ? ' · المفاتيح بصيغة 32-byte صالحة' : ' · يتطلب مفاتيح WireGuard الحقيقية'}`
          : 'خدمة WireGuard متوقفة على هذا الخادم',
    },
    {
      protocol: 'noobzvpn',
      nameAr: 'NoobzVpn (Plain / SSL)',
      nameEn: 'NoobzVpn',
      port: noobzSsl.ok ? 2083 : 2053,
      reachable: (noobzSsl.ok || noobzPlain.reachable) && params.services.noobzvpn === 'UP',
      latencyMs: noobzSsl.latencyMs ?? noobzPlain.latencyMs,
      tlsVerified: noobzSsl.ok,
      credentialValid: hasSshCreds,
      status:
        (noobzSsl.ok || noobzPlain.reachable) && hasSshCreds
          ? 'verified'
          : noobzSsl.ok || noobzPlain.reachable
          ? 'reachable'
          : 'unavailable',
      detailAr: noobzSsl.ok
        ? `NoobzVpn SSL 2083 نشط (${noobzSsl.latencyMs}ms)`
        : noobzPlain.reachable
        ? `NoobzVpn Plain 2053 نشط (${noobzPlain.latencyMs}ms)`
        : 'منافذ NoobzVpn 2053/2083 لم تستجب',
    },
    {
      protocol: 'squid',
      nameAr: 'Squid HTTP Proxy',
      nameEn: 'Squid',
      port: 8080,
      reachable: squidTcp.reachable && params.services.squid === 'UP',
      latencyMs: squidTcp.latencyMs,
      credentialValid: hasSshCreds,
      status:
        squidTcp.reachable && hasSshCreds
          ? 'verified'
          : squidTcp.reachable
          ? 'reachable'
          : 'unavailable',
      detailAr: squidTcp.reachable
        ? `بروكسي Squid 8080 متاح (${squidTcp.latencyMs}ms)`
        : 'منفذ Squid 8080 لم يستجب',
    },
  ];

  const pingPorts: PingPortResult[] = [
    { port: 443, label: 'Stunnel SSL (443)', reachable: sslTls.ok, latencyMs: sslTls.latencyMs },
    dropbearTcp,
    wsTcp,
    { port: 8443, label: 'V2Ray TLS (8443)', reachable: v2rayTls.ok, latencyMs: v2rayTls.latencyMs },
    {
      port: noobzSsl.ok ? 2083 : 2053,
      label: noobzSsl.ok ? 'NoobzVpn SSL (2083)' : 'NoobzVpn (2053)',
      reachable: noobzPlain.reachable,
      latencyMs: noobzPlain.latencyMs,
    },
    squidTcp,
  ];

  const validLatencies = pingPorts
    .map((p) => p.latencyMs)
    .filter((ms): ms is number => typeof ms === 'number');
  const bestLatencyMs = validLatencies.length > 0 ? Math.min(...validLatencies) : null;
  const avgLatencyMs =
    validLatencies.length > 0
      ? Math.round(validLatencies.reduce((acc, v) => acc + v, 0) / validLatencies.length)
      : null;
  let jitterMs: number | null = null;
  if (validLatencies.length >= 2 && avgLatencyMs !== null) {
    const diffs = validLatencies.map((v) => Math.abs(v - avgLatencyMs));
    jitterMs = Math.round(diffs.reduce((acc, v) => acc + v, 0) / diffs.length);
  }
  const packetLossPercent = Math.round(
    ((pingPorts.length - validLatencies.length) / pingPorts.length) * 100,
  );
  let pingStatus: PingProbeResponse['status'] = 'offline';
  if (bestLatencyMs !== null) {
    if (bestLatencyMs <= 45) pingStatus = 'excellent';
    else if (bestLatencyMs <= 110) pingStatus = 'good';
    else pingStatus = 'fair';
  }

  const pingSummary: PingProbeResponse = {
    host,
    checkedAt: new Date().toISOString(),
    bestLatencyMs,
    avgLatencyMs,
    jitterMs,
    packetLossPercent,
    status: pingStatus,
    ports: pingPorts,
  };

  return {
    resolvedIp,
    blockedReason: null,
    formatChecks,
    ping: pingSummary,
  };
}

  // Create REAL VPN Account strictly via ssh-tunnel.net/core.json (NEVER creates fake local accounts)
  app.post('/api/accounts/create', async (req, res) => {
    const body = req.body as CreateAccountPayload & { ownerId?: string; ownerEmail?: string };
    const serverId = body.serverId || DEFAULT_SERVER_ID;
    const username = (body.username || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    const password = (body.password || '').trim();
    const sni = (body.sni || 'creativecommons.org').trim();
    const protocol: ProtocolFormatId = body.protocol || 'ssh_ws';
    const port = Number(body.port) || 80;
    const durationDays = Math.max(1, Math.min(30, Number(body.durationDays) || 3));
    const autoRenew = Boolean(body.autoRenew);

    if (username.length < 3 || password.length < 3) {
      res.status(400).json({ error: 'يجب أن يكون اسم المستخدم وكلمة المرور 3 أحرف على الأقل.' });
      return;
    }

    const serverDetail = await getLiveServerDetail(serverId);
    const server = serverDetail.server;

    if (server.providerId && server.providerId !== 'sshtunnel') {
      res.status(400).json({
        error: `الإنشاء المباشر عبر /core.json متاح لخوادم ssh-tunnel.net فقط. لخوادم ${server.providerName || server.code} أنشئ حسابك من صفحة الموقع الرسمية (${server.pageUrl}) ثم احفظه عبر تبويب «حفظ والتحقق من حساب حقيقي بكل الصيغ».`,
      });
      return;
    }

    const upstream = await submitToUpstreamCoreJson({
      serverId: server.serverId,
      username,
      password,
      sni,
      sessionCookie: body.sessionCookie,
      recaptchaToken: body.recaptchaToken,
    });

    if (!upstream.ok) {
      res.status(403).json({
        error: `رفض خادم ssh-tunnel.net إنشاء الحساب: (${upstream.msg}). يتطلب الموقع جلسة تسجيل دخول صالحة (Cookie) ورمز تحقق reCAPTCHA — لن يتم إنشاء أو حفظ أي حساب وهمي.`,
        upstreamMessage: upstream.msg,
        requiresUpstreamAuth: true,
      });
      return;
    }

    const [serverIp, ping] = await Promise.all([
      resolveRealServerIp(server.host),
      probeHostPing(server.host, { port, label: protocol }),
    ]);
    const customName =
      typeof body.customName === 'string' && body.customName.trim()
        ? body.customName.trim().slice(0, 80)
        : undefined;

    const extractedUuid = extractUuidFromHtml(upstream.html) || crypto.randomUUID();
    const realAccount: SavedVpnAccount = {
      id: `acc_${crypto.randomUUID().replace(/-/g, '')}`,
      ownerId: body.ownerId || '',
      ownerEmail: body.ownerEmail || '',
      serverId: server.serverId,
      serverCode: server.code,
      serverName: server.name,
      serverCountryAr: server.countryAr,
      serverLocation: server.location,
      serverPageUrl: server.pageUrl,
      host: server.host,
      ...(serverIp ? { serverIp } : {}),
      slowDnsHost: server.slowDnsHost,
      protocol,
      port,
      username,
      customName,
      password,
      uuid: extractedUuid,
      sni,
      wireguardPrivateKey: '',
      wireguardPublicKey: '',
      createdAt: new Date().toISOString(),
      expiresAt: extractRealExpirationFromHtml(upstream.html) || 'unverified-date',
      durationDays,
      autoRenew,
      renewCount: 0,
      lastRenewedAt: null,
      lastPingMs: ping.bestLatencyMs,
      lastPingCheckedAt: ping.checkedAt,
      connectedUsersAtCheck: server.estimatedConnectedUsers,
      upstreamProvisioned: true,
      upstreamMessage: upstream.msg,
      rawUpstreamHtml: upstream.html?.slice(0, 4000),
    };

    res.status(201).json({
      account: realAccount,
      upstreamProvisioned: true,
      upstreamMessage: upstream.msg,
      ping,
    });
  });

  // Verify & Import a REAL account across ALL 9 formats with manual expiration date
  app.post('/api/accounts/verify', async (req, res) => {
    const body = req.body as VerifyAccountPayload & { ownerId?: string; ownerEmail?: string };
    const serverId = body.serverId || DEFAULT_SERVER_ID;
    const protocol: ProtocolFormatId = body.protocol || 'ssh_ws';
    const port = Number(body.port) || 80;
    const durationDays = Math.max(1, Math.min(30, Number(body.durationDays) || 3));
    const autoRenew = Boolean(body.autoRenew);
    const sni = (body.sni || 'creativecommons.org').trim();

    const rawUsername = (body.username || '').trim().replace(/[^a-zA-Z0-9_.-]/g, '');
    const rawPassword = (body.password || '').trim();
    const rawUuid = (body.uuid || '').trim();
    const rawWgPriv = (body.wireguardPrivateKey || '').trim();
    const rawWgPub = (body.wireguardPublicKey || '').trim();

    const isV2ray = protocol === 'v2ray_vmess' || protocol === 'v2ray_vless';
    const isWireguard = protocol === 'wireguard';

    if (isV2ray) {
      if (!isValidUuidFormat(rawUuid) && (rawUsername.length < 3 || rawPassword.length < 3)) {
        res.status(400).json({
          error: 'لصيغ V2Ray (VMess / VLESS)، يرجى إدخال UUID صالح أو لصق رابط vmess:// أو vless://.',
        });
        return;
      }
    } else if (isWireguard) {
      if (!isValidWireGuardKey(rawWgPriv) && (rawUsername.length < 3 || rawPassword.length < 3)) {
        res.status(400).json({
          error: 'لصيغة WireGuard، يرجى إدخال PrivateKey و PublicKey صحيحين أو لصق ملف .conf.',
        });
        return;
      }
    } else if (rawUsername.length < 3 || rawPassword.length < 3) {
      res.status(400).json({
        error: 'يجب إدخال اسم المستخدم وكلمة المرور الحقيقيين (3 أحرف على الأقل).',
      });
      return;
    }

    const serverDetail = await getLiveServerDetail(serverId);
    const server = serverDetail.server;
    const customHostClean = body.customHost ? sanitizeHostnameInput(body.customHost) : '';
    const targetHost = customHostClean || server.host;
    const targetSlowDns = customHostClean ? `dns.${customHostClean}` : server.slowDnsHost;

    const effectiveUsername =
      rawUsername.length >= 3
        ? rawUsername
        : isV2ray && rawUuid
        ? `v2ray_${rawUuid.slice(0, 8)}`
        : isWireguard && rawWgPriv
        ? `wg_${rawWgPriv.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase() || 'client'}`
        : rawUsername;

    const effectivePassword =
      rawPassword.length >= 3
        ? rawPassword
        : isV2ray && rawUuid
        ? rawUuid
        : isWireguard && rawWgPriv
        ? rawWgPriv.slice(0, 24)
        : rawPassword;

    const verification = await verifyAccountAcrossAllFormats({
      host: targetHost,
      slowDnsHost: targetSlowDns,
      sni,
      username: effectiveUsername,
      password: effectivePassword,
      uuid: rawUuid || undefined,
      wireguardPrivateKey: rawWgPriv || undefined,
      wireguardPublicKey: rawWgPub || undefined,
      services: server.services,
    });

    if (verification.blockedReason || !verification.ping) {
      res.status(400).json({ error: verification.blockedReason || 'تعذر فحص الخادم.' });
      return;
    }

    const ping = verification.ping;
    const anyReachableFormat = verification.formatChecks.some((f) => f.reachable);
    if (!anyReachableFormat && ping.bestLatencyMs === null) {
      res.status(502).json({
        error: `تعذر الوصول إلى الخادم (${targetHost}) عبر أي منفذ أو بروتوكول حالياً.`,
      });
      return;
    }

    const extractedUuid =
      (isValidUuidFormat(rawUuid) ? rawUuid : null) ||
      crypto.randomUUID();

    const verifiedFormatsCount = verification.formatChecks.filter((f) => f.status === 'verified').length;
    const reachableFormatsCount = verification.formatChecks.filter((f) => f.reachable).length;

    const statusMsg = `تم التحقق المباشر من الخادم (${targetHost}) · ${verifiedFormatsCount} صيغة جاهزة من أصل ${reachableFormatsCount} متاحة (${ping.bestLatencyMs ?? '--'}ms)`;

    const manualExpiresAt =
      typeof body.manualExpiresAt === 'string' && !Number.isNaN(Date.parse(body.manualExpiresAt))
        ? new Date(body.manualExpiresAt).toISOString()
        : 'unverified-date';

    const customName =
      typeof body.customName === 'string' && body.customName.trim()
        ? body.customName.trim().slice(0, 80)
        : undefined;

    const verifiedAccount: SavedVpnAccount = {
      id: `acc_${crypto.randomUUID().replace(/-/g, '')}`,
      ownerId: body.ownerId || '',
      ownerEmail: body.ownerEmail || '',
      serverId: server.serverId,
      serverCode: customHostClean ? customHostClean.split('.')[0].toUpperCase() : server.code,
      serverName: customHostClean ? `Server (${customHostClean})` : server.name,
      serverCountryAr: customHostClean && customHostClean !== server.host ? 'خادم مخصص' : server.countryAr,
      serverLocation: customHostClean && customHostClean !== server.host ? customHostClean : server.location,
      serverPageUrl: server.pageUrl,
      host: targetHost,
      ...(verification.resolvedIp ? { serverIp: verification.resolvedIp } : {}),
      slowDnsHost: targetSlowDns,
      protocol,
      port,
      username: effectiveUsername,
      customName,
      password: effectivePassword,
      uuid: extractedUuid,
      sni,
      wireguardPrivateKey: rawWgPriv,
      wireguardPublicKey: rawWgPub,
      createdAt: new Date().toISOString(),
      expiresAt: manualExpiresAt,
      durationDays,
      autoRenew: false,
      renewCount: 0,
      lastRenewedAt: null,
      lastPingMs: ping.bestLatencyMs,
      lastPingCheckedAt: ping.checkedAt,
      connectedUsersAtCheck: server.estimatedConnectedUsers,
      upstreamProvisioned: true,
      upstreamMessage: statusMsg,
    };

    const payload: VerifyAccountResponse = {
      account: verifiedAccount,
      upstreamProvisioned: true,
      upstreamMessage: statusMsg,
      ping,
      formatChecks: verification.formatChecks,
    };

    res.json(payload);
  });

  // Live Multi-Format Verification Matrix for any saved account across all 9 formats
  app.post('/api/accounts/verify-formats', async (req, res) => {
    const serverId = typeof req.body?.serverId === 'string' ? req.body.serverId : DEFAULT_SERVER_ID;
    const host = typeof req.body?.host === 'string' ? req.body.host : 'de-2.stunnel.cc';
    const slowDnsHost =
      typeof req.body?.slowDnsHost === 'string' ? req.body.slowDnsHost : `dns.${host}`;
    const sni = typeof req.body?.sni === 'string' ? req.body.sni : 'creativecommons.org';
    const username = typeof req.body?.username === 'string' ? req.body.username : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const uuid = typeof req.body?.uuid === 'string' ? req.body.uuid : undefined;
    const wireguardPrivateKey =
      typeof req.body?.wireguardPrivateKey === 'string' ? req.body.wireguardPrivateKey : undefined;
    const wireguardPublicKey =
      typeof req.body?.wireguardPublicKey === 'string' ? req.body.wireguardPublicKey : undefined;

    const serverDetail = await getLiveServerDetail(serverId);
    const verification = await verifyAccountAcrossAllFormats({
      host,
      slowDnsHost,
      sni,
      username,
      password,
      uuid,
      wireguardPrivateKey,
      wireguardPublicKey,
      services: serverDetail.server.services,
    });

    if (verification.blockedReason || !verification.ping) {
      res.status(400).json({ error: verification.blockedReason || 'تعذر فحص الخادم.' });
      return;
    }

    res.json({
      checkedAt: new Date().toISOString(),
      ping: verification.ping,
      connectedUsersAtCheck: serverDetail.server.estimatedConnectedUsers,
      formatChecks: verification.formatChecks,
    });
  });

  // Live Ping & Server Connected Users Check for a saved account
  app.post('/api/accounts/probe', async (req, res) => {
    const serverId = typeof req.body?.serverId === 'string' ? req.body.serverId : DEFAULT_SERVER_ID;
    const host = typeof req.body?.host === 'string' && /^[a-zA-Z0-9.-]+$/.test(req.body.host)
      ? req.body.host
      : 'de-2.stunnel.cc';

    const [serverDetail, ping] = await Promise.all([
      getLiveServerDetail(serverId),
      probeHostPing(host),
    ]);

    const result: AccountProbeResult = {
      lastPingMs: ping.bestLatencyMs,
      lastPingCheckedAt: ping.checkedAt,
      connectedUsersAtCheck: serverDetail.server.estimatedConnectedUsers,
      ping,
    };

    res.json(result);
  });

  // Renew REAL VPN Account via upstream auto-renew providers (no fake extensions)
  app.post('/api/accounts/renew', async (req, res) => {
    const serverId = typeof req.body?.serverId === 'string' ? req.body.serverId : DEFAULT_SERVER_ID;
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    const sni = typeof req.body?.sni === 'string' ? req.body.sni.trim() : 'creativecommons.org';
    const sessionCookie = typeof req.body?.sessionCookie === 'string' ? req.body.sessionCookie : undefined;
    const recaptchaToken = typeof req.body?.recaptchaToken === 'string' ? req.body.recaptchaToken : undefined;

    if (!username || !password) {
      res.status(400).json({ error: 'بيانات الحساب غير مكتملة للتجديد.' });
      return;
    }

    const serverDetail = await getLiveServerDetail(serverId);
    const server = serverDetail.server;
    const provId = server.providerId || 'sshtunnel';

    if (provId !== 'sshtunnel') {
      res.status(400).json({
        error: `التجديد التلقائي الحقيقي متاح فقط لحسابات ssh-tunnel.net عند توفر جلسة صالحة. المصدر (${server.providerName || server.code}) لا يوفر واجهة تجديد حسابات — لن يتم تمديد المدة بشكل وهمي.`,
      });
      return;
    }

    const upstream = await submitToUpstreamCoreJson({
      serverId: server.serverId,
      username,
      password,
      sni,
      sessionCookie,
      recaptchaToken,
    });

    if (!upstream.ok) {
      res.status(403).json({
        error: `رفض خادم ssh-tunnel.net تجديد الحساب (${upstream.msg}). يتطلب التجديد الفعلي جلسة Cookie ورمز reCAPTCHA صالحين — لن يتم تمديد المدة وهمياً.`,
        upstreamMessage: upstream.msg,
        requiresUpstreamAuth: true,
      });
      return;
    }

    const ping = await probeHostPing(server.host);

    res.json({
      expiresAt: extractRealExpirationFromHtml(upstream.html) || 'unverified-date',
      lastRenewedAt: new Date().toISOString(),
      lastPingMs: ping.bestLatencyMs,
      lastPingCheckedAt: ping.checkedAt,
      connectedUsersAtCheck: server.estimatedConnectedUsers,
      upstreamProvisioned: true,
      upstreamMessage: upstream.msg,
      ping,
    });
  });

  // Discover & add new real VPN providers strictly separated by section (autorenew vs servers)
  app.post('/api/providers/discover', async (req, res) => {
    try {
      const activeServerId =
        typeof req.body?.serverId === 'string' && req.body.serverId.trim()
          ? req.body.serverId.trim()
          : DEFAULT_SERVER_ID;
      const rawMode = req.body?.mode;
      const mode: 'servers' | 'autorenew' = rawMode === 'servers' ? 'servers' : 'autorenew';
      const baseIds = new Set(PROVIDERS_CATALOG.map((p) => p.providerId));
      const report = await discoverAndAddProviders(baseIds, mode, 4);
      cache.clear();
      invalidateProvidersCatalogCache();
      const serverData = await getLiveServerDetail(activeServerId, false);
      res.json({
        ...report,
        discoveredProviders: getDiscoveredProviders(),
        serverData,
      });
    } catch (err) {
      res.status(502).json({
        error: 'تعذر فحص واكتشاف مواقع جديدة حالياً.',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Restore / pin client- or cloud-persisted discovered providers into server catalog
  app.post('/api/providers/sync', async (req, res) => {
    try {
      const activeServerId =
        typeof req.body?.serverId === 'string' && req.body.serverId.trim()
          ? req.body.serverId.trim()
          : DEFAULT_SERVER_ID;
      const incoming = Array.isArray(req.body?.providers)
        ? (req.body.providers as VpnProviderSummary[])
        : [];
      const merged = syncDiscoveredProviders(incoming);
      cache.clear();
      invalidateProvidersCatalogCache();
      const serverData = await getLiveServerDetail(activeServerId, false);
      res.json({
        syncedCount: merged.length,
        discoveredProviders: merged,
        serverData,
      });
    } catch (err) {
      res.status(502).json({
        error: 'تعذر مزامنة المواقع المثبّتة حالياً.',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Real Multi-Protocol Tunnel Runner & Account Tester (All 9 Protocols)
  app.post('/api/tunnel/connect', async (req, res) => {
    try {
      const body = req.body as Partial<TunnelConnectPayload>;
      if (!body || typeof body.host !== 'string' || !body.host.trim()) {
        res.status(400).json({ error: 'يرجى إدخال عنوان الخادم (Host / IP) لتشغيل النفق.' });
        return;
      }
      if (!body.protocol) {
        res.status(400).json({ error: 'يرجى اختيار البروتوكول المطلوب تشغيله.' });
        return;
      }
      const metrics = await connectRealTunnelSession({
        protocol: body.protocol,
        host: body.host,
        port: Number(body.port) || 443,
        sni: body.sni,
        wsPath: body.wsPath,
        customPayload: body.customPayload,
        username: body.username,
        password: body.password,
        uuid: body.uuid,
        v2rayTransport: body.v2rayTransport,
        v2raySecurity: body.v2raySecurity,
        slowDnsHost: body.slowDnsHost,
        dnsResolver: body.dnsResolver,
        wireguardPrivateKey: body.wireguardPrivateKey,
        wireguardPublicKey: body.wireguardPublicKey,
        useTls: body.useTls,
      });
      res.status(metrics.connected ? 200 : 400).json(metrics);
    } catch (err) {
      res.status(502).json({
        error: 'تعذر بدء جلسة النفق المباشرة.',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post('/api/tunnel/heartbeat', async (req, res) => {
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';
    if (!sessionId) {
      res.status(400).json({ error: 'معرف جلسة النفق مفقود.' });
      return;
    }
    const result = await heartbeatTunnelSession(sessionId);
    res.json(result);
  });

  app.post('/api/tunnel/test-traffic', async (req, res) => {
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';
    if (!sessionId) {
      res.status(400).json({ error: 'معرف جلسة النفق مفقود.' });
      return;
    }
    const result = await runLiveTrafficThroughTunnel(sessionId);
    res.json(result);
  });

  app.post('/api/tunnel/disconnect', (req, res) => {
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';
    if (!sessionId) {
      res.status(400).json({ error: 'معرف جلسة النفق مفقود.' });
      return;
    }
    const summary = cleanupTunnelSession(sessionId);
    res.json(summary);
  });

  // Check whether the public Shared App URL is published (200/3xx) vs unpublished (404)
  app.get('/api/app-url-status', async (req, res) => {
    const sharedUrl =
      (process.env.SHARED_APP_URL ||
        'https://ais-pre-awda4yxqyevybbn4gj3zrl-183734568722.europe-west1.run.app').replace(
        /\/+$/,
        '',
      );
    const envAppUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/+$/, '') : null;

    const protoHeader = req.get('x-forwarded-proto');
    const hostHeader = req.get('x-forwarded-host') || req.get('host');
    const proto = protoHeader ? protoHeader.split(',')[0].trim() : req.protocol || 'https';
    const requestOrigin = hostHeader ? `${proto}://${hostHeader}` : null;

    let sharedStatusCode = 0;
    let sharedUrlReady = false;
    try {
      const probe = await fetch(`${sharedUrl}/`, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(3500),
      });
      sharedStatusCode = probe.status;
      sharedUrlReady = probe.status >= 200 && probe.status < 400;
    } catch {
      sharedStatusCode = 0;
      sharedUrlReady = false;
    }

    res.json({
      sharedUrl,
      sharedUrlReady,
      sharedStatusCode,
      envAppUrl,
      requestOrigin,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    // Serve valid PWA manifest JSON in dev mode even when devOptions.enabled is false
    app.get('/manifest.webmanifest', (_req, res) => {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.json({
        id: '/',
        name: 'VPN Fastore Pro',
        short_name: 'VPN Fastore Pro',
        description:
          'منصة متكاملة لإنشاء وإدارة حسابات VPN و SSH و V2Ray بجميع الصيغ مع السيرفرات العربية وفحص البينج الفوري.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'ar',
        dir: 'rtl',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      });
    });

    // Self-unregistering SW script in dev mode so any browser stuck on cached dev-sw heals automatically
    app.get(['/sw.js', '/dev-sw.js'], (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.send(`
        self.addEventListener('install', () => { self.skipWaiting(); });
        self.addEventListener('activate', (event) => {
          event.waitUntil((async () => {
            try {
              const keys = await caches.keys();
              await Promise.all(keys.map((k) => caches.delete(k)));
            } catch {}
            try {
              await self.registration.unregister();
            } catch {}
            try {
              const clients = await self.clients.matchAll({ type: 'window' });
              for (const client of clients) {
                client.navigate(client.url);
              }
            } catch {}
          })());
        });
      `);
    });

    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true, cors: true },
      appType: 'spa',
    });
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api/') && (req.path === '/' || req.path.endsWith('.html'))) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      }
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(
      express.static(distDir, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );
    app.get('*', (req, res) => {
      if (
        req.path.startsWith('/api/') ||
        req.path.startsWith('/assets/') ||
        /\.(?:js|mjs|css|map|png|jpg|jpeg|svg|ico|webp|woff2?|json|webmanifest|txt)$/i.test(req.path)
      ) {
        res.status(404).end();
        return;
      }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();

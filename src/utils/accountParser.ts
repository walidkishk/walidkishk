import type { ProtocolFormatId, ServerSummary } from '../types.ts';

export interface ParsedAccountInput {
  detectedFormatLabelAr: string;
  protocol?: ProtocolFormatId;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  uuid?: string;
  sni?: string;
  wireguardPrivateKey?: string;
  wireguardPublicKey?: string;
  realExpiresAt?: string;
  serverId?: string;
}

function extractRealExpirationIso(rawText: string): string | undefined {
  const labeledPatterns = [
    /(?:Expired?(?:\s+At|\s+On|\s+Date)?|Expires?(?:\s+At|\s+On|\s+Date)?|Valid\s*Until|Exp(?:iry)?\s*Date|تاريخ\s*الانتهاء|ينتهي\s*في)\s*[:=\-]?\s*([^\r\n<]+)/gi,
  ];

  const tryParseCandidate = (candidate: string): string | undefined => {
    const cleaned = candidate.trim().replace(/\s+/g, ' ');
    // YYYY-MM-DD (with optional HH:mm:ss)
    const isoMatch = cleaned.match(/(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?)/);
    if (isoMatch) {
      const ts = Date.parse(isoMatch[1].replace(' ', 'T'));
      if (!Number.isNaN(ts)) return new Date(ts).toISOString();
    }
    // DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = cleaned.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      const time = dmyMatch[4] || '23:59:59';
      const ts = Date.parse(`${year}-${month}-${day}T${time}`);
      if (!Number.isNaN(ts)) return new Date(ts).toISOString();
    }
    // Named month formats e.g. "20 Nov 2026" or "Nov 20, 2026"
    const namedMatch = cleaned.match(
      /(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/,
    );
    if (namedMatch) {
      const ts = Date.parse(namedMatch[1]);
      if (!Number.isNaN(ts)) return new Date(ts).toISOString();
    }
    return undefined;
  };

  for (const re of labeledPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawText)) !== null) {
      const parsed = tryParseCandidate(m[1]);
      if (parsed) return parsed;
    }
  }
  return undefined;
}

function decodeBase64Utf8(b64: string): string {
  const normalized = b64.trim().replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function matchServerIdByHost(host: string | undefined, servers: ServerSummary[]): string | undefined {
  if (!host) return undefined;
  const clean = host.trim().toLowerCase();
  const exact = servers.find((s) => s.host.toLowerCase() === clean || s.slowDnsHost.toLowerCase() === clean);
  if (exact) return exact.serverId;
  const codeMatch = clean.match(/([a-z]{2}-\d+)\.stunnel\.cc/);
  if (codeMatch) {
    const bySub = servers.find((s) => s.host.toLowerCase().includes(codeMatch[1]));
    if (bySub) return bySub.serverId;
  }
  return undefined;
}

export function parseAnyVpnAccountText(
  rawText: string,
  servers: ServerSummary[],
): ParsedAccountInput | null {
  const text = rawText.trim();
  if (!text) return null;

  // 1. vmess:// Base64 JSON
  const vmessMatch = text.match(/vmess:\/\/([A-Za-z0-9+/=_-]+)/i);
  if (vmessMatch) {
    try {
      const json = JSON.parse(decodeBase64Utf8(vmessMatch[1])) as Record<string, unknown>;
      const host = typeof json.add === 'string' ? json.add.trim() : undefined;
      const port = Number(json.port) || 8443;
      const uuid = typeof json.id === 'string' ? json.id.trim() : undefined;
      const sni =
        (typeof json.sni === 'string' && json.sni.trim()) ||
        (typeof json.host === 'string' && json.host.trim()) ||
        'creativecommons.org';
      const ps = typeof json.ps === 'string' ? json.ps.trim() : '';
      const shortId = uuid ? uuid.slice(0, 8) : 'vmess';
      return {
        detectedFormatLabelAr: 'رابط V2Ray VMess',
        protocol: 'v2ray_vmess',
        host,
        port,
        uuid,
        sni,
        username: ps.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 24) || `vmess_${shortId}`,
        password: uuid || `vmess_${shortId}`,
        serverId: matchServerIdByHost(host, servers),
      };
    } catch {
      // fall through to generic parsers
    }
  }

  // 2. vless:// URI
  const vlessMatch = text.match(/vless:\/\/([^\s]+)/i);
  if (vlessMatch) {
    try {
      const url = new URL(`vless://${vlessMatch[1]}`);
      const uuid = decodeURIComponent(url.username);
      const host = url.hostname;
      const port = Number(url.port) || 8443;
      const sni =
        url.searchParams.get('sni') ||
        url.searchParams.get('host') ||
        'creativecommons.org';
      const shortId = uuid ? uuid.slice(0, 8) : 'vless';
      return {
        detectedFormatLabelAr: 'رابط V2Ray VLESS',
        protocol: 'v2ray_vless',
        host,
        port,
        uuid,
        sni,
        username: `vless_${shortId}`,
        password: uuid || `vless_${shortId}`,
        serverId: matchServerIdByHost(host, servers),
      };
    } catch {
      // fall through
    }
  }

  // 3. WireGuard .conf
  if (/\[Interface\]/i.test(text) && /PrivateKey\s*=/i.test(text)) {
    const priv = text.match(/PrivateKey\s*=\s*([^\s\r\n]+)/i)?.[1];
    const pub = text.match(/PublicKey\s*=\s*([^\s\r\n]+)/i)?.[1];
    const endpoint = text.match(/Endpoint\s*=\s*([^\s:\r\n]+)(?::(\d+))?/i);
    const host = endpoint?.[1];
    const port = Number(endpoint?.[2]) || 51820;
    const keySlug = priv ? priv.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase() : 'client';
    return {
      detectedFormatLabelAr: 'ملف إعداد WireGuard (.conf)',
      protocol: 'wireguard',
      host,
      port,
      wireguardPrivateKey: priv,
      wireguardPublicKey: pub,
      username: `wg_${keySlug}`,
      password: priv ? priv.slice(0, 16) : 'wireguard',
      serverId: matchServerIdByHost(host, servers),
    };
  }

  // 4. ssh:// or noobz:// or http:// URI
  const uriMatch = text.match(/(ssh|noobz|http):\/\/([^\s@]+)@([^\s:/?#]+)(?::(\d+))?([^\s]*)/i);
  if (uriMatch) {
    const scheme = uriMatch[1].toLowerCase();
    const creds = uriMatch[2].split(':');
    const username = decodeURIComponent(creds[0] || '');
    const password = decodeURIComponent(creds.slice(1).join(':') || '');
    const host = uriMatch[3];
    const port = Number(uriMatch[4]) || (scheme === 'http' ? 8080 : scheme === 'noobz' ? 2053 : 80);
    let sni: string | undefined;
    const sniParam = uriMatch[5]?.match(/[?&]sni=([^&#]+)/i);
    if (sniParam) {
      sni = decodeURIComponent(sniParam[1]);
    }
    let protocol: ProtocolFormatId = 'ssh_ws';
    if (scheme === 'http') protocol = 'squid';
    else if (scheme === 'noobz') protocol = 'noobzvpn';
    else if (port === 443 || port === 110 || port === 587 || sni) protocol = 'ssh_ssl';
    else if (port === 143 || port === 444 || port === 5555) protocol = 'ssh_dropbear';

    return {
      detectedFormatLabelAr: `رابط ${scheme.toUpperCase()}`,
      protocol,
      host,
      port,
      username,
      password,
      sni,
      serverId: matchServerIdByHost(host, servers),
    };
  }

  // 5. Key-Value text block copied from ssh-tunnel.net or injector configs
  const grabField = (patterns: RegExp[]): string | undefined => {
    for (const re of patterns) {
      const m = text.match(re);
      if (m?.[1]?.trim()) return m[1].trim();
    }
    return undefined;
  };

  const username = grabField([
    /(?:Username|User)\s*[:=]\s*([^\s\r\n]+)/i,
    /اسم المستخدم\s*[:=]\s*([^\s\r\n]+)/i,
  ]);
  const password = grabField([
    /(?:Password|Pass)\s*[:=]\s*([^\s\r\n]+)/i,
    /كلمة المرور\s*[:=]\s*([^\s\r\n]+)/i,
  ]);
  const host = grabField([
    /(?:Server\s*Host|Host|Address|Server|SSH\s*Host)\s*[:=]\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
  ]);
  const slowDns = grabField([/(?:Nameserver|NS|SlowDNS)\s*[:=]\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i]);
  const sni = grabField([/(?:SNI\s*\/\s*Bug\s*Host|SNI|Bug\s*Host)\s*[:=]\s*([^\s\r\n]+)/i]);
  const uuid = grabField([/UUID\s*[:=]\s*([0-9a-f-]{36})/i]);
  const portStr = grabField([/(?:Selected\s*Port|Port)\s*[:=]\s*(\d{2,5})/i]);
  const port = portStr ? Number(portStr) : undefined;
  const realExpiresAt = extractRealExpirationIso(text);

  if (username || password || host || uuid || slowDns) {
    let protocol: ProtocolFormatId = 'ssh_ws';
    if (slowDns && !uuid) protocol = 'slowdns';
    else if (uuid) protocol = /vless/i.test(text) ? 'v2ray_vless' : 'v2ray_vmess';
    else if (/noobz/i.test(text)) protocol = 'noobzvpn';
    else if (/squid/i.test(text)) protocol = 'squid';
    else if (/stunnel|ssl/i.test(text) || port === 443) protocol = 'ssh_ssl';
    else if (/dropbear/i.test(text) || port === 143 || port === 444) protocol = 'ssh_dropbear';

    const effectiveHost = host || (slowDns ? slowDns.replace(/^dns\./, '') : undefined);
    return {
      detectedFormatLabelAr: 'نص بيانات الحساب المستخرج',
      protocol,
      host: effectiveHost,
      port,
      username: username || (uuid ? `v2ray_${uuid.slice(0, 8)}` : undefined),
      password: password || uuid,
      uuid,
      sni,
      realExpiresAt,
      serverId: matchServerIdByHost(effectiveHost, servers),
    };
  }

  return null;
}

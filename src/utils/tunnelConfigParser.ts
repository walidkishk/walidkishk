import type { TunnelConnectPayload } from '../types.ts';

function decodeBase64Utf8(b64: string): string {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function parseTunnelConfigInput(rawInput: string): Partial<TunnelConnectPayload> | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  // 1. VLESS URI: vless://uuid@host:port?type=ws&security=tls&sni=...&path=...
  if (trimmed.toLowerCase().startsWith('vless://')) {
    try {
      const normalized = trimmed.replace(/^vless:\/\//i, 'https://');
      const url = new URL(normalized);
      const transportRaw = (url.searchParams.get('type') || 'ws').toLowerCase();
      const securityRaw = (url.searchParams.get('security') || 'tls').toLowerCase();
      return {
        protocol: 'v2ray_vless',
        uuid: decodeURIComponent(url.username || ''),
        host: url.hostname,
        port: Number(url.port) || 443,
        sni: url.searchParams.get('sni') || url.searchParams.get('host') || url.hostname,
        wsPath: url.searchParams.get('path') || '/vless',
        v2rayTransport:
          transportRaw === 'grpc' ? 'grpc' : transportRaw === 'tcp' ? 'tcp' : 'ws',
        v2raySecurity:
          securityRaw === 'reality' ? 'reality' : securityRaw === 'none' ? 'none' : 'tls',
        useTls: securityRaw !== 'none',
      };
    } catch {
      return null;
    }
  }

  // 2. VMess URI: vmess://base64(json)
  if (trimmed.toLowerCase().startsWith('vmess://')) {
    try {
      const payload = trimmed.slice('vmess://'.length).split('#')[0].trim();
      const parsed = JSON.parse(decodeBase64Utf8(payload)) as {
        add?: string;
        port?: string | number;
        id?: string;
        net?: string;
        tls?: string;
        sni?: string;
        host?: string;
        path?: string;
      };
      if (!parsed.add) return null;
      const netType = (parsed.net || 'ws').toLowerCase();
      const tlsOn = (parsed.tls || '').toLowerCase() === 'tls';
      return {
        protocol: 'v2ray_vmess',
        host: parsed.add,
        port: Number(parsed.port) || 443,
        uuid: parsed.id || '',
        sni: parsed.sni || parsed.host || parsed.add,
        wsPath: parsed.path || '/vmess',
        v2rayTransport: netType === 'grpc' ? 'grpc' : netType === 'tcp' ? 'tcp' : 'ws',
        v2raySecurity: tlsOn ? 'tls' : 'none',
        useTls: tlsOn,
      };
    } catch {
      return null;
    }
  }

  // 3. SSH URI: ssh://user:pass@host:port?sni=...
  if (trimmed.toLowerCase().startsWith('ssh://')) {
    try {
      const url = new URL(trimmed);
      const port = Number(url.port) || 443;
      const sni = url.searchParams.get('sni') || '';
      const hash = url.hash.toLowerCase();
      const protocol =
        hash.includes('dropbear') || port === 143 || port === 444 || port === 5555
          ? 'ssh_dropbear'
          : hash.includes('ssl') || port === 443 || sni
          ? 'ssh_ssl'
          : 'ssh_ws';
      return {
        protocol,
        host: url.hostname,
        port,
        username: decodeURIComponent(url.username || ''),
        password: decodeURIComponent(url.password || ''),
        sni: sni || url.hostname,
        useTls: port === 443 || Boolean(sni),
      };
    } catch {
      return null;
    }
  }

  // 4. Squid HTTP Proxy URI: http://user:pass@host:port
  if (trimmed.toLowerCase().startsWith('http://') || trimmed.toLowerCase().startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      return {
        protocol: 'squid',
        host: url.hostname,
        port: Number(url.port) || 8080,
        username: decodeURIComponent(url.username || ''),
        password: decodeURIComponent(url.password || ''),
      };
    } catch {
      return null;
    }
  }

  // 5. NoobzVpn URI: noobz://user:pass@host:port
  if (trimmed.toLowerCase().startsWith('noobz://')) {
    try {
      const url = new URL(trimmed.replace(/^noobz:\/\//i, 'http://'));
      const port = Number(url.port) || 2053;
      return {
        protocol: 'noobzvpn',
        host: url.hostname,
        port,
        username: decodeURIComponent(url.username || ''),
        password: decodeURIComponent(url.password || ''),
        useTls: port === 2083 || port === 443,
      };
    } catch {
      return null;
    }
  }

  // 6. SlowDNS URI: dns://ns.example.com?user=...&pass=...
  if (trimmed.toLowerCase().startsWith('dns://')) {
    try {
      const url = new URL(trimmed.replace(/^dns:\/\//i, 'http://'));
      return {
        protocol: 'slowdns',
        host: url.hostname.replace(/^dns\./i, ''),
        slowDnsHost: url.hostname,
        port: Number(url.port) || 53,
        username: url.searchParams.get('user') || '',
        password: url.searchParams.get('pass') || '',
        dnsResolver: '1.1.1.1',
      };
    } catch {
      return null;
    }
  }

  // 7. WireGuard .conf text ([Interface] ... [Peer])
  if (trimmed.includes('[Interface]') || trimmed.includes('PrivateKey')) {
    const priv = trimmed.match(/PrivateKey\s*=\s*([^\r\n]+)/i)?.[1]?.trim() || '';
    const pub = trimmed.match(/PublicKey\s*=\s*([^\r\n]+)/i)?.[1]?.trim() || '';
    const endpoint = trimmed.match(/Endpoint\s*=\s*([^\r\n]+)/i)?.[1]?.trim() || '';
    const [epHost, epPort] = endpoint.split(':');
    if (epHost || priv || pub) {
      return {
        protocol: 'wireguard',
        host: (epHost || '').trim(),
        port: Number(epPort) || 51820,
        wireguardPrivateKey: priv,
        wireguardPublicKey: pub,
      };
    }
  }

  // 8. JSON config (e.g. NoobzVpn JSON or VMess JSON)
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      if (typeof obj.server === 'string') {
        const port = Number(obj.selected_port || obj.port_ssl || obj.port_plain) || 2053;
        return {
          protocol: 'noobzvpn',
          host: obj.server,
          port,
          sni: typeof obj.sni === 'string' ? obj.sni : obj.server,
          username: typeof obj.username === 'string' ? obj.username : '',
          password: typeof obj.password === 'string' ? obj.password : '',
          useTls: Boolean(obj.tls) || port === 2083,
        };
      }
      if (typeof obj.add === 'string' && typeof obj.id === 'string') {
        return {
          protocol: 'v2ray_vmess',
          host: obj.add,
          port: Number(obj.port) || 443,
          uuid: obj.id,
          sni: typeof obj.sni === 'string' ? obj.sni : obj.add,
          wsPath: typeof obj.path === 'string' ? obj.path : '/vmess',
          useTls: obj.tls === 'tls',
        };
      }
    } catch {
      return null;
    }
  }

  // 9. Plain host:port fallback
  const hostPortMatch = trimmed.match(/^([a-zA-Z0-9.-]+):(\d{1,5})$/);
  if (hostPortMatch) {
    return {
      host: hostPortMatch[1],
      port: Number(hostPortMatch[2]),
    };
  }

  return null;
}

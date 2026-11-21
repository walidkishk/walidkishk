import type { ProtocolFormatId, SavedVpnAccount } from '../types.ts';

export interface GeneratedConfigBundle {
  titleAr: string;
  extension: string;
  primaryUri: string;
  payloadText: string;
  connectionGuideAr: string;
}

function toBase64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function getProtocolLabelAr(protocol: ProtocolFormatId): string {
  switch (protocol) {
    case 'ssh_ws':
      return 'SSH WebSocket (WS / CDN)';
    case 'ssh_ssl':
      return 'SSH Stunnel (SSL / TLS)';
    case 'ssh_dropbear':
      return 'SSH Dropbear مباشر';
    case 'slowdns':
      return 'SlowDNS (DNSTT)';
    case 'v2ray_vmess':
      return 'V2Ray VMess (WS + TLS)';
    case 'v2ray_vless':
      return 'V2Ray VLESS (WS + TLS)';
    case 'wireguard':
      return 'WireGuard (.conf)';
    case 'noobzvpn':
      return 'NoobzVpn (Plain / SSL)';
    case 'squid':
      return 'Squid HTTP Proxy';
  }
}

export function buildConfigBundle(account: SavedVpnAccount): GeneratedConfigBundle {
  const sni = account.sni || 'creativecommons.org';
  const host = account.host;
  const slowDns = account.slowDnsHost || `dns.${host}`;
  const port = account.port;
  const user = account.username;
  const pass = account.password;
  const uuid = account.uuid;

  switch (account.protocol) {
    case 'ssh_ws': {
      const payload = `GET / HTTP/1.1[crlf]Host: ${host}[crlf]Upgrade: websocket[crlf]Connection: Upgrade[crlf][crlf]`;
      const sslPayload = `GET wss://${host}/ HTTP/1.1[crlf]Host: ${sni}[crlf]Upgrade: websocket[crlf]Connection: Upgrade[crlf][crlf]`;
      const uri = `ssh://${user}:${pass}@${host}:${port}#${encodeURIComponent(account.serverCode + '-WS')}`;
      return {
        titleAr: 'إعدادات SSH WebSocket (HTTP Injector / HTTP Custom / DarkTunnel)',
        extension: 'txt',
        primaryUri: uri,
        payloadText: [
          `# === ${account.serverName || account.serverCode} (${account.host}) ===`,
          `Server Host: ${host}`,
          `WS Port (HTTP): 80, 8880, 2052, 2082, 2086, 2095`,
          `Selected Port: ${port}`,
          `UDPGW Port: 7100-7700`,
          `Username: ${user}`,
          `Password: ${pass}`,
          `SNI / Bug Host: ${sni}`,
          ``,
          `--- Payload HTTP WebSocket ---`,
          payload,
          ``,
          `--- Payload SSL + WebSocket (Port 443) ---`,
          sslPayload,
          ``,
          `--- Quick URI ---`,
          uri,
        ].join('\n'),
        connectionGuideAr: 'استخدم المنفذ 80 أو 8880 مع بايلود WebSocket، أو المنفذ 443 مع تفعيل SSL + SNI.',
      };
    }

    case 'ssh_ssl': {
      const uri = `ssh://${user}:${pass}@${host}:${port}?sni=${encodeURIComponent(sni)}#${encodeURIComponent(account.serverCode + '-SSL')}`;
      return {
        titleAr: 'إعدادات SSH Stunnel (SSL / TLS)',
        extension: 'txt',
        primaryUri: uri,
        payloadText: [
          `# === ${account.serverName || account.serverCode} - Stunnel SSL/TLS ===`,
          `Host: ${host}`,
          `SSL/TLS Ports: 443, 110, 587`,
          `Selected Port: ${port}`,
          `SNI / Bug Host: ${sni}`,
          `Username: ${user}`,
          `Password: ${pass}`,
          `UDPGW: 7100-7700`,
          ``,
          `URI: ${uri}`,
        ].join('\n'),
        connectionGuideAr: 'اختر وضع SSH -> SSL/TLS (Stunnel) وأدخل SNI في خانة Server Name Indication.',
      };
    }

    case 'ssh_dropbear': {
      const uri = `ssh://${user}:${pass}@${host}:${port}#${encodeURIComponent(account.serverCode + '-Dropbear')}`;
      return {
        titleAr: 'إعدادات SSH Dropbear المباشر',
        extension: 'txt',
        primaryUri: uri,
        payloadText: [
          `# === ${account.serverName || account.serverCode} - Dropbear ===`,
          `Host: ${host}`,
          `Dropbear Ports: 143, 444, 666, 5555, 701, 179`,
          `Selected Port: ${port}`,
          `Username: ${user}`,
          `Password: ${pass}`,
          `UDPGW: 7100-7700`,
          ``,
          `URI: ${uri}`,
        ].join('\n'),
        connectionGuideAr: 'اتصل مباشرة عبر SSH/Dropbear على المنفذ 143 أو 444 أو 5555 مع تفعيل UDPGW 7300.',
      };
    }

    case 'slowdns': {
      const uri = `dns://${slowDns}?user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`;
      return {
        titleAr: 'إعدادات SlowDNS (DNSTT)',
        extension: 'txt',
        primaryUri: uri,
        payloadText: [
          `# === ${account.serverName || account.serverCode} - SlowDNS / DNSTT ===`,
          `Nameserver (NS): ${slowDns}`,
          `SSH Host: ${host}`,
          `SSH Port: ${port}`,
          `Username: ${user}`,
          `Password: ${pass}`,
          `DNS Resolver: 1.1.1.1:53 or 8.8.8.8:53`,
          `Note: Check live DNSTT service status on Server Metrics before connecting.`,
        ].join('\n'),
        connectionGuideAr: 'أدخل Nameserver في خانة SlowDNS وحدد DNS Resolver مثل 1.1.1.1 ثم أدخل بيانات SSH.',
      };
    }

    case 'v2ray_vmess': {
      const vmessJson = {
        v: '2',
        ps: `${account.serverCode} (${host})`,
        add: host,
        port: String(port),
        id: uuid,
        aid: '0',
        scy: 'auto',
        net: 'ws',
        type: 'none',
        host: sni,
        path: '/vmess',
        tls: port === 8443 || port === 443 || port === 8441 || port === 8442 || port === 8444 ? 'tls' : '',
        sni,
      };
      const vmessUri = `vmess://${toBase64Utf8(JSON.stringify(vmessJson))}`;
      return {
        titleAr: 'رابط وإعدادات V2Ray VMess',
        extension: 'json',
        primaryUri: vmessUri,
        payloadText: `${vmessUri}\n\n# --- JSON Config ---\n${JSON.stringify(vmessJson, null, 2)}`,
        connectionGuideAr: 'انسخ رابط vmess:// واستورده مباشرة في v2rayNG أو Nekobox أو Shadowrocket.',
      };
    }

    case 'v2ray_vless': {
      const vlessUri = `vless://${uuid}@${host}:${port}?encryption=none&security=tls&sni=${encodeURIComponent(sni)}&type=ws&host=${encodeURIComponent(sni)}&path=%2Fvless#${encodeURIComponent(account.serverCode + '-VLESS')}`;
      return {
        titleAr: 'رابط وإعدادات V2Ray VLESS',
        extension: 'txt',
        primaryUri: vlessUri,
        payloadText: [
          vlessUri,
          ``,
          `# === V2Ray VLESS Parameters ===`,
          `Address: ${host}`,
          `Port: ${port} (Available: 8441, 8442, 8443, 8444)`,
          `UUID: ${uuid}`,
          `Network: ws`,
          `Security: tls`,
          `SNI / Host: ${sni}`,
          `Path: /vless`,
        ].join('\n'),
        connectionGuideAr: 'انسخ رابط vless:// واستورده من الحافظة داخل تطبيق v2rayNG أو Hiddify.',
      };
    }

    case 'wireguard': {
      const conf = [
        `[Interface]`,
        `# Server: ${account.serverCode} (${host})`,
        `PrivateKey = ${account.wireguardPrivateKey}`,
        `Address = 10.66.66.2/32`,
        `DNS = 1.1.1.1, 8.8.8.8`,
        `MTU = 1280`,
        ``,
        `[Peer]`,
        `PublicKey = ${account.wireguardPublicKey}`,
        `Endpoint = ${host}:${port}`,
        `AllowedIPs = 0.0.0.0/0, ::/0`,
        `PersistentKeepalive = 25`,
      ].join('\n');
      return {
        titleAr: 'ملف إعداد WireGuard (.conf)',
        extension: 'conf',
        primaryUri: `${host}:${port}`,
        payloadText: conf,
        connectionGuideAr: 'حمّل ملف .conf واستورده مباشرة في تطبيق WireGuard الرسمي.',
      };
    }

    case 'noobzvpn': {
      const configJson = {
        server: host,
        port_plain: 2053,
        port_ssl: 2083,
        selected_port: port,
        sni,
        username: user,
        password: pass,
        tls: port === 2083,
      };
      return {
        titleAr: 'إعدادات NoobzVpn (Plain / SSL)',
        extension: 'json',
        primaryUri: `noobz://${user}:${pass}@${host}:${port}`,
        payloadText: JSON.stringify(configJson, null, 2),
        connectionGuideAr: 'يدعم منفذ 2053 للاتصال العادي tcp_plain ومنفذ 2083 للاتصال المشفر tcp_ssl.',
      };
    }

    case 'squid': {
      const uri = `http://${user}:${pass}@${host}:${port}`;
      return {
        titleAr: 'إعدادات Squid HTTP Proxy',
        extension: 'txt',
        primaryUri: uri,
        payloadText: [
          `# === ${account.serverName || account.serverCode} - Squid Proxy ===`,
          `Proxy Host: ${host}`,
          `Squid Ports: 8080, 3128, 8000`,
          `Selected Port: ${port}`,
          `Username: ${user}`,
          `Password: ${pass}`,
          `Proxy URI: ${uri}`,
        ].join('\n'),
        connectionGuideAr: 'استخدم المنفذ 8080 أو 3128 أو 8000 كـ HTTP Remote Proxy في برامج الحقن.',
      };
    }
  }
}

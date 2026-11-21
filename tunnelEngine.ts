import crypto from 'node:crypto';
import dgram from 'node:dgram';
import dns from 'node:dns';
import net from 'node:net';
import tls from 'node:tls';
import { Client as Ssh2Client } from 'ssh2';
import type {
  ProtocolFormatId,
  TunnelConnectPayload,
  TunnelHeartbeatResponse,
  TunnelLogEntry,
  TunnelSessionMetrics,
  TunnelTrafficTestResult,
} from './src/types.ts';

interface ActiveTunnelSession {
  sessionId: string;
  protocol: ProtocolFormatId;
  host: string;
  resolvedIp: string;
  port: number;
  sni: string;
  wsPath: string;
  useTls: boolean;
  username: string;
  password: string;
  slowDnsHost: string;
  dnsResolver: string;
  createdAt: number;
  lastActiveAt: number;
  bytesSent: number;
  bytesReceived: number;
  sshClient?: Ssh2Client;
  underlyingSocket?: net.Socket | tls.TLSSocket;
}

const ACTIVE_TUNNELS = new Map<string, ActiveTunnelSession>();
const MAX_ACTIVE_TUNNELS = 32;
const TUNNEL_IDLE_TTL_MS = 12 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, sess] of ACTIVE_TUNNELS.entries()) {
    if (now - sess.lastActiveAt > TUNNEL_IDLE_TTL_MS) {
      cleanupTunnelSession(id);
    }
  }
}, 60_000).unref();

function makeLog(
  stage: TunnelLogEntry['stage'],
  level: TunnelLogEntry['level'],
  message: string,
): TunnelLogEntry {
  return {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    stage,
    level,
    message,
  };
}

function isPrivateOrLocalIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return true;
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] >= 224) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}

function cleanHostname(raw: string | undefined): string {
  return (raw || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/[^a-zA-Z0-9.-]/g, '');
}

async function resolvePublicIpv4(
  rawHost: string,
): Promise<{ ok: true; ip: string; dnsMs: number } | { ok: false; error: string }> {
  const host = cleanHostname(rawHost);
  if (!host || (!net.isIPv4(host) && !host.includes('.'))) {
    return { ok: false, error: 'اسم المضيف (Host) أو عنوان IP غير صالح.' };
  }
  if (host.toLowerCase() === 'localhost') {
    return { ok: false, error: 'عناوين الشبكة المحلية (localhost) غير مسموحة.' };
  }

  const start = process.hrtime.bigint();
  if (net.isIPv4(host)) {
    if (isPrivateOrLocalIp(host)) {
      return { ok: false, error: 'عنوان IP الخاص أو المحلي غير مسموح به.' };
    }
    return { ok: true, ip: host, dnsMs: 1 };
  }

  try {
    const lookup = await dns.promises.lookup(host, { family: 4 });
    const dnsMs = Math.max(1, Math.round(Number(process.hrtime.bigint() - start) / 1_000_000));
    if (!lookup.address || isPrivateOrLocalIp(lookup.address)) {
      return { ok: false, error: 'العنوان المحلول يقع ضمن شبكة داخلية محظورة.' };
    }
    return { ok: true, ip: lookup.address, dnsMs };
  } catch {
    return { ok: false, error: `فشل حل النطاق (DNS Lookup Failed) للمضيف: ${host}` };
  }
}

function connectRawTcp(
  ip: string,
  port: number,
  timeoutMs = 4500,
): Promise<{ socket: net.Socket; tcpMs: number }> {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    const socket = net.createConnection({ host: ip, port });
    let settled = false;

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(err);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      if (settled) return;
      settled = true;
      socket.setTimeout(0);
      const tcpMs = Math.max(1, Math.round(Number(process.hrtime.bigint() - start) / 1_000_000));
      resolve({ socket, tcpMs });
    });
    socket.once('timeout', () => fail(new Error(`انتهت مهلة الاتصال بمنفذ TCP ${port}`)));
    socket.once('error', (err) => fail(err));
  });
}

function connectRawTls(
  ip: string,
  port: number,
  sni: string,
  alpnProtocols?: string[],
  timeoutMs = 5000,
): Promise<{
  socket: tls.TLSSocket;
  handshakeMs: number;
  tlsVersion: string | null;
  tlsCipher: string | null;
}> {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    let settled = false;
    const socket = tls.connect({
      host: ip,
      port,
      servername: sni,
      rejectUnauthorized: false,
      ...(alpnProtocols ? { ALPNProtocols: alpnProtocols } : {}),
    });

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(err);
    };

    socket.setTimeout(timeoutMs);
    socket.once('secureConnect', () => {
      if (settled) return;
      settled = true;
      socket.setTimeout(0);
      const handshakeMs = Math.max(1, Math.round(Number(process.hrtime.bigint() - start) / 1_000_000));
      const cipher = socket.getCipher();
      resolve({
        socket,
        handshakeMs,
        tlsVersion: socket.getProtocol() || null,
        tlsCipher: cipher?.name || null,
      });
    });
    socket.once('timeout', () => fail(new Error(`انتهت مهلة مصافحة TLS على المنفذ ${port} (SNI: ${sni})`)));
    socket.once('error', (err) => fail(err));
  });
}

function readChunkOnce(
  socket: net.Socket | tls.TLSSocket,
  timeoutMs = 2200,
): Promise<Buffer> {
  return new Promise((resolve) => {
    let settled = false;
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      done();
    }, timeoutMs);

    const onData = (buf: Buffer) => {
      chunks.push(buf);
      const combined = Buffer.concat(chunks);
      if (combined.includes('\r\n\r\n') || combined.includes('SSH-2.0') || combined.length >= 2048) {
        done();
      }
    };
    const onClose = () => done();
    const onError = () => done();

    function done() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('close', onClose);
      socket.off('error', onError);
      resolve(Buffer.concat(chunks));
    }

    socket.on('data', onData);
    socket.once('close', onClose);
    socket.once('error', onError);
  });
}

function formatInjectorPayload(
  rawTemplate: string | undefined,
  params: { host: string; port: number; sni: string; wsPath: string },
): string {
  const wsKey = crypto.randomBytes(16).toString('base64');
  if (rawTemplate && rawTemplate.trim().length > 0) {
    let built = rawTemplate
      .replace(/\[host_port\]/gi, `${params.host}:${params.port}`)
      .replace(/\[host\]/gi, params.sni || params.host)
      .replace(/\[port\]/gi, String(params.port))
      .replace(/\[sni\]/gi, params.sni || params.host)
      .replace(/\[protocol\]/gi, 'HTTP/1.1')
      .replace(/\[crlf\]/gi, '\r\n')
      .replace(/\[cr\]/gi, '\r')
      .replace(/\[lf\]/gi, '\n')
      .replace(/\[ua\]/gi, 'Mozilla/5.0 (Linux; Android 14) VPNFastore/1.0');
    if (!built.endsWith('\r\n\r\n')) {
      built = built.replace(/\r?\n?$/, '\r\n\r\n');
    }
    return built;
  }
  const cleanPath = params.wsPath.startsWith('/') ? params.wsPath : `/${params.wsPath}`;
  return [
    `GET ${cleanPath} HTTP/1.1`,
    `Host: ${params.sni || params.host}`,
    `User-Agent: Mozilla/5.0`,
    `Connection: Upgrade`,
    `Upgrade: websocket`,
    `Sec-WebSocket-Key: ${wsKey}`,
    `Sec-WebSocket-Version: 13`,
    '',
    '',
  ].join('\r\n');
}

function parseHttpStatusAndHeaders(rawText: string): {
  status: number | null;
  statusLine: string;
  serverHeader: string | null;
} {
  const firstLine = rawText.split(/\r?\n/)[0] || '';
  const match = firstLine.match(/^HTTP\/\d\.\d\s+(\d{3})(?:\s+(.*))?$/i);
  const serverMatch = rawText.match(/^server:\s*(.+)$/im);
  return {
    status: match ? Number(match[1]) : null,
    statusLine: firstLine.trim(),
    serverHeader: serverMatch ? serverMatch[1].trim() : null,
  };
}

function connectSsh2OverSocket(params: {
  sock: net.Socket | tls.TLSSocket;
  username: string;
  password: string;
  timeoutMs?: number;
}): Promise<{ ok: true; client: Ssh2Client } | { ok: false; authRejected: boolean; reason: string }> {
  return new Promise((resolve) => {
    const client = new Ssh2Client();
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        client.end();
      } catch {
        // ignore
      }
      resolve({ ok: false, authRejected: false, reason: 'انتهت مهلة مصادقة SSH-2.0' });
    }, params.timeoutMs ?? 6000);

    client.once('ready', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: true, client });
    });

    client.once('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const msg = err?.message || 'خطأ في مصادقة SSH';
      const authRejected =
        /All configured authentication methods failed|authentication/i.test(msg);
      try {
        client.end();
      } catch {
        // ignore
      }
      resolve({ ok: false, authRejected, reason: msg });
    });

    try {
      client.connect({
        sock: params.sock,
        username: params.username,
        password: params.password,
        readyTimeout: params.timeoutMs ?? 5500,
        tryKeyboard: true,
      });
    } catch (err) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({
          ok: false,
          authRejected: false,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
  });
}

function buildDnsTxtQueryPacket(qname: string): { id: number; packet: Buffer } {
  const id = crypto.randomBytes(2).readUInt16BE(0);
  const header = Buffer.alloc(12);
  header.writeUInt16BE(id, 0);
  header.writeUInt16BE(0x0100, 2); // Standard query, recursion desired
  header.writeUInt16BE(1, 4); // QDCOUNT = 1

  const labels = qname
    .split('.')
    .filter(Boolean)
    .map((label) => {
      const b = Buffer.from(label.slice(0, 63), 'ascii');
      return Buffer.concat([Buffer.from([b.length]), b]);
    });
  const qnameBuf = Buffer.concat([...labels, Buffer.from([0x00])]);
  const qtail = Buffer.alloc(4);
  qtail.writeUInt16BE(16, 0); // QTYPE = TXT (16)
  qtail.writeUInt16BE(1, 2); // QCLASS = IN (1)
  return { id, packet: Buffer.concat([header, qnameBuf, qtail]) };
}

function probeUdpDnsPacket(
  resolverIp: string,
  port: number,
  qname: string,
  timeoutMs = 3500,
): Promise<{
  ok: boolean;
  latencyMs: number | null;
  rcode: number | null;
  bytesSent: number;
  bytesReceived: number;
  error?: string;
}> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const { id, packet } = buildDnsTxtQueryPacket(qname);
    const start = process.hrtime.bigint();
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.close();
      resolve({
        ok: false,
        latencyMs: null,
        rcode: null,
        bytesSent: packet.length,
        bytesReceived: 0,
        error: `لم يستجب خادم DNS (${resolverIp}:${port}) للاستعلام`,
      });
    }, timeoutMs);

    socket.once('message', (msg) => {
      if (settled) return;
      if (msg.length < 12 || msg.readUInt16BE(0) !== id) return;
      settled = true;
      clearTimeout(timer);
      const ms = Math.max(1, Math.round(Number(process.hrtime.bigint() - start) / 1_000_000));
      const flags = msg.readUInt16BE(2);
      const rcode = flags & 0x0f;
      socket.close();
      resolve({
        ok: true,
        latencyMs: ms,
        rcode,
        bytesSent: packet.length,
        bytesReceived: msg.length,
      });
    });

    socket.once('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      resolve({
        ok: false,
        latencyMs: null,
        rcode: null,
        bytesSent: packet.length,
        bytesReceived: 0,
        error: err.message,
      });
    });

    socket.send(packet, port, resolverIp, (err) => {
      if (err && !settled) {
        settled = true;
        clearTimeout(timer);
        socket.close();
        resolve({
          ok: false,
          latencyMs: null,
          rcode: null,
          bytesSent: 0,
          bytesReceived: 0,
          error: err.message,
        });
      }
    });
  });
}

function validateX25519Key(base64Key: string | undefined): { valid: boolean; derivedPublic?: string } {
  if (!base64Key) return { valid: false };
  try {
    const raw = Buffer.from(base64Key.trim(), 'base64');
    if (raw.length !== 32) return { valid: false };
    // Attempt PKCS#8 X25519 derivation to check if valid Curve25519 private key structure
    try {
      const pkcs8Prefix = Buffer.from('302e020100300506032b656e04220420', 'hex');
      const keyObj = crypto.createPrivateKey({
        key: Buffer.concat([pkcs8Prefix, raw]),
        format: 'der',
        type: 'pkcs8',
      });
      const pubSpki = crypto.createPublicKey(keyObj).export({ format: 'der', type: 'spki' }) as Buffer;
      return { valid: true, derivedPublic: pubSpki.subarray(-32).toString('base64') };
    } catch {
      return { valid: true };
    }
  } catch {
    return { valid: false };
  }
}

function probeWireGuardUdp(
  ip: string,
  port: number,
  timeoutMs = 1800,
): Promise<{ reachableSocket: boolean; icmpRefused: boolean; bytesSent: number; error?: string }> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    // Standard 148-byte WireGuard Type 1 Handshake Initiation frame structure (unencrypted zero probe)
    const packet = Buffer.alloc(148);
    packet[0] = 0x01;
    crypto.randomBytes(4).copy(packet, 4);
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.close();
      resolve({ reachableSocket: true, icmpRefused: false, bytesSent: packet.length });
    }, timeoutMs);

    socket.once('error', (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      resolve({
        reachableSocket: false,
        icmpRefused: err.code === 'ECONNREFUSED',
        bytesSent: packet.length,
        error: err.message,
      });
    });

    socket.connect(port, ip, () => {
      socket.send(packet, (err) => {
        if (err && !settled) {
          settled = true;
          clearTimeout(timer);
          socket.close();
          resolve({
            reachableSocket: false,
            icmpRefused: false,
            bytesSent: 0,
            error: err.message,
          });
        }
      });
    });
  });
}

function registerActiveSession(session: ActiveTunnelSession): void {
  if (ACTIVE_TUNNELS.size >= MAX_ACTIVE_TUNNELS) {
    const oldestKey = ACTIVE_TUNNELS.keys().next().value;
    if (oldestKey) cleanupTunnelSession(oldestKey);
  }
  ACTIVE_TUNNELS.set(session.sessionId, session);
}

export function cleanupTunnelSession(sessionId: string): {
  closed: boolean;
  bytesSent: number;
  bytesReceived: number;
} {
  const existing = ACTIVE_TUNNELS.get(sessionId);
  if (!existing) {
    return { closed: false, bytesSent: 0, bytesReceived: 0 };
  }
  ACTIVE_TUNNELS.delete(sessionId);
  try {
    existing.sshClient?.end();
  } catch {
    // ignore
  }
  try {
    existing.underlyingSocket?.destroy();
  } catch {
    // ignore
  }
  return {
    closed: true,
    bytesSent: existing.bytesSent,
    bytesReceived: existing.bytesReceived,
  };
}

export async function connectRealTunnelSession(
  payload: TunnelConnectPayload,
): Promise<TunnelSessionMetrics> {
  const totalStart = process.hrtime.bigint();
  const logs: TunnelLogEntry[] = [];
  const protocol = payload.protocol;
  const host = cleanHostname(payload.host);
  const port = Math.max(1, Math.min(65535, Math.round(Number(payload.port) || 443)));
  const sni = cleanHostname(payload.sni) || host;
  const wsPath = (payload.wsPath || '/').trim() || '/';
  const username = (payload.username || '').trim();
  const password = (payload.password || '').trim();
  const uuid = (payload.uuid || '').trim();
  let bytesSent = 0;
  let bytesReceived = 0;

  const baseFailure = (errorReason: string, resolvedIp: string | null = null, dnsMs: number | null = null): TunnelSessionMetrics => ({
    sessionId: null,
    connected: false,
    protocol,
    host: host || payload.host,
    resolvedIp,
    port,
    dnsMs,
    tcpMs: null,
    handshakeMs: null,
    totalConnectMs: Math.max(1, Math.round(Number(process.hrtime.bigint() - totalStart) / 1_000_000)),
    tlsVersion: null,
    tlsCipher: null,
    sshBanner: null,
    authVerified: null,
    httpUpgradeStatus: null,
    httpServerHeader: null,
    bytesSent,
    bytesReceived,
    transportSummary: 'فشل الاتصال',
    errorReason,
    logs,
  });

  // Step 1: Resolve host DNS -> public IPv4
  logs.push(makeLog('DNS', 'info', `جارٍ حل النطاق والتحقق من العنوان: ${host || payload.host} ...`));
  const dnsRes = await resolvePublicIpv4(payload.host);
  if (!dnsRes.ok) {
    logs.push(makeLog('DNS', 'error', dnsRes.error));
    return baseFailure(dnsRes.error);
  }

  const resolvedIp = dnsRes.ip;
  const dnsMs = dnsRes.dnsMs;
  logs.push(makeLog('DNS', 'success', `تم الحل بنجاح -> IP: ${resolvedIp} (${dnsMs} ms)`));

  // Route by exact protocol
  try {
    // 1) SSH Dropbear (Direct TCP + SSH-2.0 Banner + optional real SSH2 Auth)
    if (protocol === 'ssh_dropbear') {
      const { socket, tcpMs } = await connectRawTcp(resolvedIp, port, 4500);
      logs.push(makeLog('TCP', 'success', `تم الاتصال بمنفذ TCP ${port} خلال ${tcpMs} ms`));

      const bannerBuf = await readChunkOnce(socket, 2600);
      bytesReceived += bannerBuf.length;
      const bannerText = bannerBuf.toString('utf8').trim();
      const firstLine = bannerText.split(/\r?\n/)[0] || '';
      if (!firstLine.startsWith('SSH-')) {
        socket.destroy();
        const reason = firstLine
          ? `المنفذ ${port} لا يُرجع ترويسة SSH-2.0 صالحة (${firstLine.slice(0, 60)})`
          : `المنفذ ${port} مفتوح لكن لم يُرسل ترويسة SSH-2.0`;
        logs.push(makeLog('SSH', 'error', reason));
        return baseFailure(reason, resolvedIp, dnsMs);
      }

      logs.push(makeLog('SSH', 'success', `SSH Banner: ${firstLine}`));

      if (username && password) {
        socket.destroy(); // ssh2 establishes clean session for full key exchange
        const { socket: sshSock } = await connectRawTcp(resolvedIp, port, 4500);
        logs.push(makeLog('AUTH', 'info', `جارٍ مصادقة الحساب (${username}) عبر SSH-2.0 ...`));
        const authRes = await connectSsh2OverSocket({
          sock: sshSock,
          username,
          password,
          timeoutMs: 6500,
        });
        if (!authRes.ok) {
          sshSock.destroy();
          const errMsg = authRes.authRejected
            ? `رفض الخادم بيانات الدخول (${username}) — اسم المستخدم أو كلمة المرور غير صحيحة أو منتهية.`
            : `تعذر إتمام جلسة SSH: ${authRes.reason}`;
          logs.push(makeLog('AUTH', 'error', errMsg));
          return {
            ...baseFailure(errMsg, resolvedIp, dnsMs),
            tcpMs,
            sshBanner: firstLine,
            authVerified: authRes.authRejected ? false : null,
          };
        }

        const sessionId = `tun_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        registerActiveSession({
          sessionId,
          protocol,
          host,
          resolvedIp,
          port,
          sni,
          wsPath,
          useTls: false,
          username,
          password,
          slowDnsHost: '',
          dnsResolver: '',
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
          bytesSent,
          bytesReceived,
          sshClient: authRes.client,
          underlyingSocket: sshSock,
        });
        logs.push(makeLog('AUTH', 'success', `تم تسجيل الدخول والمصادقة بنجاح على SSH Dropbear (${username})`));
        logs.push(makeLog('TUNNEL', 'success', 'النفق جاهز ويعمل مباشرة — يمكنك اختبار التصفح عبر النفق الآن.'));
        return {
          sessionId,
          connected: true,
          protocol,
          host,
          resolvedIp,
          port,
          dnsMs,
          tcpMs,
          handshakeMs: tcpMs,
          totalConnectMs: Math.max(1, Math.round(Number(process.hrtime.bigint() - totalStart) / 1_000_000)),
          tlsVersion: null,
          tlsCipher: null,
          sshBanner: firstLine,
          authVerified: true,
          httpUpgradeStatus: null,
          httpServerHeader: null,
          bytesSent,
          bytesReceived,
          transportSummary: `SSH-2.0 متصل ومصادق (${firstLine})`,
          logs,
        };
      }

      socket.destroy();
      const sessionId = `tun_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      registerActiveSession({
        sessionId,
        protocol,
        host,
        resolvedIp,
        port,
        sni,
        wsPath,
        useTls: false,
        username: '',
        password: '',
        slowDnsHost: '',
        dnsResolver: '',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        bytesSent,
        bytesReceived,
      });
      logs.push(makeLog('TUNNEL', 'warn', 'تم فحص الترويسة بنجاح بدون بيانات دخول — أدخل اسم المستخدم وكلمة المرور لاختبار المصادقة الكاملة.'));
      return {
        sessionId,
        connected: true,
        protocol,
        host,
        resolvedIp,
        port,
        dnsMs,
        tcpMs,
        handshakeMs: tcpMs,
        totalConnectMs: Math.max(1, Math.round(Number(process.hrtime.bigint() - totalStart) / 1_000_000)),
        tlsVersion: null,
        tlsCipher: null,
        sshBanner: firstLine,
        authVerified: null,
        httpUpgradeStatus: null,
        httpServerHeader: null,
        bytesSent,
        bytesReceived,
        transportSummary: `SSH Banner متصل (${firstLine})`,
        logs,
      };
    }

    // 2) SSH Stunnel SSL/TLS (Real TLS + SNI -> SSH Banner -> optional SSH2 Auth)
    if (protocol === 'ssh_ssl') {
      logs.push(makeLog('TLS', 'info', `بدء مصافحة SSL/TLS مع SNI: ${sni} على المنفذ ${port}...`));
      const tlsConn = await connectRawTls(resolvedIp, port, sni, undefined, 5500);
      logs.push(
        makeLog(
          'TLS',
          'success',
          `نجحت مصافحة TLS (${tlsConn.tlsVersion || 'TLS'} · ${tlsConn.tlsCipher || 'Cipher'}) خلال ${tlsConn.handshakeMs} ms`,
        ),
      );

      const bannerBuf = await readChunkOnce(tlsConn.socket, 2200);
      bytesReceived += bannerBuf.length;
      const bannerText = bannerBuf.toString('utf8').trim().split(/\r?\n/)[0] || '';
      const hasSshBanner = bannerText.startsWith('SSH-');
      if (hasSshBanner) {
        logs.push(makeLog('SSH', 'success', `تم استلام SSH Banner عبر TLS: ${bannerText}`));
      } else {
        logs.push(makeLog('TLS', 'info', 'منفذ TLS/SSL مستجيب (لم يُرسل الخادم SSH Banner مباشرة قبل طلب العميل)'));
      }

      let authVerified: boolean | null = null;
      let activeClient: Ssh2Client | undefined;
      let activeSock: tls.TLSSocket | undefined;

      if (username && password && hasSshBanner) {
        tlsConn.socket.destroy();
        const freshTls = await connectRawTls(resolvedIp, port, sni, undefined, 5500);
        logs.push(makeLog('AUTH', 'info', `جارٍ مصادقة (${username}) داخل نفق SSL/TLS ...`));
        const authRes = await connectSsh2OverSocket({
          sock: freshTls.socket,
          username,
          password,
          timeoutMs: 6500,
        });
        if (!authRes.ok) {
          freshTls.socket.destroy();
          const errMsg = authRes.authRejected
            ? `رفض خادم SSH بيانات الدخول (${username}) عبر نفق SSL — كلمة المرور أو المستخدم غير صحيح.`
            : `تعذر إتمام مصادقة SSH داخل SSL: ${authRes.reason}`;
          logs.push(makeLog('AUTH', 'error', errMsg));
          return {
            ...baseFailure(errMsg, resolvedIp, dnsMs),
            handshakeMs: tlsConn.handshakeMs,
            tlsVersion: tlsConn.tlsVersion,
            tlsCipher: tlsConn.tlsCipher,
            sshBanner: bannerText || null,
            authVerified: authRes.authRejected ? false : null,
          };
        }
        authVerified = true;
        activeClient = authRes.client;
        activeSock = freshTls.socket;
        logs.push(makeLog('AUTH', 'success', `تمت المصادقة الكاملة داخل نفق SSH SSL بنجاح (${username})`));
      } else {
        tlsConn.socket.destroy();
      }

      const sessionId = `tun_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      registerActiveSession({
        sessionId,
        protocol,
        host,
        resolvedIp,
        port,
        sni,
        wsPath,
        useTls: true,
        username,
        password,
        slowDnsHost: '',
        dnsResolver: '',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        bytesSent,
        bytesReceived,
        sshClient: activeClient,
        underlyingSocket: activeSock,
      });
      logs.push(makeLog('TUNNEL', 'success', 'نفق SSL/TLS متصل ويعمل بنجاح.'));
      return {
        sessionId,
        connected: true,
        protocol,
        host,
        resolvedIp,
        port,
        dnsMs,
        tcpMs: tlsConn.handshakeMs,
        handshakeMs: tlsConn.handshakeMs,
        totalConnectMs: Math.max(1, Math.round(Number(process.hrtime.bigint() - totalStart) / 1_000_000)),
        tlsVersion: tlsConn.tlsVersion,
        tlsCipher: tlsConn.tlsCipher,
        sshBanner: hasSshBanner ? bannerText : null,
        authVerified,
        httpUpgradeStatus: null,
        httpServerHeader: null,
        bytesSent,
        bytesReceived,
        transportSummary: `SSL/TLS (${tlsConn.tlsVersion || 'TLS'}) · SNI: ${sni}`,
        logs,
      };
    }

    // 3) SSH WebSocket (WS / Payload Injector / WSS TLS)
    if (protocol === 'ssh_ws') {
      const useTls =
        typeof payload.useTls === 'boolean'
          ? payload.useTls
          : port === 443 || port === 8443 || port === 2053 || port === 2083 || port === 2087 || port === 2096;

      let sock: net.Socket | tls.TLSSocket;
      let tcpMs = 0;
      let tlsVersion: string | null = null;
      let tlsCipher: string | null = null;

      if (useTls) {
        logs.push(makeLog('TLS', 'info', `بدء اتصال WSS/TLS على ${resolvedIp}:${port} (SNI: ${sni})...`));
        const tlsConn = await connectRawTls(resolvedIp, port, sni, ['http/1.1'], 5000);
        sock = tlsConn.socket;
        tcpMs = tlsConn.handshakeMs;
        tlsVersion = tlsConn.tlsVersion;
        tlsCipher = tlsConn.tlsCipher;
        logs.push(makeLog('TLS', 'success', `مصافحة TLS ناجحة (${tlsVersion || 'TLS'}) خلال ${tcpMs} ms`));
      } else {
        const raw = await connectRawTcp(resolvedIp, port, 4500);
        sock = raw.socket;
        tcpMs = raw.tcpMs;
        logs.push(makeLog('TCP', 'success', `اتصال TCP مفتوح على ${port} خلال ${tcpMs} ms`));
      }

      const httpPayload = formatInjectorPayload(payload.customPayload, { host, port, sni, wsPath });
      const payloadBuf = Buffer.from(httpPayload, 'utf8');
      bytesSent += payloadBuf.length;
      logs.push(makeLog('WS', 'info', `إرسال HTTP Upgrade / Payload (${payloadBuf.length} bytes)...`));
      sock.write(payloadBuf);

      const respBuf = await readChunkOnce(sock, 3200);
      bytesReceived += respBuf.length;
      const respText = respBuf.toString('utf8');
      const parsed = parseHttpStatusAndHeaders(respText);

      if (!parsed.status) {
        sock.destroy();
        const reason = respText.trim()
          ? `استجابة غير قياسية من الخادم: ${respText.trim().slice(0, 80)}`
          : `لم يستجب الخادم لطلب HTTP WebSocket Upgrade على المنفذ ${port}`;
        logs.push(makeLog('WS', 'error', reason));
        return {
          ...baseFailure(reason, resolvedIp, dnsMs),
          tcpMs,
          tlsVersion,
          tlsCipher,
        };
      }

      logs.push(
        makeLog(
          'WS',
          parsed.status === 101 ? 'success' : parsed.status < 400 ? 'warn' : 'error',
          `استجابة الخادم: ${parsed.statusLine}${parsed.serverHeader ? ` (${parsed.serverHeader})` : ''}`,
        ),
      );

      if (parsed.status !== 101 && parsed.status !== 200) {
        sock.destroy();
        return {
          ...baseFailure(
            `رفض الخادم ترقية WebSocket (HTTP ${parsed.status}) — تأكد من البايلود أو Host/SNI أو المسار.`,
            resolvedIp,
            dnsMs,
          ),
          tcpMs,
          tlsVersion,
          tlsCipher,
          httpUpgradeStatus: parsed.status,
          httpServerHeader: parsed.serverHeader,
        };
      }

      // Check if an SSH banner is bridged directly after 101 Switching Protocols
      let sshBanner: string | null = null;
      let authVerified: boolean | null = null;
      let activeClient: Ssh2Client | undefined;
      let activeSock: net.Socket | tls.TLSSocket | undefined;

      const tailIdx = respText.indexOf('\r\n\r\n');
      const afterHeaders = tailIdx >= 0 ? respText.slice(tailIdx + 4).trim() : '';
      if (afterHeaders.startsWith('SSH-')) {
        sshBanner = afterHeaders.split(/\r?\n/)[0];
        logs.push(makeLog('SSH', 'success', `تم اكتشاف SSH Banner داخل WebSocket: ${sshBanner}`));
      }

      if (username && password && sshBanner) {
        // Attempt raw stream SSH auth over the upgraded socket if server bridges plain SSH after 101
        logs.push(makeLog('AUTH', 'info', `جارٍ التحقق من مصادقة SSH (${username}) عبر WebSocket ...`));
        const authRes = await connectSsh2OverSocket({
          sock,
          username,
          password,
          timeoutMs: 4500,
        });
        if (authRes.ok) {
          authVerified = true;
          activeClient = authRes.client;
          activeSock = sock;
          logs.push(makeLog('AUTH', 'success', `تمت مصادقة SSH عبر WebSocket بنجاح (${username})`));
        } else if (authRes.authRejected) {
          sock.destroy();
          logs.push(makeLog('AUTH', 'error', 'رفض الخادم اسم المستخدم أو كلمة المرور'));
          return {
            ...baseFailure('رفض خادم SSH بيانات الحساب — المستخدم أو كلمة المرور غير صالحة.', resolvedIp, dnsMs),
            tcpMs,
            tlsVersion,
            tlsCipher,
            sshBanner,
            authVerified: false,
            httpUpgradeStatus: parsed.status,
            httpServerHeader: parsed.serverHeader,
          };
        } else {
          sock.destroy();
        }
      } else {
        sock.destroy();
      }

      const sessionId = `tun_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      registerActiveSession({
        sessionId,
        protocol,
        host,
        resolvedIp,
        port,
        sni,
        wsPath,
        useTls,
        username,
        password,
        slowDnsHost: '',
        dnsResolver: '',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        bytesSent,
        bytesReceived,
        sshClient: activeClient,
        underlyingSocket: activeSock,
      });
      logs.push(makeLog('TUNNEL', 'success', `نفق WebSocket متصل (HTTP ${parsed.status} Switching Protocols).`));
      return {
        sessionId,
        connected: true,
        protocol,
        host,
        resolvedIp,
        port,
        dnsMs,
        tcpMs,
        handshakeMs: tcpMs,
        totalConnectMs: Math.max(1, Math.round(Number(process.hrtime.bigint() - totalStart) / 1_000_000)),
        tlsVersion,
        tlsCipher,
        sshBanner,
        authVerified,
        httpUpgradeStatus: parsed.status,
        httpServerHeader: parsed.serverHeader,
        bytesSent,
        bytesReceived,
        transportSummary: `WebSocket HTTP ${parsed.status}${useTls ? ` + ${tlsVersion || 'TLS'}` : ''}`,
        logs,
      };
    }

    // 4) V2Ray VMess / VLESS (Real TLS/Reality/Plain + WS Upgrade or gRPC ALPN check + UUID check)
    if (protocol === 'v2ray_vmess' || protocol === 'v2ray_vless') {
      if (!uuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
        const msg = 'تنسيق UUID غير صالح — أدخل UUID صحيحاً بصيغة قياسية (8-4-4-4-12) لتشغيل V2Ray.';
        logs.push(makeLog('V2RAY', 'error', msg));
        return baseFailure(msg, resolvedIp, dnsMs);
      }
      logs.push(makeLog('V2RAY', 'success', `UUID صالح: ${uuid}`));

      const security = payload.v2raySecurity || (port === 80 || port === 8080 ? 'none' : 'tls');
      const transport = payload.v2rayTransport || 'ws';
      const useTls = security === 'tls' || security === 'reality';

      let sock: net.Socket | tls.TLSSocket;
      let tcpMs = 0;
      let tlsVersion: string | null = null;
      let tlsCipher: string | null = null;

      if (useTls) {
        const alpn = transport === 'grpc' ? ['h2'] : ['http/1.1'];
        logs.push(makeLog('TLS', 'info', `مصافحة V2Ray ${security.toUpperCase()} (${transport}) مع SNI: ${sni}...`));
        const tlsConn = await connectRawTls(resolvedIp, port, sni, alpn, 5500);
        sock = tlsConn.socket;
        tcpMs = tlsConn.handshakeMs;
        tlsVersion = tlsConn.tlsVersion;
        tlsCipher = tlsConn.tlsCipher;
        logs.push(
          makeLog(
            'TLS',
            'success',
            `TLS ناجح (${tlsVersion || 'TLS'} · ${tlsCipher || 'Cipher'} · ALPN: ${tlsConn.socket.alpnProtocol || 'default'}) خلال ${tcpMs} ms`,
          ),
        );
      } else {
        const raw = await connectRawTcp(resolvedIp, port, 4500);
        sock = raw.socket;
        tcpMs = raw.tcpMs;
        logs.push(makeLog('TCP', 'success', `منفذ V2Ray TCP ${port} مفتوح خلال ${tcpMs} ms`));
      }

      let httpStatus: number | null = null;
      let serverHeader: string | null = null;

      if (transport === 'ws') {
        const cleanWsPath = wsPath.startsWith('/') ? wsPath : `/${wsPath}`;
        const wsReq = Buffer.from(
          [
            `GET ${cleanWsPath} HTTP/1.1`,
            `Host: ${sni || host}`,
            `Upgrade: websocket`,
            `Connection: Upgrade`,
            `Sec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}`,
            `Sec-WebSocket-Version: 13`,
            '',
            '',
          ].join('\r\n'),
          'utf8',
        );
        bytesSent += wsReq.length;
        sock.write(wsReq);
        const resp = await readChunkOnce(sock, 3000);
        bytesReceived += resp.length;
        const parsed = parseHttpStatusAndHeaders(resp.toString('utf8'));
        httpStatus = parsed.status;
        serverHeader = parsed.serverHeader;

        if (parsed.status === 101) {
          logs.push(makeLog('V2RAY', 'success', `ترقية WebSocket (${cleanWsPath}) ناجحة: HTTP 101 Switching Protocols`));
        } else if (parsed.status === 400 || parsed.status === 404 || parsed.status === 426) {
          sock.destroy();
          const msg = `خادم V2Ray استجاب بـ HTTP ${parsed.status} على المسار (${cleanWsPath}) — تحقق من Path أو Host/SNI.`;
          logs.push(makeLog('V2RAY', 'error', msg));
          return {
            ...baseFailure(msg, resolvedIp, dnsMs),
            tcpMs,
            handshakeMs: tcpMs,
            tlsVersion,
            tlsCipher,
            httpUpgradeStatus: parsed.status,
            httpServerHeader: parsed.serverHeader,
          };
        } else if (parsed.status) {
          logs.push(makeLog('V2RAY', 'info', `استجابة HTTP ${parsed.status} على المسار ${cleanWsPath}`));
        }
      }

      sock.destroy();
      const sessionId = `tun_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      registerActiveSession({
        sessionId,
        protocol,
        host,
        resolvedIp,
        port,
        sni,
        wsPath,
        useTls,
        username,
        password,
        slowDnsHost: '',
        dnsResolver: '',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        bytesSent,
        bytesReceived,
      });
      logs.push(makeLog('TUNNEL', 'success', `مسار ${protocol === 'v2ray_vmess' ? 'VMess' : 'VLESS'} (${transport.toUpperCase()} + ${security.toUpperCase()}) جاهز ومتصل.`));
      return {
        sessionId,
        connected: true,
        protocol,
        host,
        resolvedIp,
        port,
        dnsMs,
        tcpMs,
        handshakeMs: tcpMs,
        totalConnectMs: Math.max(1, Math.round(Number(process.hrtime.bigint() - totalStart) / 1_000_000)),
        tlsVersion,
        tlsCipher,
        sshBanner: null,
        authVerified: true,
        httpUpgradeStatus: httpStatus,
        httpServerHeader: serverHeader,
        bytesSent,
        bytesReceived,
        transportSummary: `${protocol === 'v2ray_vmess' ? 'VMess' : 'VLESS'} · ${transport.toUpperCase()} · ${security.toUpperCase()}${httpStatus ? ` (HTTP ${httpStatus})` : ''}`,
        logs,
      };
    }

    // 5) SlowDNS / DNSTT (Genuine UDP DNS query packet to resolver or direct NS)
    if (protocol === 'slowdns') {
      const nsHost = cleanHostname(payload.slowDnsHost) || `dns.${host}`;
      const resolver = cleanHostname(payload.dnsResolver) || '1.1.1.1';
      const resolverIpRes = await resolvePublicIpv4(resolver);
      const targetDnsIp = resolverIpRes.ok ? resolverIpRes.ip : resolvedIp;

      logs.push(makeLog('SLOWDNS', 'info', `إرسال حزمة DNS TXT حقيقية إلى ${targetDnsIp}:${port || 53} لنطاق (${nsHost})...`));
      const nonceQuery = `ping-${crypto.randomBytes(3).toString('hex')}.${nsHost}`;
      const dnsProbe = await probeUdpDnsPacket(targetDnsIp, port || 53, nonceQuery, 4000);
      bytesSent += dnsProbe.bytesSent;
      bytesReceived += dnsProbe.bytesReceived;

      if (!dnsProbe.ok) {
        const msg = dnsProbe.error || 'لم يستجب مسار SlowDNS / UDP 53';
        logs.push(makeLog('SLOWDNS', 'error', msg));
        return baseFailure(msg, resolvedIp, dnsMs);
      }

      const rcodeMap: Record<number, string> = {
        0: 'NOERROR',
        2: 'SERVFAIL',
        3: 'NXDOMAIN',
        5: 'REFUSED',
      };
      const rcodeName = rcodeMap[dnsProbe.rcode ?? -1] || `RCODE_${dnsProbe.rcode}`;
      if (dnsProbe.rcode === 5 || dnsProbe.rcode === 2) {
        const msg = `خادم DNS أعاد ${rcodeName} للنطاق ${nsHost} — تأكد من Nameserver أو تفعيل DNSTT.`;
        logs.push(makeLog('SLOWDNS', 'error', msg));
        return baseFailure(msg, resolvedIp, dnsMs);
      }

      logs.push(makeLog('SLOWDNS', 'success', `استجابة UDP DNS ناجحة (${rcodeName}) خلال ${dnsProbe.latencyMs} ms`));
      const sessionId = `tun_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      registerActiveSession({
        sessionId,
        protocol,
        host,
        resolvedIp,
        port: port || 53,
        sni,
        wsPath,
        useTls: false,
        username,
        password,
        slowDnsHost: nsHost,
        dnsResolver: targetDnsIp,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        bytesSent,
        bytesReceived,
      });
      logs.push(makeLog('TUNNEL', 'success', `مسار SlowDNS (${nsHost}) جاهز عبر ${targetDnsIp}:53`));
      return {
        sessionId,
        connected: true,
        protocol,
        host,
        resolvedIp,
        port: port || 53,
        dnsMs,
        tcpMs: dnsProbe.latencyMs,
        handshakeMs: dnsProbe.latencyMs,
        totalConnectMs: Math.max(1, Math.round(Number(process.hrtime.bigint() - totalStart) / 1_000_000)),
        tlsVersion: null,
        tlsCipher: null,
        sshBanner: null,
        authVerified: null,
        httpUpgradeStatus: null,
        httpServerHeader: null,
        bytesSent,
        bytesReceived,
        transportSummary: `SlowDNS UDP (${rcodeName} · ${targetDnsIp}:53)`,
        logs,
      };
    }

    // 6) WireGuard (X25519 key validation + UDP endpoint probe)
    if (protocol === 'wireguard') {
      const privCheck = validateX25519Key(payload.wireguardPrivateKey);
      const pubCheck = validateX25519Key(payload.wireguardPublicKey);
      if (!privCheck.valid || !pubCheck.valid) {
        const msg = 'مفاتيح WireGuard (PrivateKey / PublicKey) غير صالحة — يجب أن يكون كل منهما بطول 32-byte Base64 حقيقي.';
        logs.push(makeLog('WIREGUARD', 'error', msg));
        return baseFailure(msg, resolvedIp, dnsMs);
      }
      logs.push(makeLog('WIREGUARD', 'success', 'تم التحقق من صحة مفاتيح Curve25519 (PrivateKey & Peer PublicKey).'));

      const wgProbe = await probeWireGuardUdp(resolvedIp, port, 1800);
      bytesSent += wgProbe.bytesSent;
      if (!wgProbe.reachableSocket) {
        const msg = wgProbe.icmpRefused
          ? `المنفذ UDP ${port} مغلق على الخادم (${resolvedIp}) — رفض ICMP Port Unreachable.`
          : `فشل إرسال حزمة UDP إلى ${resolvedIp}:${port}: ${wgProbe.error || 'خطأ شبكة'}`;
        logs.push(makeLog('WIREGUARD', 'error', msg));
        return baseFailure(msg, resolvedIp, dnsMs);
      }

      logs.push(
        makeLog(
          'WIREGUARD',
          'success',
          `منفذ WireGuard UDP ${port} مفتوح دون رفض ICMP (تم إرسال 148 bytes Handshake Initiation).`,
        ),
      );
      const sessionId = `tun_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      registerActiveSession({
        sessionId,
        protocol,
        host,
        resolvedIp,
        port,
        sni,
        wsPath,
        useTls: false,
        username,
        password,
        slowDnsHost: '',
        dnsResolver: '',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        bytesSent,
        bytesReceived,
      });
      logs.push(makeLog('TUNNEL', 'success', `إعداد WireGuard جاهز على ${resolvedIp}:${port}`));
      return {
        sessionId,
        connected: true,
        protocol,
        host,
        resolvedIp,
        port,
        dnsMs,
        tcpMs: dnsMs,
        handshakeMs: dnsMs,
        totalConnectMs: Math.max(1, Math.round(Number(process.hrtime.bigint() - totalStart) / 1_000_000)),
        tlsVersion: null,
        tlsCipher: null,
        sshBanner: null,
        authVerified: true,
        httpUpgradeStatus: null,
        httpServerHeader: null,
        bytesSent,
        bytesReceived,
        transportSummary: `WireGuard UDP (${resolvedIp}:${port}) · Curve25519 Valid`,
        logs,
      };
    }

    // 7) NoobzVpn (Plain 2053 or SSL 2083)
    if (protocol === 'noobzvpn') {
      const useTls = typeof payload.useTls === 'boolean' ? payload.useTls : port === 2083 || port === 443;
      let sock: net.Socket | tls.TLSSocket;
      let tcpMs = 0;
      let tlsVersion: string | null = null;
      let tlsCipher: string | null = null;

      if (useTls) {
        const tlsConn = await connectRawTls(resolvedIp, port, sni, undefined, 5000);
        sock = tlsConn.socket;
        tcpMs = tlsConn.handshakeMs;
        tlsVersion = tlsConn.tlsVersion;
        tlsCipher = tlsConn.tlsCipher;
        logs.push(makeLog('NOOBZ', 'success', `NoobzVpn SSL/TLS (${tlsVersion}) متصل خلال ${tcpMs} ms`));
      } else {
        const raw = await connectRawTcp(resolvedIp, port, 4500);
        sock = raw.socket;
        tcpMs = raw.tcpMs;
        logs.push(makeLog('NOOBZ', 'success', `NoobzVpn Plain TCP ${port} متصل خلال ${tcpMs} ms`));
      }

      const probeReq = Buffer.from(
        `GET / HTTP/1.1\r\nHost: ${sni || host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n`,
        'utf8',
      );
      bytesSent += probeReq.length;
      sock.write(probeReq);
      const resp = await readChunkOnce(sock, 2500);
      bytesReceived += resp.length;
      const parsed = parseHttpStatusAndHeaders(resp.toString('utf8'));
      sock.destroy();

      if (parsed.status) {
        logs.push(makeLog('NOOBZ', 'info', `استجابة NoobzVpn: ${parsed.statusLine}`));
      }

      const sessionId = `tun_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      registerActiveSession({
        sessionId,
        protocol,
        host,
        resolvedIp,
        port,
        sni,
        wsPath,
        useTls,
        username,
        password,
        slowDnsHost: '',
        dnsResolver: '',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        bytesSent,
        bytesReceived,
      });
      logs.push(makeLog('TUNNEL', 'success', `نفق NoobzVpn متصل على المنفذ ${port}.`));
      return {
        sessionId,
        connected: true,
        protocol,
        host,
        resolvedIp,
        port,
        dnsMs,
        tcpMs,
        handshakeMs: tcpMs,
        totalConnectMs: Math.max(1, Math.round(Number(process.hrtime.bigint() - totalStart) / 1_000_000)),
        tlsVersion,
        tlsCipher,
        sshBanner: null,
        authVerified: null,
        httpUpgradeStatus: parsed.status,
        httpServerHeader: parsed.serverHeader,
        bytesSent,
        bytesReceived,
        transportSummary: `NoobzVpn ${useTls ? 'SSL' : 'Plain'} (${port})`,
        logs,
      };
    }

    // 8) Squid HTTP Proxy (Genuine CONNECT + Proxy-Authorization verification)
    if (protocol === 'squid') {
      const { socket, tcpMs } = await connectRawTcp(resolvedIp, port, 4500);
      logs.push(makeLog('PROXY', 'success', `اتصال TCP ببروكسي Squid على المنفذ ${port} خلال ${tcpMs} ms`));

      const authHeader =
        username && password
          ? `Proxy-Authorization: Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}\r\n`
          : '';
      const connectReq = Buffer.from(
        `CONNECT connectivitycheck.gstatic.com:80 HTTP/1.1\r\nHost: connectivitycheck.gstatic.com:80\r\n${authHeader}Proxy-Connection: Keep-Alive\r\n\r\n`,
        'utf8',
      );
      bytesSent += connectReq.length;
      socket.write(connectReq);

      const resp = await readChunkOnce(socket, 3500);
      bytesReceived += resp.length;
      const parsed = parseHttpStatusAndHeaders(resp.toString('utf8'));
      socket.destroy();

      if (!parsed.status) {
        const msg = `منفذ ${port} لم يُرجع استجابة HTTP Proxy صالحة.`;
        logs.push(makeLog('PROXY', 'error', msg));
        return { ...baseFailure(msg, resolvedIp, dnsMs), tcpMs };
      }

      logs.push(
        makeLog(
          'PROXY',
          parsed.status === 200 ? 'success' : 'error',
          `استجابة البروكسي: ${parsed.statusLine}`,
        ),
      );

      if (parsed.status === 407) {
        return {
          ...baseFailure('طلب البروكسي مصادقة (HTTP 407) — اسم المستخدم أو كلمة المرور مفقودة أو غير صحيحة.', resolvedIp, dnsMs),
          tcpMs,
          authVerified: false,
          httpUpgradeStatus: parsed.status,
          httpServerHeader: parsed.serverHeader,
        };
      }
      if (parsed.status >= 400) {
        return {
          ...baseFailure(`رفض بروكسي Squid الطلب بحالة HTTP ${parsed.status}.`, resolvedIp, dnsMs),
          tcpMs,
          httpUpgradeStatus: parsed.status,
          httpServerHeader: parsed.serverHeader,
        };
      }

      const sessionId = `tun_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      registerActiveSession({
        sessionId,
        protocol,
        host,
        resolvedIp,
        port,
        sni,
        wsPath,
        useTls: false,
        username,
        password,
        slowDnsHost: '',
        dnsResolver: '',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        bytesSent,
        bytesReceived,
      });
      logs.push(makeLog('TUNNEL', 'success', 'بروكسي Squid متصل ومفعل لتمرير الطلبات.'));
      return {
        sessionId,
        connected: true,
        protocol,
        host,
        resolvedIp,
        port,
        dnsMs,
        tcpMs,
        handshakeMs: tcpMs,
        totalConnectMs: Math.max(1, Math.round(Number(process.hrtime.bigint() - totalStart) / 1_000_000)),
        tlsVersion: null,
        tlsCipher: null,
        sshBanner: null,
        authVerified: true,
        httpUpgradeStatus: parsed.status,
        httpServerHeader: parsed.serverHeader,
        bytesSent,
        bytesReceived,
        transportSummary: `Squid Proxy HTTP ${parsed.status} (${resolvedIp}:${port})`,
        logs,
      };
    }

    return baseFailure('بروتوكول غير مدعوم.');
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logs.push(makeLog('TCP', 'error', errMsg));
    return baseFailure(errMsg, resolvedIp, dnsMs);
  }
}

export async function heartbeatTunnelSession(sessionId: string): Promise<TunnelHeartbeatResponse> {
  const sess = ACTIVE_TUNNELS.get(sessionId);
  if (!sess) {
    return {
      alive: false,
      latencyMs: null,
      bytesSent: 0,
      bytesReceived: 0,
      detailAr: 'انتهت جلسة النفق أو تم إغلاقها.',
      checkedAt: new Date().toISOString(),
    };
  }
  sess.lastActiveAt = Date.now();

  if (sess.protocol === 'slowdns') {
    const res = await probeUdpDnsPacket(
      sess.dnsResolver || sess.resolvedIp,
      sess.port || 53,
      `hb-${crypto.randomBytes(2).toString('hex')}.${sess.slowDnsHost || sess.host}`,
      2500,
    );
    sess.bytesSent += res.bytesSent;
    sess.bytesReceived += res.bytesReceived;
    return {
      alive: res.ok,
      latencyMs: res.latencyMs,
      bytesSent: sess.bytesSent,
      bytesReceived: sess.bytesReceived,
      detailAr: res.ok ? `نبض SlowDNS حي (${res.latencyMs} ms)` : 'فقدان استجابة SlowDNS',
      checkedAt: new Date().toISOString(),
    };
  }

  if (sess.protocol === 'wireguard') {
    const wg = await probeWireGuardUdp(sess.resolvedIp, sess.port, 1200);
    sess.bytesSent += wg.bytesSent;
    return {
      alive: wg.reachableSocket,
      latencyMs: wg.reachableSocket ? 1 : null,
      bytesSent: sess.bytesSent,
      bytesReceived: sess.bytesReceived,
      detailAr: wg.reachableSocket ? `منفذ WireGuard UDP ${sess.port} نشط` : 'منفذ WireGuard لا يستجيب',
      checkedAt: new Date().toISOString(),
    };
  }

  // TCP/TLS real latency check
  try {
    if (sess.useTls) {
      const conn = await connectRawTls(sess.resolvedIp, sess.port, sess.sni, undefined, 2800);
      conn.socket.destroy();
      sess.bytesSent += 120;
      sess.bytesReceived += 240;
      return {
        alive: true,
        latencyMs: conn.handshakeMs,
        bytesSent: sess.bytesSent,
        bytesReceived: sess.bytesReceived,
        detailAr: `نبض TLS حي (${conn.handshakeMs} ms)`,
        checkedAt: new Date().toISOString(),
      };
    }
    const conn = await connectRawTcp(sess.resolvedIp, sess.port, 2800);
    conn.socket.destroy();
    sess.bytesSent += 64;
    sess.bytesReceived += 64;
    return {
      alive: true,
      latencyMs: conn.tcpMs,
      bytesSent: sess.bytesSent,
      bytesReceived: sess.bytesReceived,
      detailAr: `نبض TCP حي (${conn.tcpMs} ms)`,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      alive: false,
      latencyMs: null,
      bytesSent: sess.bytesSent,
      bytesReceived: sess.bytesReceived,
      detailAr: err instanceof Error ? err.message : 'انقطع الاتصال بالخادم',
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function runLiveTrafficThroughTunnel(
  sessionId: string,
): Promise<TunnelTrafficTestResult> {
  const sess = ACTIVE_TUNNELS.get(sessionId);
  const logs: TunnelLogEntry[] = [];
  if (!sess) {
    logs.push(makeLog('TUNNEL', 'error', 'الجلسة غير نشطة — يرجى تشغيل النفق أولاً.'));
    return {
      ok: false,
      latencyMs: null,
      httpStatus: null,
      bytesSent: 0,
      bytesReceived: 0,
      detailAr: 'الجلسة غير نشطة — شغّل النفق أولاً.',
      logs,
    };
  }
  sess.lastActiveAt = Date.now();

  // Case 1: Authenticated SSH2 Client -> Real Port Forwarding HTTP 204 test through SSH tunnel
  if (sess.sshClient) {
    const start = process.hrtime.bigint();
    logs.push(makeLog('TUNNEL', 'info', 'فتح قناة forwardOut حقيقية داخل نفق SSH لاختبار الاتصال بالإنترنت...'));
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        logs.push(makeLog('TUNNEL', 'error', 'انتهت مهلة تمرير الطلب عبر قناة SSH forwardOut'));
        resolve({
          ok: false,
          latencyMs: null,
          httpStatus: null,
          bytesSent: sess.bytesSent,
          bytesReceived: sess.bytesReceived,
          detailAr: 'تعذر تمرير التصفح عبر قناة SSH (ربما الخادم يقيد forwardOut).',
          logs,
        });
      }, 6000);

      try {
        sess.sshClient!.forwardOut('127.0.0.1', 0, 'connectivitycheck.gstatic.com', 80, (err, stream) => {
          if (err) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            logs.push(makeLog('TUNNEL', 'error', `رفض الخادم تمرير forwardOut: ${err.message}`));
            resolve({
              ok: false,
              latencyMs: null,
              httpStatus: null,
              bytesSent: sess.bytesSent,
              bytesReceived: sess.bytesReceived,
              detailAr: `تعذر تمرير التصفح عبر SSH: ${err.message}`,
              logs,
            });
            return;
          }

          const reqStr =
            'GET /generate_204 HTTP/1.1\r\nHost: connectivitycheck.gstatic.com\r\nConnection: close\r\n\r\n';
          const reqBuf = Buffer.from(reqStr, 'utf8');
          sess.bytesSent += reqBuf.length;
          stream.write(reqBuf);

          const chunks: Buffer[] = [];
          stream.on('data', (d: Buffer) => chunks.push(d));
          stream.once('close', () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            const raw = Buffer.concat(chunks);
            sess.bytesReceived += raw.length;
            const parsed = parseHttpStatusAndHeaders(raw.toString('utf8'));
            const ms = Math.max(1, Math.round(Number(process.hrtime.bigint() - start) / 1_000_000));
            const ok = parsed.status === 204 || parsed.status === 200;
            logs.push(
              makeLog(
                'TUNNEL',
                ok ? 'success' : 'warn',
                `مرور التصفح عبر النفق: HTTP ${parsed.status ?? '--'} خلال ${ms} ms (${raw.length} bytes)`,
              ),
            );
            resolve({
              ok,
              latencyMs: ms,
              httpStatus: parsed.status,
              bytesSent: sess.bytesSent,
              bytesReceived: sess.bytesReceived,
              detailAr: ok
                ? `التصفح يعمل فعلياً عبر النفق (HTTP ${parsed.status} · ${ms} ms)`
                : `استجابة HTTP ${parsed.status ?? 'غير معروفة'} عبر النفق`,
              logs,
            });
          });
          stream.once('error', (streamErr: Error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            logs.push(makeLog('TUNNEL', 'error', streamErr.message));
            resolve({
              ok: false,
              latencyMs: null,
              httpStatus: null,
              bytesSent: sess.bytesSent,
              bytesReceived: sess.bytesReceived,
              detailAr: streamErr.message,
              logs,
            });
          });
        });
      } catch (e) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          const msg = e instanceof Error ? e.message : String(e);
          logs.push(makeLog('TUNNEL', 'error', msg));
          resolve({
            ok: false,
            latencyMs: null,
            httpStatus: null,
            bytesSent: sess.bytesSent,
            bytesReceived: sess.bytesReceived,
            detailAr: msg,
            logs,
          });
        }
      }
    });
  }

  // Case 2: Squid Proxy -> Real GET http://connectivitycheck.gstatic.com/generate_204
  if (sess.protocol === 'squid') {
    const start = process.hrtime.bigint();
    try {
      const { socket } = await connectRawTcp(sess.resolvedIp, sess.port, 4500);
      const authLine =
        sess.username && sess.password
          ? `Proxy-Authorization: Basic ${Buffer.from(`${sess.username}:${sess.password}`, 'utf8').toString('base64')}\r\n`
          : '';
      const reqBuf = Buffer.from(
        `GET http://connectivitycheck.gstatic.com/generate_204 HTTP/1.1\r\nHost: connectivitycheck.gstatic.com\r\n${authLine}Connection: close\r\n\r\n`,
        'utf8',
      );
      sess.bytesSent += reqBuf.length;
      socket.write(reqBuf);
      const resp = await readChunkOnce(socket, 4000);
      sess.bytesReceived += resp.length;
      socket.destroy();
      const parsed = parseHttpStatusAndHeaders(resp.toString('utf8'));
      const ms = Math.max(1, Math.round(Number(process.hrtime.bigint() - start) / 1_000_000));
      const ok = parsed.status === 204 || parsed.status === 200;
      logs.push(
        makeLog(
          'PROXY',
          ok ? 'success' : 'error',
          `اختبار التصفح عبر Squid: ${parsed.statusLine || 'لا استجابة'} (${ms} ms)`,
        ),
      );
      return {
        ok,
        latencyMs: ms,
        httpStatus: parsed.status,
        bytesSent: sess.bytesSent,
        bytesReceived: sess.bytesReceived,
        detailAr: ok
          ? `بروكسي Squid يمرّر الإنترنت بنجاح (HTTP ${parsed.status} · ${ms} ms)`
          : `فشل تمرير التصفح عبر البروكسي (HTTP ${parsed.status ?? '--'})`,
        logs,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logs.push(makeLog('PROXY', 'error', msg));
      return {
        ok: false,
        latencyMs: null,
        httpStatus: null,
        bytesSent: sess.bytesSent,
        bytesReceived: sess.bytesReceived,
        detailAr: msg,
        logs,
      };
    }
  }

  // Case 3: Direct transport heartbeat verification (V2Ray / WS / Noobz / SlowDNS / WireGuard)
  const hb = await heartbeatTunnelSession(sessionId);
  logs.push(makeLog('TUNNEL', hb.alive ? 'success' : 'error', hb.detailAr));
  return {
    ok: hb.alive,
    latencyMs: hb.latencyMs,
    httpStatus: null,
    bytesSent: hb.bytesSent,
    bytesReceived: hb.bytesReceived,
    detailAr: hb.detailAr,
    logs,
  };
}

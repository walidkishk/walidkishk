import dns from 'node:dns';
import net from 'node:net';
import type { Request, Response } from 'express';

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 120;

interface SessionCookieJar {
  updatedAt: number;
  // domain -> cookieName -> cookieValue
  domains: Map<string, Map<string, string>>;
}

const sessionJars = new Map<string, SessionCookieJar>();

function pruneSessions(): void {
  const now = Date.now();
  for (const [id, jar] of sessionJars.entries()) {
    if (now - jar.updatedAt > SESSION_TTL_MS) {
      sessionJars.delete(id);
    }
  }
  while (sessionJars.size > MAX_SESSIONS) {
    const oldestKey = sessionJars.keys().next().value;
    if (!oldestKey) break;
    sessionJars.delete(oldestKey);
  }
}

function getOrCreateSessionJar(sessionId: string): SessionCookieJar | null {
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(sessionId)) return null;
  pruneSessions();
  let jar = sessionJars.get(sessionId);
  if (!jar) {
    jar = { updatedAt: Date.now(), domains: new Map() };
    sessionJars.set(sessionId, jar);
  }
  jar.updatedAt = Date.now();
  return jar;
}

function storeCookiesFromResponse(
  jar: SessionCookieJar | null,
  hostname: string,
  headers: Headers,
): void {
  if (!jar) return;
  const rawSetCookies =
    typeof (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : [];
  const fallback = headers.get('set-cookie');
  const allHeaders = rawSetCookies.length > 0 ? rawSetCookies : fallback ? [fallback] : [];
  if (allHeaders.length === 0) return;

  const domainKey = hostname.toLowerCase();
  let domainCookies = jar.domains.get(domainKey);
  if (!domainCookies) {
    domainCookies = new Map<string, string>();
    jar.domains.set(domainKey, domainCookies);
  }

  for (const raw of allHeaders) {
    const firstPart = raw.split(';')[0]?.trim();
    if (!firstPart) continue;
    const eqIdx = firstPart.indexOf('=');
    if (eqIdx <= 0) continue;
    const name = firstPart.slice(0, eqIdx).trim();
    const val = firstPart.slice(eqIdx + 1).trim();
    if (!name) continue;
    if (val === '' || /max-age=0/i.test(raw)) {
      domainCookies.delete(name);
    } else {
      domainCookies.set(name, val);
    }
  }
}

function buildCookieHeader(jar: SessionCookieJar | null, hostname: string): string {
  if (!jar) return '';
  const target = hostname.toLowerCase();
  const pairs: string[] = [];
  for (const [domain, cookies] of jar.domains.entries()) {
    if (target === domain || target.endsWith(`.${domain}`)) {
      for (const [k, v] of cookies.entries()) {
        pairs.push(`${k}=${v}`);
      }
    }
  }
  return pairs.join('; ');
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b, c] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast & reserved
  return false;
}

function isPrivateOrReservedIp(ip: string): boolean {
  const cleaned = ip.trim().toLowerCase().split('%')[0];
  if (!cleaned) return true;
  if (net.isIPv4(cleaned)) {
    return isPrivateOrReservedIpv4(cleaned);
  }
  if (net.isIPv6(cleaned)) {
    if (cleaned === '::' || cleaned === '::1') return true;
    if (cleaned.startsWith('::ffff:')) {
      const mappedV4 = cleaned.slice(7);
      if (net.isIPv4(mappedV4)) {
        return isPrivateOrReservedIpv4(mappedV4);
      }
    }
    // fc00::/7 ULA, fe80::/10 link-local, ff00::/8 multicast
    if (
      cleaned.startsWith('fc') ||
      cleaned.startsWith('fd') ||
      cleaned.startsWith('fe8') ||
      cleaned.startsWith('fe9') ||
      cleaned.startsWith('fea') ||
      cleaned.startsWith('feb') ||
      cleaned.startsWith('ff')
    ) {
      return true;
    }
    return false;
  }
  return true;
}

export function normalizeExternalScheme(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^tg:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed.replace(/^tg:\/\//i, 'https://t.me/'));
      const domain = u.searchParams.get('domain');
      const invite = u.searchParams.get('invite');
      if (domain) return `https://t.me/${encodeURIComponent(domain)}`;
      if (invite) return `https://t.me/+${encodeURIComponent(invite)}`;
      return `https://t.me${u.pathname}${u.search}`;
    } catch {
      return 'https://t.me/';
    }
  }
  if (/^whatsapp:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed.replace(/^whatsapp:\/\//i, 'https://api.whatsapp.com/'));
      return `https://api.whatsapp.com/send${u.search}`;
    } catch {
      return 'https://wa.me/';
    }
  }
  if (/^intent:\/\//i.test(trimmed)) {
    const fallbackMatch = trimmed.match(/S\.browser_fallback_url=([^;]+)/i);
    if (fallbackMatch?.[1]) {
      try {
        return decodeURIComponent(fallbackMatch[1]);
      } catch {
        return '';
      }
    }
    return '';
  }
  return trimmed;
}

async function validateExternalTargetUrl(rawUrl: string): Promise<URL> {
  const normalized = normalizeExternalScheme(rawUrl);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error('رابط غير صالح.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('يُسمح فقط بروابط HTTP و HTTPS داخل المتصفح الداخلي.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('لا يُسمح ببيانات المصادقة المضمنة في الرابط.');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    throw new Error('الوصول إلى العناوين المحلية محظور لأسباب أمنية.');
  }

  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error('الوصول إلى عناوين الشبكة الداخلية محظور.');
    }
    return parsed;
  }

  const records = await dns.promises.lookup(host, { all: true }).catch(() => []);
  if (records.length === 0) {
    throw new Error('تعذر حل اسم النطاق (DNS) لهذا الموقع.');
  }
  for (const rec of records) {
    if (isPrivateOrReservedIp(rec.address)) {
      throw new Error('تم حظر النطاق لأنه يشير إلى عنوان داخلي خاص.');
    }
  }
  return parsed;
}

function buildInjectedBridgeScript(
  finalUrl: string,
  wvSession: string,
  initialStorageJson: string,
): string {
  const safeFinalUrl = JSON.stringify(finalUrl).replace(/</g, '\\u003c');
  const safeSession = JSON.stringify(wvSession).replace(/</g, '\\u003c');
  const safeInitialStorage = initialStorageJson.replace(/</g, '\\u003c');

  return `<script data-vpnfastore-bridge="1">
(function() {
  var CURRENT_URL = ${safeFinalUrl};
  var WV_SESSION = ${safeSession};
  var PROXY_ENDPOINT = '/api/webview/proxy';
  var CURRENT_ORIGIN = '';
  try { CURRENT_ORIGIN = new URL(CURRENT_URL).origin; } catch (e) {}

  function postToShell(payload) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, '*');
      }
    } catch (e) {}
  }

  function isMessagingUrl(urlStr) {
    try {
      var u = new URL(urlStr, CURRENT_URL);
      var h = u.hostname.toLowerCase();
      var p = u.protocol.toLowerCase();
      if (p === 'whatsapp:' || p === 'tg:') return true;
      return (
        h === 'wa.me' ||
        h === 'api.whatsapp.com' ||
        h === 'chat.whatsapp.com' ||
        h === 'web.whatsapp.com' ||
        h === 't.me' ||
        h === 'telegram.me' ||
        h === 'telegram.dog' ||
        h === 'web.telegram.org'
      );
    } catch (e) {
      return false;
    }
  }

  function normalizeScheme(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    if (/^tg:\\/\\//i.test(s)) {
      try {
        var tu = new URL(s.replace(/^tg:\\/\\//i, 'https://t.me/'));
        var dom = tu.searchParams.get('domain');
        var inv = tu.searchParams.get('invite');
        if (dom) return 'https://t.me/' + encodeURIComponent(dom);
        if (inv) return 'https://t.me/+' + encodeURIComponent(inv);
        return 'https://t.me' + tu.pathname + tu.search;
      } catch (e) { return 'https://t.me/'; }
    }
    if (/^whatsapp:\\/\\//i.test(s)) {
      try {
        var wu = new URL(s.replace(/^whatsapp:\\/\\//i, 'https://api.whatsapp.com/'));
        return 'https://api.whatsapp.com/send' + wu.search;
      } catch (e) { return 'https://wa.me/'; }
    }
    if (/^intent:\\/\\//i.test(s)) {
      var m = s.match(/S\\.browser_fallback_url=([^;]+)/i);
      if (m && m[1]) {
        try { return decodeURIComponent(m[1]); } catch (e) {}
      }
      return '';
    }
    return s;
  }

  function resolveAgainstCurrent(raw) {
    var normalized = normalizeScheme(raw);
    if (!normalized) return '';
    try {
      return new URL(normalized, CURRENT_URL).href;
    } catch (e) {
      return '';
    }
  }

  function requestNavigation(targetUrl, forceSeparateTab) {
    var resolved = resolveAgainstCurrent(targetUrl);
    if (!resolved) return;
    if (!/^https?:/i.test(resolved)) return;
    var separate = Boolean(forceSeparateTab) || isMessagingUrl(resolved);
    postToShell({
      type: 'vpnfastore_webview_nav',
      url: resolved,
      targetMode: separate ? 'separate_tab' : 'same'
    });
  }

  // 1. Virtual DOM Storage / localStorage & sessionStorage shim (works even in isolated sandbox)
  function createMemoryStorage(initialObj, persistType) {
    var store = Object.create(null);
    if (initialObj && typeof initialObj === 'object') {
      Object.keys(initialObj).forEach(function(k) {
        store[String(k)] = String(initialObj[k]);
      });
    }
    function syncAll() {
      if (persistType === 'local' && CURRENT_ORIGIN) {
        var copy = {};
        Object.keys(store).forEach(function(k) { copy[k] = store[k]; });
        postToShell({
          type: 'vpnfastore_wv_storage_sync',
          origin: CURRENT_ORIGIN,
          data: copy
        });
      }
    }
    return {
      get length() { return Object.keys(store).length; },
      key: function(i) {
        var keys = Object.keys(store);
        return i >= 0 && i < keys.length ? keys[i] : null;
      },
      getItem: function(k) {
        var key = String(k);
        return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
      },
      setItem: function(k, v) {
        store[String(k)] = String(v);
        syncAll();
      },
      removeItem: function(k) {
        delete store[String(k)];
        syncAll();
      },
      clear: function() {
        store = Object.create(null);
        syncAll();
      }
    };
  }

  try {
    var initialMap = ${safeInitialStorage};
    var lsShim = createMemoryStorage(initialMap, 'local');
    var ssShim = createMemoryStorage(null, 'session');
    try {
      // Check if native localStorage is accessible; if blocked by opaque origin, install shim
      var testKey = '__wv_ls_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
    } catch (err) {
      try {
        Object.defineProperty(window, 'localStorage', { value: lsShim, configurable: true });
      } catch (e2) {}
      try {
        Object.defineProperty(window, 'sessionStorage', { value: ssShim, configurable: true });
      } catch (e3) {}
    }
  } catch (e) {}

  // 2. Completely block external window.open / popups — route everything inside the WebView
  try {
    window.open = function(url) {
      if (url) {
        requestNavigation(String(url), false);
      }
      return window;
    };
  } catch (e) {}

  // 3. Rewrite relative fetch & XHR calls so they proxy cleanly to the target origin
  try {
    var origFetch = window.fetch;
    if (typeof origFetch === 'function') {
      window.fetch = function(input, init) {
        try {
          var rawUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');
          if (rawUrl && !rawUrl.startsWith('data:') && !rawUrl.startsWith('blob:') && !rawUrl.startsWith(PROXY_ENDPOINT)) {
            var resolved = new URL(rawUrl, CURRENT_URL);
            if ((resolved.protocol === 'http:' || resolved.protocol === 'https:') && resolved.origin === CURRENT_ORIGIN) {
              var proxied = PROXY_ENDPOINT + '?url=' + encodeURIComponent(resolved.href) + '&wvSession=' + encodeURIComponent(WV_SESSION);
              if (typeof input === 'string') {
                return origFetch.call(window, proxied, init);
              }
            }
          }
        } catch (e) {}
        return origFetch.apply(window, arguments);
      };
    }
  } catch (e) {}

  // 4. Intercept ALL link clicks (capture phase) so nothing ever escapes to external Chrome
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.nodeType === 1 && el.tagName !== 'A' && el.tagName !== 'AREA') {
      el = el.parentElement;
    }
    if (!el) return;
    var rawHref = el.getAttribute('href');
    if (!rawHref) return;
    var trimmed = rawHref.trim();
    if (!trimmed || trimmed.charAt(0) === '#' || /^javascript:/i.test(trimmed)) return;
    if (el.hasAttribute('download')) return;

    e.preventDefault();
    e.stopPropagation();
    requestNavigation(trimmed, false);
  }, true);

  // 5. Intercept form submissions so GET/POST stay inside the same WebView
  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    var rawAction = form.getAttribute('action') || CURRENT_URL;
    var resolvedAction = resolveAgainstCurrent(rawAction) || CURRENT_URL;
    var method = (form.getAttribute('method') || 'GET').toUpperCase();

    if (method === 'GET') {
      e.preventDefault();
      e.stopPropagation();
      try {
        var fd = new FormData(form);
        var u = new URL(resolvedAction);
        fd.forEach(function(val, key) {
          if (typeof val === 'string') u.searchParams.set(key, val);
        });
        requestNavigation(u.href, false);
      } catch (err) {
        requestNavigation(resolvedAction, false);
      }
      return;
    }

    // POST form: submit through same-origin proxy inside the same iframe
    try {
      form.setAttribute('target', '_self');
      form.setAttribute(
        'action',
        PROXY_ENDPOINT + '?url=' + encodeURIComponent(resolvedAction) + '&wvSession=' + encodeURIComponent(WV_SESSION)
      );
      postToShell({ type: 'vpnfastore_webview_loading', url: resolvedAction });
    } catch (err) {}
  }, true);

  // 6. Report title & load completion to parent WebView shell
  function reportMeta(loaded) {
    postToShell({
      type: loaded ? 'vpnfastore_webview_loaded' : 'vpnfastore_webview_meta',
      url: CURRENT_URL,
      title: document.title || CURRENT_URL
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { reportMeta(false); });
  } else {
    reportMeta(false);
  }
  window.addEventListener('load', function() { reportMeta(true); });
})();
</script>`;
}

function rewriteHtmlForWebView(
  html: string,
  finalUrl: string,
  wvSession: string,
  initialStorageJson: string,
): string {
  const parsed = new URL(finalUrl);
  const baseHref = `${parsed.origin}${parsed.pathname.endsWith('/') ? parsed.pathname : parsed.pathname.replace(/[^/]*$/, '')}`;
  const safeBaseHref = baseHref.replace(/"/g, '&quot;');

  // Remove restrictive meta tags (CSP / X-Frame-Options) and target="_blank" attributes
  let rewritten = html
    .replace(/<meta[^>]+http-equiv=["']?(?:Content-Security-Policy|X-Frame-Options)["']?[^>]*>/gi, '')
    .replace(/(<(?:a|area|form)\b[^>]*?)\s+target=["']?(?:_blank|_top|_parent)["']?/gi, '$1')
    // Rewrite meta refresh redirects targeting whatsapp:// or tg:// or intent://
    .replace(
      /(<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url=)(whatsapp:\/\/[^"'>\s]+|tg:\/\/[^"'>\s]+|intent:\/\/[^"'>\s]+)/gi,
      (_m, prefix, rawTarget) => `${prefix}${normalizeExternalScheme(rawTarget) || finalUrl}`,
    );

  const hasBase = /<base\b/i.test(rewritten);
  const baseTag = hasBase ? '' : `<base href="${safeBaseHref}" target="_self" />`;
  const bridgeScript = buildInjectedBridgeScript(finalUrl, wvSession, initialStorageJson);
  const injection = `${baseTag}${bridgeScript}`;

  if (/<head(\s[^>]*)?>/i.test(rewritten)) {
    rewritten = rewritten.replace(/<head(\s[^>]*)?>/i, (match) => `${match}\n${injection}`);
  } else if (/<html(\s[^>]*)?>/i.test(rewritten)) {
    rewritten = rewritten.replace(/<html(\s[^>]*)?>/i, (match) => `${match}\n<head>${injection}</head>`);
  } else {
    rewritten = `<!doctype html><html><head>${injection}</head><body>${rewritten}</body></html>`;
  }

  return rewritten;
}

function renderProxyErrorHtml(targetUrl: string, messageAr: string): string {
  const escapedUrl = targetUrl
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const escapedMsg = messageAr
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .box { max-width: 460px; width: 100%; border: 1px solid #27272a; background: #18181b; border-radius: 14px; padding: 22px; text-align: center; }
    h2 { margin: 0 0 10px; font-size: 16px; color: #ffffff; }
    p { margin: 0 0 12px; font-size: 13px; line-height: 1.7; color: #a1a1aa; }
    .url { font-family: monospace; font-size: 11px; color: #34d399; word-break: break-all; direction: ltr; background: #09090b; border: 1px solid #27272a; padding: 8px 10px; border-radius: 8px; }
  </style>
  <script>
    try {
      window.parent.postMessage({ type: 'vpnfastore_webview_loaded', url: ${JSON.stringify(targetUrl).replace(/</g, '\\u003c')}, title: 'تعذر تحميل الصفحة' }, '*');
    } catch (e) {}
  </script>
</head>
<body>
  <div class="box">
    <h2>تعذر عرض الموقع داخل المتصفح الداخلي</h2>
    <p>${escapedMsg}</p>
    <div class="url">${escapedUrl}</div>
  </div>
</body>
</html>`;
}

export async function handleWebViewProxy(req: Request, res: Response): Promise<void> {
  const rawUrl =
    typeof req.query.url === 'string'
      ? req.query.url
      : typeof (req.body as { url?: unknown } | undefined)?.url === 'string'
        ? String((req.body as { url?: unknown }).url)
        : '';

  if (!rawUrl.trim()) {
    res.status(400).send(renderProxyErrorHtml('', 'يرجى تحديد رابط صالح لفتحه داخل التطبيق.'));
    return;
  }

  const wvSession =
    typeof req.query.wvSession === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(req.query.wvSession)
      ? req.query.wvSession
      : 'default_wv_session';
  const jar = getOrCreateSessionJar(wvSession);

  const initialStorageRaw =
    typeof req.query.ls === 'string' && req.query.ls.length <= 16_000 ? req.query.ls : '{}';
  let initialStorageJson = '{}';
  try {
    const parsedStorage = JSON.parse(initialStorageRaw);
    if (parsedStorage && typeof parsedStorage === 'object' && !Array.isArray(parsedStorage)) {
      initialStorageJson = JSON.stringify(parsedStorage);
    }
  } catch {
    initialStorageJson = '{}';
  }

  let currentUrlStr = rawUrl.trim();

  try {
    let rawBody: Buffer | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (Buffer.isBuffer(req.body)) {
        rawBody = req.body;
      } else if (typeof req.body === 'string') {
        rawBody = Buffer.from(req.body, 'utf-8');
      } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        const ct = String(req.headers['content-type'] || '');
        if (ct.includes('application/x-www-form-urlencoded')) {
          const params = new URLSearchParams();
          for (const [k, v] of Object.entries(req.body as Record<string, unknown>)) {
            params.append(k, String(v ?? ''));
          }
          rawBody = Buffer.from(params.toString(), 'utf-8');
        } else {
          rawBody = Buffer.from(JSON.stringify(req.body), 'utf-8');
        }
      } else {
        rawBody = await new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          let total = 0;
          req.on('data', (chunk: Buffer) => {
            total += chunk.length;
            if (total > MAX_BODY_BYTES) {
              reject(new Error('حجم الطلب كبير جداً.'));
              return;
            }
            chunks.push(chunk);
          });
          req.on('end', () => resolve(Buffer.concat(chunks)));
          req.on('error', reject);
        });
      }
    }

    let upstreamRes: globalThis.Response | null = null;
    let method = req.method === 'POST' ? 'POST' : req.method === 'HEAD' ? 'HEAD' : 'GET';
    let bodyToSend: BodyInit | undefined =
      rawBody && rawBody.length > 0 && method === 'POST'
        ? new Uint8Array(rawBody).buffer
        : undefined;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const validatedUrl = await validateExternalTargetUrl(currentUrlStr);
      currentUrlStr = validatedUrl.href;

      const forwardHeaders: Record<string, string> = {
        'User-Agent':
          req.get('user-agent') ||
          'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        Accept: req.get('accept') || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': req.get('accept-language') || 'ar,en-US;q=0.9,en;q=0.8',
      };
      if (method === 'POST' && req.headers['content-type']) {
        forwardHeaders['Content-Type'] = String(req.headers['content-type']);
      }
      const cookieHeader = buildCookieHeader(jar, validatedUrl.hostname);
      if (cookieHeader) {
        forwardHeaders.Cookie = cookieHeader;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        upstreamRes = await fetch(validatedUrl.href, {
          method,
          headers: forwardHeaders,
          body: bodyToSend,
          redirect: 'manual',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      storeCookiesFromResponse(jar, validatedUrl.hostname, upstreamRes.headers);

      if (
        upstreamRes.status >= 300 &&
        upstreamRes.status < 400 &&
        upstreamRes.headers.get('location')
      ) {
        const location = upstreamRes.headers.get('location')!;
        const normalizedLocation = normalizeExternalScheme(location);
        if (!normalizedLocation) {
          break;
        }
        currentUrlStr = new URL(normalizedLocation, validatedUrl.href).href;
        if (upstreamRes.status === 301 || upstreamRes.status === 302 || upstreamRes.status === 303) {
          method = 'GET';
          bodyToSend = undefined;
        }
        continue;
      }

      break;
    }

    if (!upstreamRes) {
      res
        .status(502)
        .setHeader('Content-Type', 'text/html; charset=utf-8')
        .send(renderProxyErrorHtml(currentUrlStr, 'لم يرد الخادم البعيد بأي استجابة.'));
      return;
    }

    const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', 'frame-ancestors *');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (contentType.toLowerCase().includes('text/html')) {
      const htmlText = await upstreamRes.text();
      if (Buffer.byteLength(htmlText, 'utf8') > MAX_BODY_BYTES) {
        res
          .status(413)
          .setHeader('Content-Type', 'text/html; charset=utf-8')
          .send(renderProxyErrorHtml(currentUrlStr, 'حجم الصفحة يتجاوز الحد المسموح للعرض الداخلي.'));
        return;
      }
      const rewrittenHtml = rewriteHtmlForWebView(
        htmlText,
        currentUrlStr,
        wvSession,
        initialStorageJson,
      );
      res.status(upstreamRes.status);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(rewrittenHtml);
      return;
    }

    const buf = Buffer.from(await upstreamRes.arrayBuffer());
    if (buf.length > MAX_BODY_BYTES) {
      res.status(413).send('Payload too large');
      return;
    }
    res.status(upstreamRes.status);
    res.setHeader('Content-Type', contentType);
    res.send(buf);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'تعذر الاتصال بالموقع المطلوب.';
    res
      .status(502)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .send(renderProxyErrorHtml(currentUrlStr, msg));
  }
}

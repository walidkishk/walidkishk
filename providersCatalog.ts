import type {
  ProtocolFormatId,
  ProtocolPortSpec,
  ServerSummary,
  VpnProviderSummary,
} from './src/types.ts';

export type ProtocolCreateUrlMap = Record<ProtocolFormatId, string>;

export interface ProviderMetaConfig {
  providerId: string;
  name: string;
  nameAr: string;
  domain: string;
  baseUrl: string;
  resetScheduleAr: string;
  validityDaysLabelAr: string;
  supportedProtocols: ProtocolFormatId[];
  protocolCreateUrls: ProtocolCreateUrlMap;
  descriptionAr: string;
  supportsAutoRenew?: boolean;
  requiresCookies?: boolean;
}

export interface CountryInfo {
  regionLabelAr: string;
  location: string;
  country: string;
  countryAr: string;
}

const ALL_NINE_PROTOCOLS: ProtocolFormatId[] = [
  'ssh_ws',
  'ssh_ssl',
  'ssh_dropbear',
  'slowdns',
  'v2ray_vmess',
  'v2ray_vless',
  'wireguard',
  'noobzvpn',
  'squid',
];

const COUNTRY_BY_PREFIX: Record<string, CountryInfo> = {
  de: { regionLabelAr: 'أوروبا', location: 'Frankfurt', country: 'Germany', countryAr: 'ألمانيا' },
  fr: { regionLabelAr: 'أوروبا', location: 'Paris', country: 'France', countryAr: 'فرنسا' },
  nl: { regionLabelAr: 'أوروبا', location: 'Amsterdam', country: 'Netherlands', countryAr: 'هولندا' },
  fi: { regionLabelAr: 'أوروبا', location: 'Helsinki', country: 'Finland', countryAr: 'فنلندا' },
  se: { regionLabelAr: 'أوروبا', location: 'Stockholm', country: 'Sweden', countryAr: 'السويد' },
  pl: { regionLabelAr: 'أوروبا', location: 'Warsaw', country: 'Poland', countryAr: 'بولندا' },
  lv: { regionLabelAr: 'أوروبا', location: 'Riga', country: 'Latvia', countryAr: 'لاتفيا' },
  uk: { regionLabelAr: 'أوروبا', location: 'London', country: 'United Kingdom', countryAr: 'بريطانيا' },
  lu: { regionLabelAr: 'أوروبا', location: 'Luxembourg', country: 'Luxembourg', countryAr: 'لوكسمبورغ' },
  ee: { regionLabelAr: 'أوروبا', location: 'Tallinn', country: 'Estonia', countryAr: 'إستونيا' },
  us: { regionLabelAr: 'أمريكا', location: 'New York / LA', country: 'United States', countryAr: 'الولايات المتحدة' },
  usa: { regionLabelAr: 'أمريكا', location: 'United States', country: 'United States', countryAr: 'الولايات المتحدة' },
  ca: { regionLabelAr: 'أمريكا', location: 'Toronto', country: 'Canada', countryAr: 'كندا' },
  br: { regionLabelAr: 'أمريكا', location: 'Sao Paulo', country: 'Brazil', countryAr: 'البرازيل' },
  sg: { regionLabelAr: 'آسيا', location: 'Singapore', country: 'Singapore', countryAr: 'سنغافورة' },
  sgp: { regionLabelAr: 'آسيا', location: 'Singapore', country: 'Singapore', countryAr: 'سنغافورة' },
  id: { regionLabelAr: 'آسيا', location: 'Jakarta', country: 'Indonesia', countryAr: 'إندونيسيا' },
  jp: { regionLabelAr: 'آسيا', location: 'Tokyo', country: 'Japan', countryAr: 'اليابان' },
  hk: { regionLabelAr: 'آسيا', location: 'Hong Kong', country: 'Hong Kong', countryAr: 'هونغ كونغ' },
  ae: { regionLabelAr: 'الدول العربية والشرق الأوسط', location: 'Dubai', country: 'UAE', countryAr: 'الإمارات (دبي)' },
  sa: { regionLabelAr: 'الدول العربية والشرق الأوسط', location: 'Riyadh', country: 'Saudi Arabia', countryAr: 'السعودية (الرياض)' },
  sau: { regionLabelAr: 'الدول العربية والشرق الأوسط', location: 'Riyadh', country: 'Saudi Arabia', countryAr: 'السعودية (الرياض)' },
  bh: { regionLabelAr: 'الدول العربية والشرق الأوسط', location: 'Manama', country: 'Bahrain', countryAr: 'البحرين (المنامة)' },
  eg: { regionLabelAr: 'الدول العربية والشرق الأوسط', location: 'Cairo', country: 'Egypt', countryAr: 'مصر (القاهرة)' },
  om: { regionLabelAr: 'الدول العربية والشرق الأوسط', location: 'Muscat', country: 'Oman', countryAr: 'عُمان (مسقط)' },
  qa: { regionLabelAr: 'الدول العربية والشرق الأوسط', location: 'Doha', country: 'Qatar', countryAr: 'قطر (الدوحة)' },
  kw: { regionLabelAr: 'الدول العربية والشرق الأوسط', location: 'Kuwait City', country: 'Kuwait', countryAr: 'الكويت' },
  jo: { regionLabelAr: 'الدول العربية والشرق الأوسط', location: 'Amman', country: 'Jordan', countryAr: 'الأردن (عمّان)' },
  ma: { regionLabelAr: 'الدول العربية والشرق الأوسط', location: 'Casablanca', country: 'Morocco', countryAr: 'المغرب (الدار البيضاء)' },
  iq: { regionLabelAr: 'الدول العربية والشرق الأوسط', location: 'Baghdad', country: 'Iraq', countryAr: 'العراق' },
  tr: { regionLabelAr: 'الشرق الأوسط وأوروبا', location: 'Istanbul', country: 'Turkey', countryAr: 'تركيا (إسطنبول)' },
  gb: { regionLabelAr: 'أوروبا', location: 'London', country: 'United Kingdom', countryAr: 'بريطانيا' },
  in: { regionLabelAr: 'آسيا', location: 'Mumbai', country: 'India', countryAr: 'الهند' },
  au: { regionLabelAr: 'أوقيانوسيا', location: 'Sydney', country: 'Australia', countryAr: 'أستراليا' },
};

export function inferCountryFromCode(hostOrCode: string): CountryInfo {
  const lower = hostOrCode.toLowerCase();
  const normalized = lower.replace(/^(ssh|ovpn|pptp)-/, '');
  const m = normalized.match(/^(usa|sgp|sau|de|fr|nl|fi|se|pl|lv|uk|gb|lu|ee|us|ca|br|sg|id|jp|hk|ae|sa|bh|eg|om|qa|kw|jo|ma|iq|tr|in|au)/);
  if (m && COUNTRY_BY_PREFIX[m[1]]) {
    return COUNTRY_BY_PREFIX[m[1]];
  }
  if (lower.includes('-jp')) return COUNTRY_BY_PREFIX.jp;
  if (lower.includes('uk') || lower.includes('gb')) return COUNTRY_BY_PREFIX.uk;
  if (lower.includes('us')) return COUNTRY_BY_PREFIX.us;
  if (lower.includes('fr')) return COUNTRY_BY_PREFIX.fr;
  if (lower.includes('de')) return COUNTRY_BY_PREFIX.de;
  if (lower.includes('lu')) return COUNTRY_BY_PREFIX.lu;
  if (lower.includes('ca')) return COUNTRY_BY_PREFIX.ca;
  if (lower.includes('id')) return COUNTRY_BY_PREFIX.id;
  if (lower.includes('sg')) return COUNTRY_BY_PREFIX.sg;
  if (lower.includes('saudi') || lower.includes('sau')) return COUNTRY_BY_PREFIX.sa;
  if (lower.includes('emirates') || lower.includes('dubai')) return COUNTRY_BY_PREFIX.ae;
  if (lower.includes('bahrain')) return COUNTRY_BY_PREFIX.bh;
  if (lower.includes('egypt')) return COUNTRY_BY_PREFIX.eg;
  if (lower.includes('oman')) return COUNTRY_BY_PREFIX.om;
  if (lower.includes('qatar')) return COUNTRY_BY_PREFIX.qa;
  if (lower.includes('turkey')) return COUNTRY_BY_PREFIX.tr;
  return {
    regionLabelAr: 'عالمي',
    location: 'Global Edge',
    country: 'Global',
    countryAr: 'سيرفر عالمي',
  };
}

export function makeShortServerId(prefix: string, raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
  return `${prefix}_${cleaned}`.slice(0, 30);
}

export function makeServicesFromProtocols(supported: ProtocolFormatId[], dnsttUp = true): ServerSummary['services'] {
  return {
    dnstt: dnsttUp && supported.includes('slowdns') ? 'UP' : 'DOWN',
    v2ray: supported.includes('v2ray_vmess') || supported.includes('v2ray_vless') ? 'UP' : 'DOWN',
    wireguard: supported.includes('wireguard') ? 'UP' : 'DOWN',
    noobzvpn: supported.includes('noobzvpn') ? 'UP' : 'DOWN',
    squid: supported.includes('squid') ? 'UP' : 'DOWN',
  };
}

export const PROVIDERS_CATALOG: ProviderMetaConfig[] = [
  {
    providerId: 'sshtunnel',
    name: 'ssh-tunnel.net',
    nameAr: 'موقع SSH Tunnel Net',
    domain: 'ssh-tunnel.net',
    baseUrl: 'https://www.ssh-tunnel.net',
    resetScheduleAr: '06:00 PM و 06:00 AM (GMT+7)',
    validityDaysLabelAr: '3 أيام',
    supportedProtocols: ALL_NINE_PROTOCOLS,
    protocolCreateUrls: {
      ssh_ws: 'https://www.ssh-tunnel.net/europe-africa/server-15/',
      ssh_ssl: 'https://www.ssh-tunnel.net/europe-africa/server-15/',
      ssh_dropbear: 'https://www.ssh-tunnel.net/europe-africa/server-15/',
      slowdns: 'https://www.ssh-tunnel.net/europe-africa/server-15/',
      v2ray_vmess: 'https://www.ssh-tunnel.net/europe-africa/server-15/',
      v2ray_vless: 'https://www.ssh-tunnel.net/europe-africa/server-15/',
      wireguard: 'https://www.ssh-tunnel.net/europe-africa/server-15/',
      noobzvpn: 'https://www.ssh-tunnel.net/europe-africa/server-15/',
      squid: 'https://www.ssh-tunnel.net/europe-africa/server-15/',
    },
    descriptionAr: 'المزود الرئيسي المتكامل — ينشئ ويجدد جميع البروتوكولات التسعة عبر صفحة السيرفر (يتطلب جلسة Cookie و reCAPTCHA للتنفيذ التلقائي).',
    supportsAutoRenew: true,
    requiresCookies: true,
  },
  {
    providerId: 'sshocean',
    name: 'sshocean.com',
    nameAr: 'موقع SSHOcean',
    domain: 'sshocean.com',
    baseUrl: 'https://sshocean.com',
    resetScheduleAr: '00:00 & 12:00 (GMT+7) يومياً',
    validityDaysLabelAr: '7 أيام',
    supportedProtocols: ALL_NINE_PROTOCOLS,
    protocolCreateUrls: {
      ssh_ws: 'https://sshocean.com/sshws',
      ssh_ssl: 'https://sshocean.com/ssh-stunnel',
      ssh_dropbear: 'https://sshocean.com/ssh-dropbear',
      slowdns: 'https://sshocean.com/ssh-dnstt',
      v2ray_vmess: 'https://sshocean.com/vmess',
      v2ray_vless: 'https://sshocean.com/vless',
      wireguard: 'https://sshocean.com/wireguard',
      noobzvpn: 'https://sshocean.com/noobzvpn',
      squid: 'https://sshocean.com/squid-proxy',
    },
    descriptionAr: 'مزود متعدد المناطق بصفحة حالة حية — صفحات مستقلة لكل بروتوكول (WS و Stunnel و DNSTT و V2Ray و WireGuard و NoobzVpn).',
  },
  {
    providerId: 'tcpvpn',
    name: 'tcpvpn.com',
    nameAr: 'موقع TCPVPN',
    domain: 'tcpvpn.com',
    baseUrl: 'https://www.tcpvpn.com',
    resetScheduleAr: '00:01 (GMT+7) يومياً',
    validityDaysLabelAr: '5 إلى 7 أيام',
    supportedProtocols: ALL_NINE_PROTOCOLS,
    protocolCreateUrls: {
      ssh_ws: 'https://tcpvpn.com/websocket-server',
      ssh_ssl: 'https://www.tcpvpn.com/ssh-ssl-server',
      ssh_dropbear: 'https://www.tcpvpn.com/vpn-server',
      slowdns: 'https://www.tcpvpn.com/slowdns-server',
      v2ray_vmess: 'https://www.tcpvpn.com/v2ray-vmess-server',
      v2ray_vless: 'https://www.tcpvpn.com/v2ray-vless-server',
      wireguard: 'https://www.tcpvpn.com/wireguard',
      noobzvpn: 'https://www.tcpvpn.com/vpn-server',
      squid: 'https://www.tcpvpn.com/squid-proxy',
    },
    descriptionAr: 'أحد أشهر مواقع SSH و WebSocket المجانية بخوادم أوروبية وأمريكية وآسيوية وصفحات مخصصة لكل صيغة.',
  },
  {
    providerId: 'akunssh',
    name: 'akunssh.net',
    nameAr: 'موقع AkunSSH',
    domain: 'akunssh.net',
    baseUrl: 'https://akunssh.net',
    resetScheduleAr: 'تصفير متجدد كل 3 ساعات / يومي (GMT+7)',
    validityDaysLabelAr: '3 إلى 7 أيام',
    supportedProtocols: ALL_NINE_PROTOCOLS,
    protocolCreateUrls: {
      ssh_ws: 'https://akunssh.net/ssh-websocket-server',
      ssh_ssl: 'https://akunssh.net/ssh-server',
      ssh_dropbear: 'https://akunssh.net/ssh-server',
      slowdns: 'https://akunssh.net/slowdns-server',
      v2ray_vmess: 'https://akunssh.net/v2ray-vmess-server',
      v2ray_vless: 'https://akunssh.net/v2ray-vless-server',
      wireguard: 'https://akunssh.net/wireguard-vpn-server',
      noobzvpn: 'https://akunssh.net/noobzvpn-server',
      squid: 'https://akunssh.net/squid-proxy',
    },
    descriptionAr: 'خوادم سريعة لـ SSH WebSocket و SlowDNS و V2Ray VMess/VLESS و WireGuard و NoobzVpn.',
  },
  {
    providerId: 'opentunnel',
    name: 'opentunnel.net',
    nameAr: 'موقع OpenTunnel',
    domain: 'opentunnel.net',
    baseUrl: 'https://www.opentunnel.net',
    resetScheduleAr: '08:00:01 PM (GMT+7) يومياً',
    validityDaysLabelAr: '7 أيام',
    supportedProtocols: ALL_NINE_PROTOCOLS,
    protocolCreateUrls: {
      ssh_ws: 'https://www.opentunnel.net/ssh/',
      ssh_ssl: 'https://www.opentunnel.net/ssh/',
      ssh_dropbear: 'https://www.opentunnel.net/ssh/',
      slowdns: 'https://www.opentunnel.net/ssh/',
      v2ray_vmess: 'https://www.opentunnel.net/v2ray/',
      v2ray_vless: 'https://www.opentunnel.net/xray/',
      wireguard: 'https://www.opentunnel.net/wireguard/',
      noobzvpn: 'https://www.opentunnel.net/ssh/',
      squid: 'https://www.opentunnel.net/squid-proxy/',
    },
    descriptionAr: 'خوادم optnl.com عالية الاستقرار لـ SSH WebSocket و V2Ray و Xray و WireGuard و Squid Proxy.',
  },
  {
    providerId: 'greenssh',
    name: 'greenssh.com',
    nameAr: 'موقع GreenSSH',
    domain: 'greenssh.com',
    baseUrl: 'https://greenssh.com',
    resetScheduleAr: '00:00 & 12:00 (GMT+7) يومياً',
    validityDaysLabelAr: '7 أيام',
    supportedProtocols: ALL_NINE_PROTOCOLS,
    protocolCreateUrls: {
      ssh_ws: 'https://greenssh.com/ssh-websocket',
      ssh_ssl: 'https://greenssh.com/ssh-stunnel',
      ssh_dropbear: 'https://greenssh.com/ssh-dropbear',
      slowdns: 'https://greenssh.com/ssh-slowdns',
      v2ray_vmess: 'https://greenssh.com/v2ray-vmess',
      v2ray_vless: 'https://greenssh.com/v2ray-vless',
      wireguard: 'https://greenssh.com/wireguard',
      noobzvpn: 'https://greenssh.com/noobzvpn',
      squid: 'https://greenssh.com/ssh-stunnel',
    },
    descriptionAr: 'خوادم CDN Cloudflare و SSH WebSocket و Stunnel و SlowDNS و V2Ray و WireGuard و NoobzVpn.',
  },
  {
    providerId: 'vpnhack',
    name: 'vpnhack.com',
    nameAr: 'موقع VPNHack',
    domain: 'vpnhack.com',
    baseUrl: 'https://vpnhack.com',
    resetScheduleAr: 'تصفير تلقائي يومي (GMT+7)',
    validityDaysLabelAr: '7 أيام',
    supportedProtocols: ALL_NINE_PROTOCOLS,
    protocolCreateUrls: {
      ssh_ws: 'https://vpnhack.com/ssh-websocket',
      ssh_ssl: 'https://vpnhack.com/ssh-stunnel',
      ssh_dropbear: 'https://vpnhack.com/ssh-dropbear',
      slowdns: 'https://vpnhack.com/ssh-slowdns',
      v2ray_vmess: 'https://vpnhack.com/v2ray-vmess',
      v2ray_vless: 'https://vpnhack.com/v2ray-vless',
      wireguard: 'https://vpnhack.com/wireguard',
      noobzvpn: 'https://vpnhack.com/noobzvpn',
      squid: 'https://vpnhack.com/squid-proxy',
    },
    descriptionAr: 'يدعم جميع البروتوكولات التسعة مع روابط إنشاء مباشرة لكل صيغة داخل الموقع.',
  },
  {
    providerId: 'sshstores',
    name: 'sshstores.net',
    nameAr: 'موقع SSHStores',
    domain: 'sshstores.net',
    baseUrl: 'https://sshstores.net',
    resetScheduleAr: 'تصفير دوري مستمر (GMT+7)',
    validityDaysLabelAr: '3 إلى 7 أيام',
    supportedProtocols: ALL_NINE_PROTOCOLS,
    protocolCreateUrls: {
      ssh_ws: 'https://sshstores.net/ssh-websocket',
      ssh_ssl: 'https://sshstores.net/ssh-ssl',
      ssh_dropbear: 'https://sshstores.net/ssh-direct',
      slowdns: 'https://sshstores.net/ssh-direct',
      v2ray_vmess: 'https://sshstores.net/vmess',
      v2ray_vless: 'https://sshstores.net/vless',
      wireguard: 'https://sshstores.net/wireguard',
      noobzvpn: 'https://sshstores.net/noobzvpn',
      squid: 'https://sshstores.net/ssh-ssl',
    },
    descriptionAr: 'خوادم متعددة في سنغافورة وأمريكا وهونغ كونغ لـ SSH WS و SSL و VMess و VLESS و WireGuard و NoobzVpn.',
  },
  {
    providerId: 'vpnstunnel',
    name: 'vpnstunnel.com',
    nameAr: 'موقع VPNsTunnel',
    domain: 'vpnstunnel.com',
    baseUrl: 'https://vpnstunnel.com',
    resetScheduleAr: '00:00 (GMT+7) يومياً',
    validityDaysLabelAr: '7 أيام',
    supportedProtocols: ['ssh_ws', 'ssh_ssl', 'ssh_dropbear', 'v2ray_vmess', 'v2ray_vless', 'squid'],
    protocolCreateUrls: {
      ssh_ws: 'https://vpnstunnel.com/ssh',
      ssh_ssl: 'https://vpnstunnel.com/ssh',
      ssh_dropbear: 'https://vpnstunnel.com/ssh',
      slowdns: 'https://vpnstunnel.com/ssh',
      v2ray_vmess: 'https://vpnstunnel.com/v2ray-vmess-ws',
      v2ray_vless: 'https://vpnstunnel.com/v2ray-vless-ws',
      wireguard: 'https://vpnstunnel.com/ssh',
      noobzvpn: 'https://vpnstunnel.com/ssh',
      squid: 'https://vpnstunnel.com/ssh',
    },
    descriptionAr: 'مراقبة مباشرة لحالة السيرفرات عبر /server-status مع إنشاء SSH و V2Ray/Xray WS و gRPC.',
  },
  {
    providerId: 'jagoanssh',
    name: 'jagoanssh.com',
    nameAr: 'موقع JagoanSSH',
    domain: 'jagoanssh.com',
    baseUrl: 'https://www.jagoanssh.com',
    resetScheduleAr: '10:00 AM & 10:00 PM (GMT+7)',
    validityDaysLabelAr: '3 / 7 / 30 يوماً',
    supportedProtocols: ALL_NINE_PROTOCOLS,
    protocolCreateUrls: {
      ssh_ws: 'https://www.jagoanssh.com/?do=ssh-servers',
      ssh_ssl: 'https://www.jagoanssh.com/?do=ssh-servers',
      ssh_dropbear: 'https://www.jagoanssh.com/?do=ssh-servers',
      slowdns: 'https://www.jagoanssh.com/?do=dns',
      v2ray_vmess: 'https://www.jagoanssh.com/?do=v2ray',
      v2ray_vless: 'https://www.jagoanssh.com/?do=xray',
      wireguard: 'https://www.jagoanssh.com/?do=wireguard',
      noobzvpn: 'https://www.jagoanssh.com/?do=noobzvpn',
      squid: 'https://www.jagoanssh.com/?do=squid',
    },
    descriptionAr: 'بوابة حسابات SSH و V2Ray و Xray و NoobzVpn و WireGuard و Squid بمدد 3 و 7 و 30 يوماً.',
  },
  {
    providerId: 'freevpnus',
    name: 'freevpn.us',
    nameAr: 'موقع FreeVPN.us',
    domain: 'freevpn.us',
    baseUrl: 'https://www.freevpn.us',
    resetScheduleAr: '06:00 PM و 06:00 AM (GMT+7)',
    validityDaysLabelAr: '3 إلى 7 أيام',
    supportedProtocols: ['ssh_ws', 'ssh_ssl', 'ssh_dropbear', 'slowdns', 'v2ray_vmess', 'v2ray_vless', 'wireguard', 'squid'],
    protocolCreateUrls: {
      ssh_ws: 'https://www.freevpn.us/ssh-custom/',
      ssh_ssl: 'https://www.freevpn.us/ssh-tunnel/',
      ssh_dropbear: 'https://www.freevpn.us/ssh-tunnel/',
      slowdns: 'https://www.freevpn.us/ssh-tunnel/',
      v2ray_vmess: 'https://www.freevpn.us/v2ray/',
      v2ray_vless: 'https://www.freevpn.us/v2ray-vless/',
      wireguard: 'https://www.freevpn.us/wireguard/',
      noobzvpn: 'https://www.freevpn.us/ssh-custom/',
      squid: 'https://www.freevpn.us/ssh-tunnel/',
    },
    descriptionAr: 'خوادم vpnv.cc الحية بمتابعة فورية من /pages/server-status.html (SSH و V2Ray و VLESS و WireGuard).',
  },
  {
    providerId: 'vpnjantit',
    name: 'vpnjantit.com',
    nameAr: 'موقع VPNJantit',
    domain: 'vpnjantit.com',
    baseUrl: 'https://www.vpnjantit.com',
    resetScheduleAr: 'تصفير متجدد كل ساعة (62 دولة)',
    validityDaysLabelAr: '4 إلى 7 أيام',
    supportedProtocols: ['ssh_ws', 'ssh_ssl', 'ssh_dropbear', 'slowdns', 'v2ray_vmess', 'v2ray_vless', 'wireguard', 'squid'],
    protocolCreateUrls: {
      ssh_ws: 'https://www.vpnjantit.com/free-ssh',
      ssh_ssl: 'https://www.vpnjantit.com/free-ssh',
      ssh_dropbear: 'https://www.vpnjantit.com/free-ssh',
      slowdns: 'https://www.vpnjantit.com/free-ssh',
      v2ray_vmess: 'https://www.vpnjantit.com/free-v2ray-vmess',
      v2ray_vless: 'https://www.vpnjantit.com/free-v2ray-vless',
      wireguard: 'https://www.vpnjantit.com/free-wireguard',
      noobzvpn: 'https://www.vpnjantit.com/free-ssh',
      squid: 'https://www.vpnjantit.com/free-ssh',
    },
    descriptionAr: 'أكثر من 60 دولة مجانية لـ SSH و V2Ray VMess/VLESS و WireGuard مع تحديث مستمر للرصيد.',
  },
  {
    providerId: 'hidessh',
    name: 'hidessh.com',
    nameAr: 'موقع HideSSH',
    domain: 'hidessh.com',
    baseUrl: 'https://hidessh.com',
    resetScheduleAr: '00:00 (GMT+7) يومياً',
    validityDaysLabelAr: '7 أيام',
    supportedProtocols: ['ssh_ws', 'ssh_ssl', 'ssh_dropbear', 'slowdns', 'v2ray_vmess', 'v2ray_vless', 'wireguard', 'squid'],
    protocolCreateUrls: {
      ssh_ws: 'https://hidessh.com/ssh-cloudfront',
      ssh_ssl: 'https://hidessh.com/ssh',
      ssh_dropbear: 'https://hidessh.com/ssh',
      slowdns: 'https://hidessh.com/slowdns',
      v2ray_vmess: 'https://hidessh.com/v2ray',
      v2ray_vless: 'https://hidessh.com/v2ray',
      wireguard: 'https://hidessh.com/wireguard',
      noobzvpn: 'https://hidessh.com/ssh',
      squid: 'https://hidessh.com/ssh',
    },
    descriptionAr: 'مزود SSH CloudFront و SlowDNS و V2Ray و WireGuard بصفحات مباشرة لكل بروتوكول.',
  },
  {
    providerId: 'jagovpn',
    name: 'jagovpn.com',
    nameAr: 'موقع JagoVPN',
    domain: 'jagovpn.com',
    baseUrl: 'https://jagovpn.com',
    resetScheduleAr: '10:00 AM & 10:00 PM (GMT+7)',
    validityDaysLabelAr: '7 أيام',
    supportedProtocols: ['ssh_ws', 'ssh_ssl', 'ssh_dropbear', 'slowdns', 'v2ray_vmess', 'v2ray_vless', 'wireguard', 'squid'],
    protocolCreateUrls: {
      ssh_ws: 'https://jagovpn.com/ssh-tunnel',
      ssh_ssl: 'https://jagovpn.com/ssh-tunnel',
      ssh_dropbear: 'https://jagovpn.com/ssh-tunnel',
      slowdns: 'https://jagovpn.com/ssh-tunnel',
      v2ray_vmess: 'https://jagovpn.com/v2ray-vmess',
      v2ray_vless: 'https://jagovpn.com/xray-vless',
      wireguard: 'https://jagovpn.com/wireguard',
      noobzvpn: 'https://jagovpn.com/ssh-tunnel',
      squid: 'https://jagovpn.com/ssh-tunnel',
    },
    descriptionAr: 'بوابة حسابات SSH Tunnel و VMess و Xray VLESS و WireGuard مع مراقبة حالة السيرفرات.',
  },
  {
    providerId: 'serverssh',
    name: 'serverssh.net',
    nameAr: 'موقع ServerSSH',
    domain: 'serverssh.net',
    baseUrl: 'https://serverssh.net',
    resetScheduleAr: '10:00 AM & 10:00 PM (GMT+7)',
    validityDaysLabelAr: '3 / 7 / 30 يوماً',
    supportedProtocols: ['ssh_ws', 'ssh_ssl', 'ssh_dropbear', 'slowdns', 'v2ray_vmess', 'v2ray_vless', 'wireguard', 'squid'],
    protocolCreateUrls: {
      ssh_ws: 'https://serverssh.net/?q=ssh-servers',
      ssh_ssl: 'https://serverssh.net/?q=ssh-servers',
      ssh_dropbear: 'https://serverssh.net/?q=ssh-servers',
      slowdns: 'https://serverssh.net/?q=ssh-servers',
      v2ray_vmess: 'https://serverssh.net/?q=v2ray',
      v2ray_vless: 'https://serverssh.net/?q=v2ray',
      wireguard: 'https://serverssh.net/?q=vpn-servers',
      noobzvpn: 'https://serverssh.net/?q=ssh-servers',
      squid: 'https://serverssh.net/?q=ssh-servers',
    },
    descriptionAr: 'موقع ServerSSH لحسابات SSH و V2Ray و VPN بمدد متعددة ومراقبة فورية.',
  },
  {
    providerId: 'fastssh',
    name: 'fastssh.com',
    nameAr: 'موقع FastSSH',
    domain: 'fastssh.com',
    baseUrl: 'https://www.fastssh.com',
    resetScheduleAr: 'تصفير متجدد يومياً (GMT+7)',
    validityDaysLabelAr: '3 إلى 7 أيام',
    supportedProtocols: ['ssh_ws', 'ssh_ssl', 'ssh_dropbear', 'slowdns', 'v2ray_vmess', 'v2ray_vless', 'squid'],
    protocolCreateUrls: {
      ssh_ws: 'https://www.fastssh.com/home',
      ssh_ssl: 'https://www.fastssh.com/page/ssh-ssl-stunnel-servers/',
      ssh_dropbear: 'https://www.fastssh.com/page/ssh-ssl-stunnel-servers/',
      slowdns: 'https://www.fastssh.com/home',
      v2ray_vmess: 'https://www.fastssh.com/home',
      v2ray_vless: 'https://www.fastssh.com/home',
      wireguard: 'https://www.fastssh.com/home',
      noobzvpn: 'https://www.fastssh.com/home',
      squid: 'https://www.fastssh.com/home',
    },
    descriptionAr: 'بوابة FastSSH العريقة لإنشاء حسابات SSH WebSocket و Stunnel SSL عبر panel.fastssh.com.',
  },
  {
    providerId: 'howdy',
    name: 'howdy.id',
    nameAr: 'موقع Howdy.id',
    domain: 'howdy.id',
    baseUrl: 'https://howdy.id',
    resetScheduleAr: '00:00 (GMT+7) يومياً',
    validityDaysLabelAr: '7 أيام',
    supportedProtocols: ['ssh_ws', 'ssh_ssl', 'v2ray_vmess', 'v2ray_vless', 'squid'],
    protocolCreateUrls: {
      ssh_ws: 'https://howdy.id/',
      ssh_ssl: 'https://howdy.id/',
      ssh_dropbear: 'https://howdy.id/',
      slowdns: 'https://howdy.id/',
      v2ray_vmess: 'https://howdy.id/xray-vmess-vless-trojan/',
      v2ray_vless: 'https://howdy.id/xray-vmess-vless-trojan/',
      wireguard: 'https://howdy.id/',
      noobzvpn: 'https://howdy.id/',
      squid: 'https://howdy.id/proxy-server/',
    },
    descriptionAr: 'مزود Xray VMess/VLESS/Trojan و Squid Proxy المجاني بروابط مباشرة داخل الموقع.',
  },
  {
    providerId: 'racevpn',
    name: 'racevpn.com',
    nameAr: 'موقع RaceVPN',
    domain: 'racevpn.com',
    baseUrl: 'https://www.racevpn.com',
    resetScheduleAr: '00:00 (GMT+7) يومياً',
    validityDaysLabelAr: '7 أيام',
    supportedProtocols: ['ssh_ws', 'ssh_ssl', 'ssh_dropbear', 'v2ray_vmess', 'v2ray_vless', 'wireguard', 'squid'],
    protocolCreateUrls: {
      ssh_ws: 'https://www.racevpn.com/free-openssh-server',
      ssh_ssl: 'https://www.racevpn.com/free-openssh-server',
      ssh_dropbear: 'https://www.racevpn.com/free-openssh-server',
      slowdns: 'https://www.racevpn.com/free-openssh-server',
      v2ray_vmess: 'https://www.racevpn.com/free-vmesswebsockettls-server',
      v2ray_vless: 'https://www.racevpn.com/free-vlesswebsocket-server',
      wireguard: 'https://www.racevpn.com/free-wireguard-server',
      noobzvpn: 'https://www.racevpn.com/free-openssh-server',
      squid: 'https://www.racevpn.com/free-openssh-server',
    },
    descriptionAr: 'خوادم connall.org المجانية لـ OpenSSH و VMess WS/TLS و VLESS و WireGuard في أوروبا وآسيا وأمريكا.',
  },
  {
    providerId: 'cyberssh',
    name: 'cyberssh.com',
    nameAr: 'موقع CyberSSH',
    domain: 'cyberssh.com',
    baseUrl: 'https://cyberssh.com',
    resetScheduleAr: 'تصفير يومي متجدد (GMT+7)',
    validityDaysLabelAr: '3 / 7 / 30 يوماً',
    supportedProtocols: ['ssh_ws', 'ssh_ssl', 'ssh_dropbear', 'squid'],
    protocolCreateUrls: {
      ssh_ws: 'https://cyberssh.com/ssh/index',
      ssh_ssl: 'https://cyberssh.com/ssh/sshssl',
      ssh_dropbear: 'https://cyberssh.com/ssh/extra',
      slowdns: 'https://cyberssh.com/ssh/index',
      v2ray_vmess: 'https://cyberssh.com/ssh/monthly',
      v2ray_vless: 'https://cyberssh.com/ssh/monthly',
      wireguard: 'https://cyberssh.com/vpn/index',
      noobzvpn: 'https://cyberssh.com/ssh/index',
      squid: 'https://cyberssh.com/squid',
    },
    descriptionAr: 'بوابة CyberSSH مع صفحة فحص حية لحالة السيرفرات (/ssh/status) وخوادم SSH و SSL و Squid و VPN.',
  },
  {
    providerId: 'v2nodes',
    name: 'v2nodes.com',
    nameAr: 'موقع V2Nodes (عقد عربية وعالمية)',
    domain: 'v2nodes.com',
    baseUrl: 'https://www.v2nodes.com',
    resetScheduleAr: 'تحديث تلقائي مستمر وجلب فوري من التطبيق',
    validityDaysLabelAr: 'عقد حية مستمرة (إنشاء فوري)',
    supportedProtocols: ['v2ray_vmess', 'v2ray_vless'],
    protocolCreateUrls: {
      ssh_ws: 'https://www.v2nodes.com/',
      ssh_ssl: 'https://www.v2nodes.com/',
      ssh_dropbear: 'https://www.v2nodes.com/',
      slowdns: 'https://www.v2nodes.com/',
      v2ray_vmess: 'https://www.v2nodes.com/country/ae/',
      v2ray_vless: 'https://www.v2nodes.com/country/sa/',
      wireguard: 'https://www.v2nodes.com/',
      noobzvpn: 'https://www.v2nodes.com/',
      squid: 'https://www.v2nodes.com/',
    },
    descriptionAr: 'دليل V2Ray/VLESS/VMess مجاني بلا كابتشا يضم عقداً عربية حية ويدعم الإنشاء والتجديد الفوري بضغطة زر من داخل التطبيق.',
    supportsAutoRenew: true,
  },
  {
    providerId: 'openproxylist',
    name: 'openproxylist.com',
    nameAr: 'موقع OpenProxyList V2Ray',
    domain: 'openproxylist.com',
    baseUrl: 'https://openproxylist.com/v2ray/',
    resetScheduleAr: 'فحص كل دقيقة وتجديد فوري من التطبيق',
    validityDaysLabelAr: 'تحديث لحظي مجاني (إنشاء فوري)',
    supportedProtocols: ['v2ray_vmess', 'v2ray_vless'],
    protocolCreateUrls: {
      ssh_ws: 'https://openproxylist.com/v2ray/',
      ssh_ssl: 'https://openproxylist.com/v2ray/',
      ssh_dropbear: 'https://openproxylist.com/v2ray/',
      slowdns: 'https://openproxylist.com/v2ray/',
      v2ray_vmess: 'https://openproxylist.com/v2ray/',
      v2ray_vless: 'https://openproxylist.com/v2ray/',
      wireguard: 'https://openproxylist.com/openvpn/',
      noobzvpn: 'https://openproxylist.com/v2ray/',
      squid: 'https://openproxylist.com/proxy/',
    },
    descriptionAr: 'قائمة V2Ray حية بلا كابتشا مفحوصة كل دقيقة تشمل عقد السعودية والإمارات وتركيا وأوروبا مع إنشاء وتجديد فوري بضغطة زر.',
    supportsAutoRenew: true,
  },
  {
    providerId: 'freevmess',
    name: 'freevmess.com',
    nameAr: 'موقع FreeVMess',
    domain: 'freevmess.com',
    baseUrl: 'https://www.freevmess.com',
    resetScheduleAr: '00:00 (GMT+7) يومياً',
    validityDaysLabelAr: '3 أيام',
    supportedProtocols: ['v2ray_vmess', 'v2ray_vless', 'wireguard'],
    protocolCreateUrls: {
      ssh_ws: 'https://www.freevmess.com/server-v2ray',
      ssh_ssl: 'https://www.freevmess.com/server-vlesstcptls',
      ssh_dropbear: 'https://www.freevmess.com/server-vlesstcp',
      slowdns: 'https://www.freevmess.com/server-v2ray',
      v2ray_vmess: 'https://www.freevmess.com/server-vmesswebsockets',
      v2ray_vless: 'https://www.freevmess.com/server-vlesswebsockets',
      wireguard: 'https://www.freevmess.com/server-wireguard',
      noobzvpn: 'https://www.freevmess.com/server-v2ray',
      squid: 'https://www.freevmess.com/server-v2rayHTTP',
    },
    descriptionAr: 'خوادم V2Ray VMess و VLESS WebSocket/TLS و Trojan و WireGuard مجانية بتفعيل فوري لمدة 3 أيام.',
  },
  {
    providerId: 'vpngate',
    name: 'vpngate.net',
    nameAr: 'شبكة VPN Gate (جامعة تسوكوبا)',
    domain: 'vpngate.net',
    baseUrl: 'https://www.vpngate.net/en/',
    resetScheduleAr: 'تحديث مباشر عبر API وجلب فوري من التطبيق',
    validityDaysLabelAr: 'متاح مجاناً بلا تسجيل',
    supportedProtocols: ['ssh_ssl'],
    protocolCreateUrls: {
      ssh_ws: 'https://www.vpngate.net/en/',
      ssh_ssl: 'https://www.vpngate.net/en/',
      ssh_dropbear: 'https://www.vpngate.net/en/',
      slowdns: 'https://www.vpngate.net/en/',
      v2ray_vmess: 'https://www.vpngate.net/en/',
      v2ray_vless: 'https://www.vpngate.net/en/',
      wireguard: 'https://www.vpngate.net/en/',
      noobzvpn: 'https://www.vpngate.net/en/',
      squid: 'https://www.vpngate.net/en/',
    },
    descriptionAr: 'شبكة VPN الأكاديمية المجانية من جامعة تسوكوبا اليابانية مع API عام مباشر بدون كابتشا.',
    supportsAutoRenew: true,
  },
  {
    providerId: 'vpnbook',
    name: 'vpnbook.com',
    nameAr: 'موقع VPNBook (خوادم مجانية مباشرة)',
    domain: 'vpnbook.com',
    baseUrl: 'https://www.vpnbook.com/freevpn',
    resetScheduleAr: 'تحديث دوري للبيانات مع جلب لحظي من التطبيق',
    validityDaysLabelAr: 'بيانات دخول متجددة من المصدر',
    supportedProtocols: ['ssh_ssl'],
    protocolCreateUrls: {
      ssh_ws: 'https://www.vpnbook.com/freevpn',
      ssh_ssl: 'https://www.vpnbook.com/freevpn/openvpn',
      ssh_dropbear: 'https://www.vpnbook.com/freevpn',
      slowdns: 'https://www.vpnbook.com/freevpn',
      v2ray_vmess: 'https://www.vpnbook.com/freevpn',
      v2ray_vless: 'https://www.vpnbook.com/freevpn',
      wireguard: 'https://www.vpnbook.com/freevpn',
      noobzvpn: 'https://www.vpnbook.com/freevpn',
      squid: 'https://www.vpnbook.com/freevpn',
    },
    descriptionAr: 'مزود VPN مجاني موثوق يوفر خوادم أوروبية وأمريكية وكلمات مرور عامة متجددة تُجلب من الموقع الرسمي بدون كابتشا.',
    supportsAutoRenew: true,
  },
  {
    providerId: 'greensshnet',
    name: 'greenssh.net',
    nameAr: 'موقع GreenSSH.net',
    domain: 'greenssh.net',
    baseUrl: 'https://greenssh.net',
    resetScheduleAr: 'تصفير تلقائي يومي (GMT+7)',
    validityDaysLabelAr: '3 / 7 / 30 يوماً',
    supportedProtocols: ['ssh_ws', 'ssh_ssl', 'ssh_dropbear', 'slowdns', 'v2ray_vmess', 'v2ray_vless', 'wireguard'],
    protocolCreateUrls: {
      ssh_ws: 'https://greenssh.net/ssh-websocket/',
      ssh_ssl: 'https://greenssh.net/ssh-server-7days/',
      ssh_dropbear: 'https://greenssh.net/ssh-server-30days/',
      slowdns: 'https://greenssh.net/ssh-slowdns/',
      v2ray_vmess: 'https://greenssh.net/vmess-websocket/',
      v2ray_vless: 'https://greenssh.net/vless-websocket/',
      wireguard: 'https://greenssh.net/wireguard/',
      noobzvpn: 'https://greenssh.net/ssh-websocket/',
      squid: 'https://greenssh.net/check-server-status/',
    },
    descriptionAr: 'منصة GreenSSH.net المستقلة لحسابات SSH WebSocket و CloudFront و SlowDNS و VMess/VLESS لـ 3 و 7 و 30 يوماً.',
  },
  {
    providerId: 'openvpnssh',
    name: 'openvpn-ssh.com',
    nameAr: 'موقع OpenVPN-SSH',
    domain: 'openvpn-ssh.com',
    baseUrl: 'https://openvpn-ssh.com',
    resetScheduleAr: 'تصفير يومي متجدد (GMT+7)',
    validityDaysLabelAr: '7 أيام',
    supportedProtocols: ['ssh_ws', 'ssh_ssl', 'ssh_dropbear', 'slowdns', 'v2ray_vmess', 'v2ray_vless'],
    protocolCreateUrls: {
      ssh_ws: 'https://openvpn-ssh.com/?cmd=server',
      ssh_ssl: 'https://openvpn-ssh.com/?cmd=server',
      ssh_dropbear: 'https://openvpn-ssh.com/?cmd=user&vpnTunnelType=sshvpn',
      slowdns: 'https://openvpn-ssh.com/?cmd=server',
      v2ray_vmess: 'https://openvpn-ssh.com/?cmd=server',
      v2ray_vless: 'https://openvpn-ssh.com/?cmd=server',
      wireguard: 'https://openvpn-ssh.com/?cmd=server',
      noobzvpn: 'https://openvpn-ssh.com/?cmd=server',
      squid: 'https://openvpn-ssh.com/?cmd=server',
    },
    descriptionAr: 'موقع OpenVPN-SSH لحسابات SSH SSL/TLS و WebSocket و SlowDNS و V2Ray و Trojan مجاناً.',
  },
];

function buildServerProtocolUrls(
  provider: ProviderMetaConfig,
  pageUrl: string,
  countrySlugCandidate?: string,
): ProtocolCreateUrlMap {
  if (provider.providerId === 'sshtunnel') {
    return {
      ssh_ws: pageUrl,
      ssh_ssl: pageUrl,
      ssh_dropbear: pageUrl,
      slowdns: pageUrl,
      v2ray_vmess: pageUrl,
      v2ray_vless: pageUrl,
      wireguard: pageUrl,
      noobzvpn: pageUrl,
      squid: pageUrl,
    };
  }

  const base = { ...provider.protocolCreateUrls };
  const slug = countrySlugCandidate?.toLowerCase();
  const validCountrySlugs = new Set([
    'germany',
    'france',
    'netherlands',
    'singapore',
    'japan',
    'united-states',
    'saudi-arabia',
    'united-arab-emirates',
    'uae',
    'bahrain',
    'turkey',
    'egypt',
    'oman',
    'qatar',
    'united-kingdom',
  ]);

  if (slug && validCountrySlugs.has(slug)) {
    if (provider.providerId === 'sshocean') {
      base.ssh_ws = `https://sshocean.com/sshws/${slug === 'united-states' ? 'usa' : slug}`;
      if (slug === 'germany' || slug === 'france' || slug === 'netherlands' || slug === 'singapore') {
        base.ssh_ssl = `https://sshocean.com/ssh-stunnel/${slug}`;
        base.v2ray_vmess = `https://sshocean.com/vmess/${slug}`;
        base.v2ray_vless = `https://sshocean.com/vless/${slug}`;
      }
    } else if (provider.providerId === 'greenssh') {
      base.ssh_ws = `https://greenssh.com/ssh-websocket/${slug}`;
    } else if (provider.providerId === 'vpnhack' && (slug === 'france' || slug === 'singapore' || slug === 'germany' || slug === 'united-states')) {
      base.ssh_ws = `https://vpnhack.com/ssh-websocket/${slug}`;
    } else if (provider.providerId === 'sshstores' && (slug === 'singapore' || slug === 'germany' || slug === 'united-states')) {
      base.ssh_ws = `https://sshstores.net/ssh-websocket/${slug}`;
    } else if (provider.providerId === 'vpnjantit') {
      const jantitSlug = slug === 'uae' ? 'united-arab-emirates' : slug;
      base.ssh_ws = `https://www.vpnjantit.com/free-ssh-${jantitSlug}`;
      base.ssh_ssl = `https://www.vpnjantit.com/free-ssh-${jantitSlug}`;
      base.ssh_dropbear = `https://www.vpnjantit.com/free-ssh-${jantitSlug}`;
      base.slowdns = `https://www.vpnjantit.com/free-ssh-${jantitSlug}`;
      base.v2ray_vmess = `https://www.vpnjantit.com/free-v2ray-vmess-${jantitSlug}`;
      base.v2ray_vless = `https://www.vpnjantit.com/free-v2ray-vless-${jantitSlug}`;
      base.wireguard = `https://www.vpnjantit.com/free-wireguard-${jantitSlug}`;
      base.squid = `https://www.vpnjantit.com/free-ssh-${jantitSlug}`;
    } else if (provider.providerId === 'v2nodes') {
      const iso2 =
        slug === 'saudi-arabia'
          ? 'sa'
          : slug === 'uae' || slug === 'united-arab-emirates'
          ? 'ae'
          : slug === 'turkey'
          ? 'tr'
          : slug === 'germany'
          ? 'de'
          : slug === 'singapore'
          ? 'sg'
          : slug === 'france'
          ? 'fr'
          : slug === 'united-kingdom'
          ? 'gb'
          : slug === 'united-states'
          ? 'us'
          : '';
      if (iso2) {
        base.v2ray_vmess = `https://www.v2nodes.com/country/${iso2}/`;
        base.v2ray_vless = `https://www.v2nodes.com/country/${iso2}/`;
      }
    }
  }

  if (provider.providerId === 'racevpn' && pageUrl.includes('free-openssh-')) {
    base.ssh_ws = pageUrl;
    base.ssh_ssl = pageUrl;
    base.ssh_dropbear = pageUrl;
  }

  return base;
}

export const SSH_TUNNEL_NET_SEEDS: ServerSummary[] = [
  {
    serverId: '15',
    providerId: 'sshtunnel',
    providerName: 'ssh-tunnel.net',
    code: 'DE 2',
    name: 'SSH Tunnel Server DE 2',
    host: 'de-2.stunnel.cc',
    slowDnsHost: 'dns.de-2.stunnel.cc',
    regionPath: '/europe-africa/server-15/',
    pageUrl: 'https://www.ssh-tunnel.net/europe-africa/server-15/',
    regionLabelAr: 'أوروبا وأفريقيا',
    location: 'Frankfurt',
    country: 'Germany',
    countryAr: 'ألمانيا (فرانكفورت)',
    status: 'Online',
    accountUsagePercent: 5,
    estimatedConnectedUsers: 22,
    supportedProtocols: ALL_NINE_PROTOCOLS,
    protocolCreateUrls: buildServerProtocolUrls(PROVIDERS_CATALOG[0], 'https://www.ssh-tunnel.net/europe-africa/server-15/'),
    validityDaysLabelAr: '3 أيام',
    resetScheduleAr: '06:00 PM و 06:00 AM (GMT+7)',
    services: { dnstt: 'DOWN', v2ray: 'UP', wireguard: 'UP', noobzvpn: 'UP', squid: 'UP' },
  },
];

function makeSeedServer(params: {
  serverId: string;
  provider: ProviderMetaConfig;
  code: string;
  host: string;
  slowDnsHost?: string;
  pageUrl: string;
  status?: 'Online' | 'Offline';
  protocols?: ProtocolFormatId[];
  countryOverride?: CountryInfo;
  usagePercent?: number;
}): ServerSummary {
  const c = params.countryOverride ?? inferCountryFromCode(params.host);
  const supported = params.protocols ?? params.provider.supportedProtocols;
  const countrySlug = c.country.toLowerCase().replace(/\s+/g, '-');
  return {
    serverId: params.serverId,
    providerId: params.provider.providerId,
    providerName: params.provider.name,
    code: params.code,
    name: `${params.provider.name} · ${params.code}`,
    host: params.host,
    slowDnsHost: params.slowDnsHost || `dns.${params.host}`,
    regionPath: '/',
    pageUrl: params.pageUrl,
    regionLabelAr: c.regionLabelAr,
    location: c.location,
    country: c.country,
    countryAr: c.countryAr,
    status: params.status ?? 'Online',
    accountUsagePercent: params.usagePercent ?? 15,
    estimatedConnectedUsers: 35,
    supportedProtocols: supported,
    protocolCreateUrls: buildServerProtocolUrls(params.provider, params.pageUrl, countrySlug),
    validityDaysLabelAr: params.provider.validityDaysLabelAr,
    resetScheduleAr: params.provider.resetScheduleAr,
    services: makeServicesFromProtocols(supported, true),
  };
}

function getFallbackSeedsByProvider(): Record<string, ServerSummary[]> {
  const byId = Object.fromEntries(PROVIDERS_CATALOG.map((p) => [p.providerId, p]));

  return {
    sshtunnel: SSH_TUNNEL_NET_SEEDS,
    sshocean: [
      makeSeedServer({ serverId: 'oce_de1_ws', provider: byId.sshocean, code: 'DE1 WS', host: 'de1.wssht.to', pageUrl: 'https://sshocean.com/sshws/germany' }),
      makeSeedServer({ serverId: 'oce_fr1_ws', provider: byId.sshocean, code: 'FR1 WS', host: 'fr1.wssht.to', pageUrl: 'https://sshocean.com/sshws/france' }),
      makeSeedServer({ serverId: 'oce_nl1_ws', provider: byId.sshocean, code: 'NL1 WS', host: 'nl1.wssht.to', pageUrl: 'https://sshocean.com/sshws/netherlands' }),
      makeSeedServer({ serverId: 'oce_pl1_ws', provider: byId.sshocean, code: 'PL1 WS', host: 'pl1.wssht.to', pageUrl: 'https://sshocean.com/sshws' }),
      makeSeedServer({ serverId: 'oce_de1_st', provider: byId.sshocean, code: 'DE1 SSL', host: 'de1.sshweb.site', pageUrl: 'https://sshocean.com/ssh-stunnel/germany' }),
      makeSeedServer({ serverId: 'oce_fr1_st', provider: byId.sshocean, code: 'FR1 SSL', host: 'fr1.sshweb.site', pageUrl: 'https://sshocean.com/ssh-stunnel/france' }),
      makeSeedServer({ serverId: 'oce_nl1_st', provider: byId.sshocean, code: 'NL1 SSL', host: 'nl1.sshweb.site', pageUrl: 'https://sshocean.com/ssh-stunnel/netherlands' }),
      makeSeedServer({ serverId: 'oce_us1_st', provider: byId.sshocean, code: 'US1 SSL', host: 'us1.sshweb.site', pageUrl: 'https://sshocean.com/ssh-stunnel' }),
      makeSeedServer({ serverId: 'oce_de1_nb', provider: byId.sshocean, code: 'DE1 Noobz', host: 'de1.nvpnz.space', pageUrl: 'https://sshocean.com/noobzvpn' }),
      makeSeedServer({ serverId: 'oce_nl1_nb', provider: byId.sshocean, code: 'NL1 Noobz', host: 'nl1.nvpnz.space', pageUrl: 'https://sshocean.com/noobzvpn' }),
    ],
    tcpvpn: [
      makeSeedServer({ serverId: 'tcp_de_ws', provider: byId.tcpvpn, code: 'DE WS', host: 'de-ws.tcpvpn.com', pageUrl: 'https://tcpvpn.com/websocket-server' }),
      makeSeedServer({ serverId: 'tcp_de2_ws', provider: byId.tcpvpn, code: 'DE2 WS', host: 'de2-ws.tcpvpn.com', pageUrl: 'https://tcpvpn.com/websocket-server' }),
      makeSeedServer({ serverId: 'tcp_fr_ws', provider: byId.tcpvpn, code: 'FR WS', host: 'fr-ws.tcpvpn.com', pageUrl: 'https://tcpvpn.com/websocket-server' }),
      makeSeedServer({ serverId: 'tcp_uk_ws', provider: byId.tcpvpn, code: 'UK WS', host: 'uk-ws.tcpvpn.com', pageUrl: 'https://tcpvpn.com/websocket-server' }),
      makeSeedServer({ serverId: 'tcp_usa_ws', provider: byId.tcpvpn, code: 'USA WS', host: 'usa-ws.tcpvpn.com', pageUrl: 'https://tcpvpn.com/websocket-server' }),
      makeSeedServer({ serverId: 'tcp_id_ws', provider: byId.tcpvpn, code: 'ID WS', host: 'id-ws.tcpvpn.com', pageUrl: 'https://tcpvpn.com/websocket-server' }),
      makeSeedServer({ serverId: 'tcp_sg_vpn', provider: byId.tcpvpn, code: 'SG1 VPN', host: 'sg-svpn.tcpvpn.com', pageUrl: 'https://www.tcpvpn.com/vpn-server-singapore' }),
      makeSeedServer({ serverId: 'tcp_sg2_vpn', provider: byId.tcpvpn, code: 'SG2 VPN', host: 'sg2-svpn.tcpvpn.com', pageUrl: 'https://www.tcpvpn.com/vpn-server-singapore' }),
    ],
    akunssh: [
      makeSeedServer({ serverId: 'akn_ae1_ws', provider: byId.akunssh, code: 'AE1 WS', host: 'ae1-ws.dnsx.my', pageUrl: 'https://akunssh.net/ssh-websocket-server' }),
      makeSeedServer({ serverId: 'akn_de1_ws', provider: byId.akunssh, code: 'DE1 WS', host: 'de1-ws.dnsx.my', pageUrl: 'https://akunssh.net/ssh-websocket-server' }),
      makeSeedServer({ serverId: 'akn_id1_ws', provider: byId.akunssh, code: 'ID1 WS', host: 'id1-ws.dnsx.my', pageUrl: 'https://akunssh.net/ssh-websocket-server' }),
      makeSeedServer({ serverId: 'akn_jp_ssh', provider: byId.akunssh, code: 'JP SSH', host: 'jp.ddnsx.my', pageUrl: 'https://akunssh.net/ssh-server' }),
      makeSeedServer({ serverId: 'akn_de1_vm', provider: byId.akunssh, code: 'DE1 VMess', host: 'de1-vmess.dnsx.my', pageUrl: 'https://akunssh.net/v2ray-vmess-server' }),
      makeSeedServer({ serverId: 'akn_ae1_vl', provider: byId.akunssh, code: 'AE1 VLESS', host: 'ae1-vless.dnsx.my', pageUrl: 'https://akunssh.net/v2ray-vless-server' }),
      makeSeedServer({ serverId: 'akn_pl1_vl', provider: byId.akunssh, code: 'PL1 VLESS', host: 'pl1-vless.dnsx.my', pageUrl: 'https://akunssh.net/v2ray-vless-server' }),
    ],
    opentunnel: [
      makeSeedServer({ serverId: 'opt_uk2', provider: byId.opentunnel, code: 'UK 2', host: 'uks-2.optnl.com', pageUrl: 'https://www.opentunnel.net/ssh/' }),
      makeSeedServer({ serverId: 'opt_fr3', provider: byId.opentunnel, code: 'FR 3', host: 'frs-3.optnl.com', pageUrl: 'https://www.opentunnel.net/ssh/' }),
      makeSeedServer({ serverId: 'opt_de2', provider: byId.opentunnel, code: 'DE 2', host: 'des-2.optnl.com', pageUrl: 'https://www.opentunnel.net/ssh/' }),
      makeSeedServer({ serverId: 'opt_us4', provider: byId.opentunnel, code: 'US 4', host: 'uss-4.optnl.com', pageUrl: 'https://www.opentunnel.net/ssh/' }),
      makeSeedServer({ serverId: 'opt_lu2', provider: byId.opentunnel, code: 'LU 2', host: 'lus-2.optnl.com', pageUrl: 'https://www.opentunnel.net/ssh/' }),
      makeSeedServer({ serverId: 'opt_ca1', provider: byId.opentunnel, code: 'CA 1', host: 'cas-1.optnl.com', pageUrl: 'https://www.opentunnel.net/ssh/' }),
      makeSeedServer({ serverId: 'opt_wg_us1', provider: byId.opentunnel, code: 'WG US1', host: 'wg-us-1.optnl.com', pageUrl: 'https://www.opentunnel.net/wireguard/' }),
    ],
    greenssh: [
      makeSeedServer({ serverId: 'grn_sg1', provider: byId.greenssh, code: 'SG 1', host: 'sg1.wssht.site', pageUrl: 'https://greenssh.com/ssh-websocket/singapore' }),
      makeSeedServer({ serverId: 'grn_fr1', provider: byId.greenssh, code: 'FR 1', host: 'fr1.wssht.site', pageUrl: 'https://greenssh.com/ssh-websocket/france' }),
      makeSeedServer({ serverId: 'grn_jp1', provider: byId.greenssh, code: 'JP 1', host: 'jp1.wssht.site', pageUrl: 'https://greenssh.com/ssh-websocket/japan' }),
      makeSeedServer({ serverId: 'grn_sgp1', provider: byId.greenssh, code: 'SGP 1', host: 'sgp1.greenssh.com', pageUrl: 'https://greenssh.com/ssh-websocket/germany' }),
    ],
    vpnhack: [
      makeSeedServer({ serverId: 'vhk_se1', provider: byId.vpnhack, code: 'SE 1 WS', host: 'se1.vpnhck.site', pageUrl: 'https://vpnhack.com/ssh-websocket/france' }),
      makeSeedServer({ serverId: 'vhk_us1', provider: byId.vpnhack, code: 'US 1 WS', host: 'us1.vpnhck.site', pageUrl: 'https://vpnhack.com/ssh-websocket/united-states' }),
      makeSeedServer({ serverId: 'vhk_sg1', provider: byId.vpnhack, code: 'SG 1', host: 'sg1.vpnhack.com', pageUrl: 'https://vpnhack.com/ssh-websocket/singapore' }),
      makeSeedServer({ serverId: 'vhk_de1', provider: byId.vpnhack, code: 'DE 1', host: 'de1.vpnhack.com', pageUrl: 'https://vpnhack.com/ssh-websocket/germany' }),
      makeSeedServer({ serverId: 'vhk_fr1', provider: byId.vpnhack, code: 'FR 1', host: 'fr1.vpnhack.com', pageUrl: 'https://vpnhack.com/ssh-websocket/france' }),
      makeSeedServer({ serverId: 'vhk_nl1', provider: byId.vpnhack, code: 'NL 1', host: 'nl1.vpnhack.com', pageUrl: 'https://vpnhack.com/server-latency' }),
      makeSeedServer({ serverId: 'vhk_uk1', provider: byId.vpnhack, code: 'UK 1', host: 'uk1.vpnhack.com', pageUrl: 'https://vpnhack.com/server-latency' }),
    ],
    sshstores: [
      makeSeedServer({ serverId: 'str_sg1', provider: byId.sshstores, code: 'SG 1 WS', host: 'sg1.ws-tun.xyz', pageUrl: 'https://sshstores.net/ssh-websocket/singapore' }),
      makeSeedServer({ serverId: 'str_sg2', provider: byId.sshstores, code: 'SG 2 WS', host: 'sg2.ws-tun.xyz', pageUrl: 'https://sshstores.net/ssh-websocket/singapore' }),
      makeSeedServer({ serverId: 'str_us1', provider: byId.sshstores, code: 'US 1 WS', host: 'us1.ws-tun.xyz', pageUrl: 'https://sshstores.net/ssh-websocket/united-states' }),
      makeSeedServer({ serverId: 'str_us2', provider: byId.sshstores, code: 'US 2 WS', host: 'us2.ws-tun.xyz', pageUrl: 'https://sshstores.net/ssh-websocket/united-states' }),
      makeSeedServer({ serverId: 'str_hk1', provider: byId.sshstores, code: 'HK 1 WS', host: 'hk1.ws-tun.xyz', pageUrl: 'https://sshstores.net/ssh-websocket/germany' }),
      makeSeedServer({ serverId: 'str_sg1_vm', provider: byId.sshstores, code: 'SG 1 VMess', host: 'sg1.vmtun.online', pageUrl: 'https://sshstores.net/vmess/singapore' }),
      makeSeedServer({ serverId: 'str_sg2_vm', provider: byId.sshstores, code: 'SG 2 VMess', host: 'sg2.vmtun.online', pageUrl: 'https://sshstores.net/vmess/singapore' }),
    ],
    vpnstunnel: [
      makeSeedServer({ serverId: 'vpn_ssh2', provider: byId.vpnstunnel, code: 'SSH-2', host: 'ssh-2.chice.me', pageUrl: 'https://vpnstunnel.com/ssh' }),
      makeSeedServer({ serverId: 'vpn_ssh3', provider: byId.vpnstunnel, code: 'SSH-3', host: 'ssh-3.chice.me', pageUrl: 'https://vpnstunnel.com/ssh' }),
      makeSeedServer({ serverId: 'vpn_ssh4', provider: byId.vpnstunnel, code: 'SSH-4', host: 'ssh-4.chice.me', pageUrl: 'https://vpnstunnel.com/ssh' }),
      makeSeedServer({ serverId: 'vpn_jp1', provider: byId.vpnstunnel, code: 'SSH-JP', host: 'ssh-jp.mozy.me', pageUrl: 'https://vpnstunnel.com/ssh' }),
      makeSeedServer({ serverId: 'vpn_id2', provider: byId.vpnstunnel, code: 'ID-2', host: 'id2.josvpn.me', pageUrl: 'https://vpnstunnel.com/ssh' }),
      makeSeedServer({ serverId: 'vpn_xray', provider: byId.vpnstunnel, code: 'Xray V2Ray', host: 'xray.vivie.me', pageUrl: 'https://vpnstunnel.com/v2ray-vmess-ws' }),
    ],
    jagoanssh: [
      makeSeedServer({
        serverId: 'jgn_panel',
        provider: byId.jagoanssh,
        code: 'Panel SG/US',
        host: 'panel.jagoanssh.com',
        pageUrl: 'https://www.jagoanssh.com/?do=ssh-servers',
        countryOverride: COUNTRY_BY_PREFIX.sg,
      }),
      makeSeedServer({
        serverId: 'jgn_main',
        provider: byId.jagoanssh,
        code: 'Jagoan Main',
        host: 'www.jagoanssh.com',
        pageUrl: 'https://www.jagoanssh.com/?do=v2ray',
        countryOverride: COUNTRY_BY_PREFIX.sg,
      }),
    ],
    freevpnus: [
      makeSeedServer({ serverId: 'fvu_de1', provider: byId.freevpnus, code: 'SSH DE 1', host: 'ssh-de-1.vpnv.cc', pageUrl: 'https://www.freevpn.us/ssh-tunnel/' }),
      makeSeedServer({ serverId: 'fvu_nl1', provider: byId.freevpnus, code: 'SSH NL 1', host: 'ssh-nl-1.vpnv.cc', pageUrl: 'https://www.freevpn.us/ssh-tunnel/' }),
      makeSeedServer({ serverId: 'fvu_sg2', provider: byId.freevpnus, code: 'SSH SG 2', host: 'ssh-sg-2.vpnv.cc', pageUrl: 'https://www.freevpn.us/ssh-tunnel/' }),
      makeSeedServer({ serverId: 'fvu_id1', provider: byId.freevpnus, code: 'SSH ID 1', host: 'ssh-id-1.vpnv.cc', pageUrl: 'https://www.freevpn.us/ssh-custom/' }),
      makeSeedServer({ serverId: 'fvu_ee1', provider: byId.freevpnus, code: 'OVPN EE 1', host: 'ovpn-ee-1.vpnv.cc', pageUrl: 'https://www.freevpn.us/pages/server-status.html' }),
    ],
    vpnjantit: [
      makeSeedServer({
        serverId: 'jnt_sau1',
        provider: byId.vpnjantit,
        code: 'SAU 1',
        host: 'sau1.vpnjantit.com',
        pageUrl: 'https://www.vpnjantit.com/free-ssh-saudi-arabia',
        countryOverride: COUNTRY_BY_PREFIX.sa,
      }),
      makeSeedServer({
        serverId: 'jnt_sau2',
        provider: byId.vpnjantit,
        code: 'SAU 2',
        host: 'sau2.vpnjantit.com',
        pageUrl: 'https://www.vpnjantit.com/free-ssh-saudi-arabia',
        countryOverride: COUNTRY_BY_PREFIX.sa,
      }),
      makeSeedServer({
        serverId: 'jnt_ae1',
        provider: byId.vpnjantit,
        code: 'AE 1',
        host: 'ae1.vpnjantit.com',
        pageUrl: 'https://www.vpnjantit.com/free-ssh-united-arab-emirates',
        countryOverride: COUNTRY_BY_PREFIX.ae,
      }),
      makeSeedServer({
        serverId: 'jnt_ae2',
        provider: byId.vpnjantit,
        code: 'AE 2',
        host: 'ae2.vpnjantit.com',
        pageUrl: 'https://www.vpnjantit.com/free-ssh-united-arab-emirates',
        countryOverride: COUNTRY_BY_PREFIX.ae,
      }),
      makeSeedServer({
        serverId: 'jnt_bh1',
        provider: byId.vpnjantit,
        code: 'BH 1',
        host: 'bh1.vpnjantit.com',
        pageUrl: 'https://www.vpnjantit.com/free-ssh-bahrain',
        countryOverride: COUNTRY_BY_PREFIX.bh,
      }),
      makeSeedServer({
        serverId: 'jnt_tr1',
        provider: byId.vpnjantit,
        code: 'TR 1',
        host: 'tr1.vpnjantit.com',
        pageUrl: 'https://www.vpnjantit.com/free-ssh-turkey',
        countryOverride: COUNTRY_BY_PREFIX.tr,
      }),
    ],
    hidessh: [
      makeSeedServer({
        serverId: 'hds_panel',
        provider: byId.hidessh,
        code: 'HideSSH Panel',
        host: 'panel.hidessh.com',
        pageUrl: 'https://hidessh.com/ssh-cloudfront',
        countryOverride: COUNTRY_BY_PREFIX.sg,
      }),
      makeSeedServer({
        serverId: 'hds_id1',
        provider: byId.hidessh,
        code: 'HideSSH ID',
        host: 'id.hideserver.xyz',
        pageUrl: 'https://hidessh.com/ssh',
        countryOverride: COUNTRY_BY_PREFIX.id,
      }),
    ],
    jagovpn: [
      makeSeedServer({
        serverId: 'jgv_main',
        provider: byId.jagovpn,
        code: 'JagoVPN Main',
        host: 'jagovpn.com',
        pageUrl: 'https://jagovpn.com/ssh-tunnel',
        countryOverride: COUNTRY_BY_PREFIX.sg,
      }),
    ],
    serverssh: [
      makeSeedServer({
        serverId: 'srv_status',
        provider: byId.serverssh,
        code: 'ServerSSH Main',
        host: 'status.serverssh.net',
        pageUrl: 'https://serverssh.net/?q=ssh-servers',
        countryOverride: COUNTRY_BY_PREFIX.sg,
      }),
    ],
    fastssh: [
      makeSeedServer({
        serverId: 'fst_panel',
        provider: byId.fastssh,
        code: 'FastSSH Panel',
        host: 'panel.fastssh.com',
        pageUrl: 'https://www.fastssh.com/page/ssh-ssl-stunnel-servers/',
        countryOverride: COUNTRY_BY_PREFIX.sg,
      }),
    ],
    howdy: [
      makeSeedServer({
        serverId: 'hwd_main',
        provider: byId.howdy,
        code: 'Howdy Xray',
        host: 'howdy.id',
        pageUrl: 'https://howdy.id/xray-vmess-vless-trojan/',
        countryOverride: COUNTRY_BY_PREFIX.id,
      }),
    ],
    racevpn: [
      makeSeedServer({ serverId: 'rcv_de', provider: byId.racevpn, code: 'DE', host: 'de.connall.org', pageUrl: 'https://www.racevpn.com/free-openssh-europe-server' }),
      makeSeedServer({ serverId: 'rcv_fr', provider: byId.racevpn, code: 'FR', host: 'fr.connall.org', pageUrl: 'https://www.racevpn.com/free-openssh-europe-server' }),
      makeSeedServer({ serverId: 'rcv_sg', provider: byId.racevpn, code: 'SG', host: 'sg.connall.org', pageUrl: 'https://www.racevpn.com/free-openssh-asia-server' }),
    ],
    cyberssh: [
      makeSeedServer({ serverId: 'cyb_sgf', provider: byId.cyberssh, code: 'SG FAST', host: 'ssh-sgfast1.cyberssh.com', pageUrl: 'https://cyberssh.com/ssh/index', countryOverride: COUNTRY_BY_PREFIX.sg }),
      makeSeedServer({ serverId: 'cyb_sg1', provider: byId.cyberssh, code: 'SG 1', host: 'sg1.cyberssh.com', pageUrl: 'https://cyberssh.com/ssh/index' }),
      makeSeedServer({ serverId: 'cyb_usa1', provider: byId.cyberssh, code: 'USA 1', host: 'ssh-usa1.cyberssh.com', pageUrl: 'https://cyberssh.com/ssh/index' }),
    ],
    v2nodes: [
      makeSeedServer({ serverId: 'v2n_sa1', provider: byId.v2nodes, code: 'SA VLESS', host: '81.208.170.142', pageUrl: 'https://www.v2nodes.com/country/sa/', countryOverride: COUNTRY_BY_PREFIX.sa }),
      makeSeedServer({ serverId: 'v2n_ae1', provider: byId.v2nodes, code: 'AE VLESS', host: '95.174.68.188', pageUrl: 'https://www.v2nodes.com/country/ae/', countryOverride: COUNTRY_BY_PREFIX.ae }),
      makeSeedServer({ serverId: 'v2n_tr1', provider: byId.v2nodes, code: 'TR V2Ray', host: '185.246.155.91', pageUrl: 'https://www.v2nodes.com/country/tr/', countryOverride: COUNTRY_BY_PREFIX.tr }),
    ],
    openproxylist: [
      makeSeedServer({ serverId: 'opl_sa1', provider: byId.openproxylist, code: 'SA 12496', host: '81.208.170.142', pageUrl: 'https://openproxylist.com/v2ray/', countryOverride: COUNTRY_BY_PREFIX.sa }),
      makeSeedServer({ serverId: 'opl_ae1', provider: byId.openproxylist, code: 'AE 15975', host: '95.174.68.188', pageUrl: 'https://openproxylist.com/v2ray/', countryOverride: COUNTRY_BY_PREFIX.ae }),
    ],
    freevmess: [
      makeSeedServer({ serverId: 'fvm_sg1', provider: byId.freevmess, code: 'VMess 1', host: '51.79.159.204', pageUrl: 'https://www.freevmess.com/server-vmesswebsockets', countryOverride: COUNTRY_BY_PREFIX.sg }),
      makeSeedServer({ serverId: 'fvm_fr1', provider: byId.freevmess, code: 'VLESS 1', host: '51.195.20.136', pageUrl: 'https://www.freevmess.com/server-vlesswebsockets', countryOverride: COUNTRY_BY_PREFIX.fr }),
    ],
    vpngate: [
      makeSeedServer({ serverId: 'vg_jp1', provider: byId.vpngate, code: 'VPN Gate JP', host: 'www.vpngate.net', pageUrl: 'https://www.vpngate.net/en/', countryOverride: COUNTRY_BY_PREFIX.jp }),
    ],
    vpnbook: [
      makeSeedServer({ serverId: 'vb_de20', provider: byId.vpnbook, code: 'DE 20', host: 'de20.vpnbook.com', pageUrl: 'https://www.vpnbook.com/freevpn', countryOverride: COUNTRY_BY_PREFIX.de }),
      makeSeedServer({ serverId: 'vb_fr200', provider: byId.vpnbook, code: 'FR 200', host: 'fr200.vpnbook.com', pageUrl: 'https://www.vpnbook.com/freevpn', countryOverride: COUNTRY_BY_PREFIX.fr }),
      makeSeedServer({ serverId: 'vb_uk205', provider: byId.vpnbook, code: 'UK 205', host: 'uk205.vpnbook.com', pageUrl: 'https://www.vpnbook.com/freevpn', countryOverride: COUNTRY_BY_PREFIX.uk }),
      makeSeedServer({ serverId: 'vb_us16', provider: byId.vpnbook, code: 'US 16', host: 'us16.vpnbook.com', pageUrl: 'https://www.vpnbook.com/freevpn', countryOverride: COUNTRY_BY_PREFIX.us }),
      makeSeedServer({ serverId: 'vb_ca149', provider: byId.vpnbook, code: 'CA 149', host: 'ca149.vpnbook.com', pageUrl: 'https://www.vpnbook.com/freevpn', countryOverride: COUNTRY_BY_PREFIX.ca }),
    ],
    greensshnet: [
      makeSeedServer({ serverId: 'grn2_main', provider: byId.greensshnet, code: 'GreenSSH.net', host: 'greenssh.net', pageUrl: 'https://greenssh.net/ssh-websocket/', countryOverride: COUNTRY_BY_PREFIX.sg }),
    ],
    openvpnssh: [
      makeSeedServer({ serverId: 'ovps_main', provider: byId.openvpnssh, code: 'OpenVPN-SSH', host: 'openvpn-ssh.com', pageUrl: 'https://openvpn-ssh.com/?cmd=server', countryOverride: COUNTRY_BY_PREFIX.us }),
    ],
  };
}

export async function fetchHtmlFast(url: string, timeoutMs = 6500): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseSshOceanStatusRows(html: string, provider: ProviderMetaConfig): ServerSummary[] {
  const results: ServerSummary[] = [];
  const seenHosts = new Set<string>();
  const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[0];
    const hostMatch = row.match(/([a-z0-9-]+\.(?:wssht\.to|sshweb\.site|udpweb\.site|nvpnz\.space))/i);
    if (!hostMatch) continue;
    const host = hostMatch[1].toLowerCase();
    if (seenHosts.has(host)) continue;
    seenHosts.add(host);

    const text = row.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const isOffline = /\bOffline\b/i.test(text);
    const labelPrefix = host.split('.')[0].toUpperCase();
    const protoTag = host.includes('nvpnz')
      ? 'Noobz'
      : host.includes('udpweb')
      ? 'UDP'
      : host.includes('sshweb')
      ? 'SSL'
      : 'WS';
    const protocols: ProtocolFormatId[] = host.includes('nvpnz')
      ? ['noobzvpn']
      : host.includes('udpweb')
      ? ['slowdns', 'ssh_dropbear']
      : host.includes('sshweb')
      ? ['ssh_ssl', 'squid']
      : ['ssh_ws', 'ssh_dropbear', 'squid'];

    results.push(
      makeSeedServer({
        serverId: makeShortServerId('oce', host.replace(/\./g, '_')),
        provider,
        code: `${labelPrefix} ${protoTag}`,
        host,
        pageUrl: 'https://sshocean.com/server-status',
        status: isOffline ? 'Offline' : 'Online',
        protocols,
      }),
    );
    if (results.length >= 16) break;
  }
  return results;
}

function parseFreeVpnUsStatusRows(html: string, provider: ProviderMetaConfig): ServerSummary[] {
  const results: ServerSummary[] = [];
  const seenHosts = new Set<string>();
  const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[0];
    const hostMatch = row.match(/([a-z0-9-]+\.vpnv\.cc)/i);
    if (!hostMatch) continue;
    const host = hostMatch[1].toLowerCase();
    if (seenHosts.has(host)) continue;
    seenHosts.add(host);

    const text = row.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const isOffline = /\bOffline\b/i.test(text);
    const pctMatch = text.match(/(\d+)%/);
    const usagePct = pctMatch ? Number(pctMatch[1]) : 5;
    const code = host.split('.')[0].toUpperCase();

    results.push(
      makeSeedServer({
        serverId: makeShortServerId('fvu', code),
        provider,
        code,
        host,
        pageUrl: 'https://www.freevpn.us/ssh-tunnel/',
        status: isOffline ? 'Offline' : 'Online',
        usagePercent: usagePct,
      }),
    );
    if (results.length >= 12) break;
  }
  return results;
}

function parseVpnsTunnelStatusRows(html: string, provider: ProviderMetaConfig): ServerSummary[] {
  const results: ServerSummary[] = [];
  const seenHosts = new Set<string>();
  const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[0];
    const hostMatch = row.match(/([a-z0-9-]+\.(?:chice\.me|vivie\.me|okgas\.me|gyava\.me|josvpn\.me|mozy\.me|vhina\.tech))/i);
    if (!hostMatch) continue;
    const host = hostMatch[1].toLowerCase();
    if (seenHosts.has(host)) continue;
    seenHosts.add(host);

    const text = row.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const isOffline = /\bOffline\b/i.test(text);
    const code = host.split('.')[0].toUpperCase();
    results.push(
      makeSeedServer({
        serverId: makeShortServerId('vpn', host.replace(/\./g, '_')),
        provider,
        code,
        host,
        pageUrl: 'https://vpnstunnel.com/server-status',
        status: isOffline ? 'Offline' : 'Online',
      }),
    );
    if (results.length >= 12) break;
  }
  return results;
}

function parseHostListFromHtml(
  html: string,
  domainSuffixPattern: RegExp,
  provider: ProviderMetaConfig,
  idPrefix: string,
  pageUrl: string,
  maxCount = 12,
  protocolsOverride?: ProtocolFormatId[],
): ServerSummary[] {
  const matches = html.match(domainSuffixPattern) || [];
  const unique = Array.from(new Set(matches.map((m) => m.toLowerCase()))).slice(0, maxCount);
  return unique.map((host) => {
    const label = host.split('.')[0].toUpperCase();
    return makeSeedServer({
      serverId: makeShortServerId(idPrefix, label),
      provider,
      code: label,
      host,
      pageUrl,
      protocols: protocolsOverride,
    });
  });
}

function parseVpnJantitCountryPages(
  pages: Array<{ html: string | null; pageUrl: string; countryOverride: CountryInfo }>,
  provider: ProviderMetaConfig,
): ServerSummary[] {
  const results: ServerSummary[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    if (!page.html) continue;
    const matches = page.html.match(/\b[a-z0-9-]+\.vpnjantit\.com\b/gi) || [];
    for (const rawHost of matches) {
      const host = rawHost.toLowerCase();
      if (host.startsWith('www.') || seen.has(host)) continue;
      seen.add(host);
      const label = host.split('.')[0].toUpperCase();
      results.push(
        makeSeedServer({
          serverId: makeShortServerId('jnt', label),
          provider,
          code: label,
          host,
          pageUrl: page.pageUrl,
          countryOverride: page.countryOverride,
        }),
      );
    }
  }
  return results;
}

function parseOpenProxyListRaw(rawText: string, provider: ProviderMetaConfig): ServerSummary[] {
  let content = rawText.trim();
  if (content && !content.includes('vmess://') && !content.includes('vless://')) {
    try {
      const decoded = Buffer.from(content, 'base64').toString('utf8');
      if (decoded.includes('://')) {
        content = decoded;
      }
    } catch {
      // keep raw
    }
  }
  const results: ServerSummary[] = [];
  const byHost = new Map<
    string,
    { host: string; cc: string; isArab: boolean; code: string; protos: Set<ProtocolFormatId> }
  >();
  const lines = content.split(/\r?\n/).filter(Boolean);

  const mapCcToCountry = (cc: string): CountryInfo => {
    const key = cc.toLowerCase();
    if (COUNTRY_BY_PREFIX[key]) return COUNTRY_BY_PREFIX[key];
    return { regionLabelAr: 'عالمي', location: cc, country: cc, countryAr: cc };
  };

  for (const line of lines) {
    let host = '';
    let tag = '';
    let proto: ProtocolFormatId | null = null;
    if (line.startsWith('vmess://')) {
      try {
        const json = JSON.parse(Buffer.from(line.slice(8), 'base64').toString('utf8')) as {
          add?: string;
          ps?: string;
        };
        host = (json.add || '').trim();
        tag = json.ps || '';
        proto = 'v2ray_vmess';
      } catch {
        continue;
      }
    } else if (line.startsWith('vless://')) {
      const m = line.match(/@([^:/?#\s]+):\d+/);
      if (m) {
        host = m[1].trim();
      }
      const hashIdx = line.indexOf('#');
      if (hashIdx !== -1) {
        try {
          tag = decodeURIComponent(line.slice(hashIdx + 1));
        } catch {
          tag = line.slice(hashIdx + 1);
        }
      }
      proto = 'v2ray_vless';
    }
    if (!host || !proto) continue;
    const normalizedHost = host.toLowerCase();
    const existing = byHost.get(normalizedHost);
    if (existing) {
      existing.protos.add(proto);
      continue;
    }
    const ccMatch = tag.match(/\b(SA|AE|EG|BH|OM|QA|KW|JO|MA|TR|DE|FR|NL|GB|UK|US|SG|JP)\b/i);
    const cc = (ccMatch ? ccMatch[1] : 'SG').toUpperCase();
    const isArab = ['SA', 'AE', 'EG', 'BH', 'OM', 'QA', 'KW', 'JO', 'MA', 'TR'].includes(cc);
    byHost.set(normalizedHost, {
      host: normalizedHost,
      cc,
      isArab,
      code: `${cc} V2Ray`,
      protos: new Set([proto]),
    });
  }

  const parsed = Array.from(byHost.values());
  parsed.sort((a, b) => Number(b.isArab) - Number(a.isArab));
  for (const item of parsed.slice(0, 12)) {
    results.push(
      makeSeedServer({
        serverId: makeShortServerId('opl', `${item.cc}_${item.host.replace(/\./g, '_')}`),
        provider,
        code: item.code,
        host: item.host,
        pageUrl: provider.baseUrl,
        protocols: Array.from(item.protos),
        countryOverride: mapCcToCountry(item.cc),
      }),
    );
  }
  return results;
}

async function parseV2NodesCountryPages(
  pages: Array<{ html: string | null; pageUrl: string; countryOverride: CountryInfo; cc: string }>,
  provider: ProviderMetaConfig,
): Promise<ServerSummary[]> {
  const results: ServerSummary[] = [];
  const seenHosts = new Set<string>();
  const subFetches = await Promise.all(
    pages.map(async (page) => {
      if (!page.html) return null;
      const match = page.html.match(/data-config="([^"]+)"/i);
      if (!match?.[1]) return null;
      const subText = await fetchHtmlFast(match[1], 4500);
      return subText ? { page, subText } : null;
    }),
  );

  for (const item of subFetches) {
    if (!item) continue;
    const parsed = parseOpenProxyListRaw(item.subText, provider);
    for (const srv of parsed) {
      if (seenHosts.has(srv.host)) continue;
      seenHosts.add(srv.host);
      results.push({
        ...srv,
        serverId: makeShortServerId('v2n', `${item.page.cc}_${srv.host.replace(/[^a-z0-9]/gi, '_')}`),
        code: `${item.page.cc} V2Ray`,
        pageUrl: item.page.pageUrl,
        regionLabelAr: item.page.countryOverride.regionLabelAr,
        location: item.page.countryOverride.location,
        country: item.page.countryOverride.country,
        countryAr: item.page.countryOverride.countryAr,
      });
      if (results.length >= 12) return results;
    }
  }
  return results;
}

function parseVpnGateCsvFeed(csvText: string, provider: ProviderMetaConfig): ServerSummary[] {
  const results: ServerSummary[] = [];
  const seen = new Set<string>();
  const lines = csvText.split(/\r?\n/).slice(2);
  const rows: Array<{ host: string; ip: string; cc: string; countryLong: string; speedMbps: number; isArab: boolean }> = [];

  for (const line of lines) {
    if (!line || line.startsWith('*')) continue;
    const cols = line.split(',');
    if (cols.length < 7) continue;
    const hostname = (cols[0] || '').trim();
    const ip = (cols[1] || '').trim();
    const speedMbps = Math.round(Number(cols[4] || 0) / 1_000_000);
    const countryLong = (cols[5] || '').trim();
    const cc = (cols[6] || '').trim().toUpperCase();
    if (!ip || !hostname || seen.has(ip)) continue;
    seen.add(ip);
    const isArab = ['SA', 'AE', 'EG', 'BH', 'OM', 'QA', 'KW', 'JO', 'MA', 'DZ', 'TN', 'TR'].includes(cc);
    rows.push({ host: ip, ip, cc, countryLong, speedMbps, isArab });
  }

  rows.sort((a, b) => Number(b.isArab) - Number(a.isArab) || b.speedMbps - a.speedMbps);
  for (const r of rows.slice(0, 10)) {
    const key = r.cc.toLowerCase();
    const countryOverride: CountryInfo = COUNTRY_BY_PREFIX[key] ?? {
      regionLabelAr: 'آسيا / عالمي',
      location: r.countryLong || r.cc,
      country: r.countryLong || r.cc,
      countryAr: r.countryLong || r.cc,
    };
    results.push(
      makeSeedServer({
        serverId: makeShortServerId('vg', `${r.cc}_${r.ip.replace(/\./g, '_')}`),
        provider,
        code: `${r.cc} ${r.speedMbps}M`,
        host: r.ip,
        pageUrl: 'https://www.vpngate.net/en/',
        countryOverride,
      }),
    );
  }
  return results;
}

function parseFreeVmessIps(html: string, provider: ProviderMetaConfig): ServerSummary[] {
  const results: ServerSummary[] = [];
  const seen = new Set<string>();
  const matches = html.match(/\b(?:45|51|54|134|141|149|165|172|185|198|209)\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) || [];
  for (let i = 0; i < matches.length; i += 1) {
    const ip = matches[i];
    if (seen.has(ip)) continue;
    seen.add(ip);
    results.push(
      makeSeedServer({
        serverId: makeShortServerId('fvm', ip.replace(/\./g, '_')),
        provider,
        code: `Node ${results.length + 1}`,
        host: ip,
        pageUrl: 'https://www.freevmess.com/server-vmesswebsockets',
        countryOverride: COUNTRY_BY_PREFIX.sg,
      }),
    );
    if (results.length >= 8) break;
  }
  return results;
}

let catalogCache: {
  timestamp: number;
  providers: VpnProviderSummary[];
  allServers: ServerSummary[];
} | null = null;

const CATALOG_CACHE_TTL_MS = 120_000;

export function invalidateProvidersCatalogCache(): void {
  catalogCache = null;
}

function mergeWithExtraProviders(
  baseProviders: VpnProviderSummary[],
  extraProviders: VpnProviderSummary[],
): { providers: VpnProviderSummary[]; allServers: ServerSummary[] } {
  const seenIds = new Set(baseProviders.map((p) => p.providerId));
  const seenDomains = new Set(baseProviders.map((p) => p.domain.toLowerCase()));
  const merged = [...baseProviders];
  for (const extra of extraProviders) {
    if (seenIds.has(extra.providerId) || seenDomains.has(extra.domain.toLowerCase())) {
      continue;
    }
    seenIds.add(extra.providerId);
    seenDomains.add(extra.domain.toLowerCase());
    merged.push(extra);
  }
  return {
    providers: merged,
    allServers: merged.flatMap((p) => p.servers),
  };
}

export async function getAllProvidersAndServers(
  sshTunnelServers: ServerSummary[],
  forceRefresh = false,
  extraProviders: VpnProviderSummary[] = [],
): Promise<{ providers: VpnProviderSummary[]; allServers: ServerSummary[] }> {
  if (!forceRefresh && catalogCache && Date.now() - catalogCache.timestamp < CATALOG_CACHE_TTL_MS) {
    const updatedProviders = catalogCache.providers.map((p) =>
      p.providerId === 'sshtunnel'
        ? { ...p, servers: sshTunnelServers }
        : p,
    );
    return mergeWithExtraProviders(updatedProviders, extraProviders);
  }

  const fallbacks = getFallbackSeedsByProvider();
  const byId = Object.fromEntries(PROVIDERS_CATALOG.map((p) => [p.providerId, p]));

  const [
    oceHtml,
    tcpWsHtml,
    aknWsHtml,
    aknVlHtml,
    optSshHtml,
    vpnStatusHtml,
    strSgHtml,
    grnSgHtml,
    vhkFrHtml,
    jgnHtml,
    fvuStatusHtml,
    jntHtml,
    jntSaHtml,
    jntAeHtml,
    jntBhHtml,
    jntEgHtml,
    jntOmHtml,
    jntTrHtml,
    hdsHtml,
    jgvHtml,
    srvHtml,
    fstHtml,
    hwdHtml,
    rcvEuHtml,
    rcvAsHtml,
    cybStatusHtml,
    v2nSaHtml,
    v2nAeHtml,
    oplRawText,
    fvmHtml,
    vgCsvText,
    vbHtml,
    grnNetHtml,
    ovpSshHtml,
  ] = await Promise.all([
    fetchHtmlFast('https://sshocean.com/server-status'),
    fetchHtmlFast('https://tcpvpn.com/websocket-server'),
    fetchHtmlFast('https://akunssh.net/ssh-websocket-server/'),
    fetchHtmlFast('https://akunssh.net/v2ray-vless-server/'),
    fetchHtmlFast('https://www.opentunnel.net/ssh/'),
    fetchHtmlFast('https://vpnstunnel.com/server-status'),
    fetchHtmlFast('https://sshstores.net/ssh-websocket/singapore'),
    fetchHtmlFast('https://greenssh.com/ssh-websocket/singapore'),
    fetchHtmlFast('https://vpnhack.com/ssh-websocket/france'),
    fetchHtmlFast('https://www.jagoanssh.com/?do=ssh-servers'),
    fetchHtmlFast('https://www.freevpn.us/pages/server-status.html'),
    fetchHtmlFast('https://www.vpnjantit.com/free-ssh'),
    fetchHtmlFast('https://www.vpnjantit.com/free-ssh-saudi-arabia', 5500),
    fetchHtmlFast('https://www.vpnjantit.com/free-ssh-united-arab-emirates', 5500),
    fetchHtmlFast('https://www.vpnjantit.com/free-ssh-bahrain', 5500),
    fetchHtmlFast('https://www.vpnjantit.com/free-ssh-egypt', 5500),
    fetchHtmlFast('https://www.vpnjantit.com/free-ssh-oman', 5500),
    fetchHtmlFast('https://www.vpnjantit.com/free-ssh-turkey', 5500),
    fetchHtmlFast('https://hidessh.com/ssh-cloudfront'),
    fetchHtmlFast('https://jagovpn.com/ssh-tunnel'),
    fetchHtmlFast('https://serverssh.net/?q=ssh-servers'),
    fetchHtmlFast('https://www.fastssh.com/page/ssh-ssl-stunnel-servers/'),
    fetchHtmlFast('https://howdy.id/xray-vmess-vless-trojan/'),
    fetchHtmlFast('https://www.racevpn.com/free-openssh-europe-server', 5500),
    fetchHtmlFast('https://www.racevpn.com/free-openssh-asia-server', 5500),
    fetchHtmlFast('https://cyberssh.com/ssh/status', 5500),
    fetchHtmlFast('https://www.v2nodes.com/country/sa/', 5500),
    fetchHtmlFast('https://www.v2nodes.com/country/ae/', 5500),
    fetchHtmlFast('https://openproxylist.com/v2ray/rawlist/text', 5500),
    fetchHtmlFast('https://www.freevmess.com/server-vmesswebsockets', 5500),
    fetchHtmlFast('https://www.vpngate.net/api/iphone/', 6500),
    fetchHtmlFast('https://www.vpnbook.com/freevpn', 5500),
    fetchHtmlFast('https://greenssh.net/', 5500),
    fetchHtmlFast('https://openvpn-ssh.com/?cmd=server', 5500),
  ]);

  const jantitServers = parseVpnJantitCountryPages(
    [
      { html: jntSaHtml, pageUrl: 'https://www.vpnjantit.com/free-ssh-saudi-arabia', countryOverride: COUNTRY_BY_PREFIX.sa },
      { html: jntAeHtml, pageUrl: 'https://www.vpnjantit.com/free-ssh-united-arab-emirates', countryOverride: COUNTRY_BY_PREFIX.ae },
      { html: jntBhHtml, pageUrl: 'https://www.vpnjantit.com/free-ssh-bahrain', countryOverride: COUNTRY_BY_PREFIX.bh },
      { html: jntEgHtml, pageUrl: 'https://www.vpnjantit.com/free-ssh-egypt', countryOverride: COUNTRY_BY_PREFIX.eg },
      { html: jntOmHtml, pageUrl: 'https://www.vpnjantit.com/free-ssh-oman', countryOverride: COUNTRY_BY_PREFIX.om },
      { html: jntTrHtml, pageUrl: 'https://www.vpnjantit.com/free-ssh-turkey', countryOverride: COUNTRY_BY_PREFIX.tr },
    ],
    byId.vpnjantit,
  );

  const oplServers = oplRawText ? parseOpenProxyListRaw(oplRawText, byId.openproxylist) : [];
  const v2nServers = await parseV2NodesCountryPages(
    [
      { html: v2nSaHtml, pageUrl: 'https://www.v2nodes.com/country/sa/', countryOverride: COUNTRY_BY_PREFIX.sa, cc: 'SA' },
      { html: v2nAeHtml, pageUrl: 'https://www.v2nodes.com/country/ae/', countryOverride: COUNTRY_BY_PREFIX.ae, cc: 'AE' },
    ],
    byId.v2nodes,
  );

  const parsedByProvider: Record<string, { live: boolean; servers: ServerSummary[] }> = {
    sshtunnel: {
      live: true,
      servers: sshTunnelServers.length > 0 ? sshTunnelServers : fallbacks.sshtunnel,
    },
    sshocean: {
      live: Boolean(oceHtml),
      servers: oceHtml ? parseSshOceanStatusRows(oceHtml, byId.sshocean) : [],
    },
    tcpvpn: {
      live: Boolean(tcpWsHtml),
      servers: tcpWsHtml
        ? parseHostListFromHtml(
            tcpWsHtml,
            /[a-z0-9-]+\.tcpvpn\.com/gi,
            byId.tcpvpn,
            'tcp',
            'https://tcpvpn.com/websocket-server',
            10,
          )
        : [],
    },
    akunssh: {
      live: Boolean(aknWsHtml || aknVlHtml),
      servers: [
        ...(aknWsHtml
          ? parseHostListFromHtml(
              aknWsHtml,
              /[a-z0-9-]+\.(?:dnsx|ddnsx)\.my/gi,
              byId.akunssh,
              'akn',
              'https://akunssh.net/ssh-websocket-server',
              6,
              ['ssh_ws', 'ssh_ssl', 'ssh_dropbear', 'slowdns', 'noobzvpn', 'squid'],
            )
          : []),
        ...(aknVlHtml
          ? parseHostListFromHtml(
              aknVlHtml,
              /[a-z0-9-]+\.dnsx\.my/gi,
              byId.akunssh,
              'aknv',
              'https://akunssh.net/v2ray-vless-server',
              5,
              ['v2ray_vless', 'v2ray_vmess'],
            )
          : []),
      ],
    },
    opentunnel: {
      live: Boolean(optSshHtml),
      servers: optSshHtml
        ? parseHostListFromHtml(
            optSshHtml,
            /[a-z0-9-]+\.optnl\.com/gi,
            byId.opentunnel,
            'opt',
            'https://www.opentunnel.net/ssh/',
            10,
          )
        : [],
    },
    greenssh: {
      live: Boolean(grnSgHtml),
      servers: fallbacks.greenssh,
    },
    vpnhack: {
      live: Boolean(vhkFrHtml),
      servers: fallbacks.vpnhack,
    },
    sshstores: {
      live: Boolean(strSgHtml),
      servers: strSgHtml
        ? [
            ...parseHostListFromHtml(
              strSgHtml,
              /[a-z0-9-]+\.ws-tun\.xyz/gi,
              byId.sshstores,
              'str',
              'https://sshstores.net/ssh-websocket/singapore',
              6,
            ),
            ...fallbacks.sshstores.filter((s) => !s.host.endsWith('.ws-tun.xyz') || s.host.startsWith('us') || s.host.startsWith('hk')),
          ]
        : [],
    },
    vpnstunnel: {
      live: Boolean(vpnStatusHtml),
      servers: vpnStatusHtml ? parseVpnsTunnelStatusRows(vpnStatusHtml, byId.vpnstunnel) : [],
    },
    jagoanssh: {
      live: Boolean(jgnHtml),
      servers: fallbacks.jagoanssh,
    },
    freevpnus: {
      live: Boolean(fvuStatusHtml),
      servers: fvuStatusHtml ? parseFreeVpnUsStatusRows(fvuStatusHtml, byId.freevpnus) : [],
    },
    vpnjantit: {
      live: Boolean(jntHtml || jantitServers.length > 0),
      servers: jantitServers.length > 0 ? jantitServers : fallbacks.vpnjantit,
    },
    hidessh: {
      live: Boolean(hdsHtml),
      servers: fallbacks.hidessh,
    },
    jagovpn: {
      live: Boolean(jgvHtml),
      servers: fallbacks.jagovpn,
    },
    serverssh: {
      live: Boolean(srvHtml),
      servers: fallbacks.serverssh,
    },
    fastssh: {
      live: Boolean(fstHtml),
      servers: fallbacks.fastssh,
    },
    howdy: {
      live: Boolean(hwdHtml),
      servers: fallbacks.howdy,
    },
    racevpn: {
      live: Boolean(rcvEuHtml || rcvAsHtml),
      servers: [
        ...(rcvEuHtml
          ? parseHostListFromHtml(
              rcvEuHtml,
              /[a-z0-9-]+\.connall\.org/gi,
              byId.racevpn,
              'rcv',
              'https://www.racevpn.com/free-openssh-europe-server',
              6,
            )
          : []),
        ...(rcvAsHtml
          ? parseHostListFromHtml(
              rcvAsHtml,
              /[a-z0-9-]+\.connall\.org/gi,
              byId.racevpn,
              'rcva',
              'https://www.racevpn.com/free-openssh-asia-server',
              4,
            )
          : []),
      ],
    },
    cyberssh: {
      live: Boolean(cybStatusHtml),
      servers: cybStatusHtml
        ? parseHostListFromHtml(
            cybStatusHtml,
            /[a-z0-9-]+\.cyberssh\.com/gi,
            byId.cyberssh,
            'cyb',
            'https://cyberssh.com/ssh/index',
            8,
          )
        : [],
    },
    v2nodes: {
      live: Boolean(v2nSaHtml || v2nAeHtml) && v2nServers.length > 0,
      servers: v2nServers,
    },
    openproxylist: {
      live: Boolean(oplRawText),
      servers: oplServers.length > 0 ? oplServers : fallbacks.openproxylist,
    },
    freevmess: {
      live: Boolean(fvmHtml),
      servers: fvmHtml ? parseFreeVmessIps(fvmHtml, byId.freevmess) : [],
    },
    vpngate: {
      live: Boolean(vgCsvText),
      servers: vgCsvText ? parseVpnGateCsvFeed(vgCsvText, byId.vpngate) : [],
    },
    vpnbook: {
      live: Boolean(vbHtml),
      servers: vbHtml
        ? parseHostListFromHtml(
            vbHtml,
            /\b(?!www\.)[a-z0-9-]+\.vpnbook\.com\b/gi,
            byId.vpnbook,
            'vb',
            'https://www.vpnbook.com/freevpn',
            12,
          )
        : [],
    },
    greensshnet: {
      live: Boolean(grnNetHtml),
      servers: fallbacks.greensshnet,
    },
    openvpnssh: {
      live: Boolean(ovpSshHtml),
      servers: fallbacks.openvpnssh,
    },
  };

  const providers: VpnProviderSummary[] = PROVIDERS_CATALOG.map((meta) => {
    const entry = parsedByProvider[meta.providerId];
    const servers = entry && entry.servers.length > 0 ? entry.servers : fallbacks[meta.providerId] || [];
    const seenIds = new Set<string>();
    const dedupedServers = servers.filter((s) => {
      if (seenIds.has(s.serverId)) return false;
      seenIds.add(s.serverId);
      return true;
    });

    return {
      providerId: meta.providerId,
      name: meta.name,
      nameAr: meta.nameAr,
      domain: meta.domain,
      baseUrl: meta.baseUrl,
      resetScheduleAr: meta.resetScheduleAr,
      validityDaysLabelAr: meta.validityDaysLabelAr,
      supportedProtocols: meta.supportedProtocols,
      protocolCreateUrls: meta.protocolCreateUrls,
      descriptionAr: meta.descriptionAr,
      liveStatus: entry?.live ? 'Online' : 'Offline',
      supportsAutoRenew: Boolean(meta.supportsAutoRenew),
      requiresCookies: Boolean(meta.requiresCookies),
      servers: dedupedServers,
    };
  });

  const baseAllServers = providers.flatMap((p) => p.servers);
  catalogCache = {
    timestamp: Date.now(),
    providers,
    allServers: baseAllServers,
  };
  return mergeWithExtraProviders(providers, extraProviders);
}

export function buildGenericProtocolsForServer(server: ServerSummary): ProtocolPortSpec[] {
  const supported = new Set<ProtocolFormatId>(server.supportedProtocols ?? ALL_NINE_PROTOCOLS);
  const host = server.host;
  const slowDnsHost = server.slowDnsHost || `dns.${host}`;
  const providerLabel = server.providerName || 'المزود';

  return [
    {
      id: 'ssh_ws',
      nameAr: 'SSH WebSocket (WS / CDN)',
      nameEn: 'WebSocket',
      ports: '80, 443, 8880, 2052, 2082, 2086, 2095',
      defaultPort: 80,
      notesAr: `منافذ WebSocket (${providerLabel}) + TLS 443 · يدعم UDPGW 7300`,
      status: supported.has('ssh_ws') ? 'UP' : 'DOWN',
    },
    {
      id: 'ssh_ssl',
      nameAr: 'SSH Stunnel (SSL / TLS)',
      nameEn: 'Stunnel',
      ports: '443, 445, 777, 8443',
      defaultPort: 443,
      notesAr: `اتصال SSH مشفر عبر SSL/TLS (${providerLabel}) مع دعم SNI`,
      status: supported.has('ssh_ssl') ? 'UP' : 'DOWN',
    },
    {
      id: 'ssh_dropbear',
      nameAr: 'SSH Dropbear مباشر',
      nameEn: 'Dropbear',
      ports: '143, 109, 442, 444, 5555',
      defaultPort: 143,
      notesAr: `اتصال SSH/Dropbear المباشر (${providerLabel})`,
      status: supported.has('ssh_dropbear') ? 'UP' : 'DOWN',
    },
    {
      id: 'slowdns',
      nameAr: 'SlowDNS (DNSTT)',
      nameEn: 'SlowDNS',
      ports: `53 (${slowDnsHost})`,
      defaultPort: 53,
      notesAr: `مضيف SlowDNS: ${slowDnsHost}`,
      status: supported.has('slowdns') ? server.services.dnstt : 'DOWN',
    },
    {
      id: 'v2ray_vmess',
      nameAr: 'V2Ray VMess (WS + TLS)',
      nameEn: 'V2Ray VMess',
      ports: '443, 80, 8443, 2083',
      defaultPort: 443,
      notesAr: `بروتوكول VMess WS/TLS لخادم ${host}`,
      status: supported.has('v2ray_vmess') ? server.services.v2ray : 'DOWN',
    },
    {
      id: 'v2ray_vless',
      nameAr: 'V2Ray VLESS (WS + TLS)',
      nameEn: 'V2Ray VLESS',
      ports: '443, 80, 8443, 2083',
      defaultPort: 443,
      notesAr: `بروتوكول VLESS WS/TLS الخفيف لخادم ${host}`,
      status: supported.has('v2ray_vless') ? server.services.v2ray : 'DOWN',
    },
    {
      id: 'wireguard',
      nameAr: 'WireGuard VPN',
      nameEn: 'WireGuard',
      ports: '51820',
      defaultPort: 51820,
      notesAr: `ملف إعداد .conf عبر UDP 51820 لخادم ${host}`,
      status: supported.has('wireguard') ? server.services.wireguard : 'DOWN',
    },
    {
      id: 'noobzvpn',
      nameAr: 'NoobzVpn (Plain / SSL)',
      nameEn: 'NoobzVpn',
      ports: '2053, 2083, 8080',
      defaultPort: 2053,
      notesAr: `يدعم TCP Plain (2053) و TCP SSL (2083) على ${providerLabel}`,
      status: supported.has('noobzvpn') ? server.services.noobzvpn : 'DOWN',
    },
    {
      id: 'squid',
      nameAr: 'Squid HTTP Proxy',
      nameEn: 'Squid',
      ports: '8080, 3128, 8000',
      defaultPort: 8080,
      notesAr: `بروكسي Squid القياسي (8080 / 3128) لـ ${providerLabel}`,
      status: supported.has('squid') ? server.services.squid : 'DOWN',
    },
  ];
}

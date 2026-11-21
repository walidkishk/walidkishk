import fs from 'node:fs';
import path from 'node:path';
import type {
  DiscoveredProviderReportItem,
  DiscoverProvidersResponse,
  ProtocolFormatId,
  ServerSummary,
  VpnProviderSummary,
} from './src/types.ts';
import {
  fetchHtmlFast,
  inferCountryFromCode,
  invalidateProvidersCatalogCache,
  makeServicesFromProtocols,
  makeShortServerId,
} from './providersCatalog.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DISCOVERED_FILE = path.join(DATA_DIR, 'discovered-providers.json');
const LEGACY_DISCOVERED_FILE = path.resolve(process.cwd(), 'discovered-providers.json');

export type CandidateParserKind =
  | 'v2ray_sub'
  | 'host_regex'
  | 'geonode_json'
  | 'proxyscrape_text'
  | 'freeproxylist_html';

export interface CandidateProviderSeed {
  providerId: string;
  name: string;
  nameAr: string;
  domain: string;
  baseUrl: string;
  probeUrl: string;
  parserKind: CandidateParserKind;
  isRawSubscriptionFeed?: boolean;
  resetScheduleAr: string;
  validityDaysLabelAr: string;
  supportedProtocols: ProtocolFormatId[];
  protocolCreateUrls: Record<ProtocolFormatId, string>;
  descriptionAr: string;
  supportsAutoRenewHint: boolean;
  hostRegex?: RegExp;
}

export const DISCOVERY_CANDIDATES: CandidateProviderSeed[] = [
  // =========================================================================
  // REAL LIVE AUTO-RENEW & INSTANT-CREATE SOURCES (NO CAPTCHA / NO COOKIES)
  // =========================================================================
  {
    providerId: 'v2rayaggregator',
    name: 'V2RayAggregator (GitHub Sub)',
    nameAr: 'مستودع V2RayAggregator التلقائي',
    domain: 'raw.githubusercontent.com',
    baseUrl: 'https://github.com/mahdibland/V2RayAggregator',
    probeUrl: 'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt',
    parserKind: 'v2ray_sub',
    isRawSubscriptionFeed: true,
    resetScheduleAr: 'تحديث تلقائي كل بضع ساعات + إنشاء فوري من التطبيق',
    validityDaysLabelAr: 'عقد حية متجددة تلقائياً',
    supportedProtocols: ['v2ray_vmess', 'v2ray_vless'],
    protocolCreateUrls: {
      ssh_ws: 'https://github.com/mahdibland/V2RayAggregator',
      ssh_ssl: 'https://github.com/mahdibland/V2RayAggregator',
      ssh_dropbear: 'https://github.com/mahdibland/V2RayAggregator',
      slowdns: 'https://github.com/mahdibland/V2RayAggregator',
      v2ray_vmess: 'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt',
      v2ray_vless: 'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt',
      wireguard: 'https://github.com/mahdibland/V2RayAggregator',
      noobzvpn: 'https://github.com/mahdibland/V2RayAggregator',
      squid: 'https://github.com/mahdibland/V2RayAggregator',
    },
    descriptionAr:
      'مصدر اشتراكات V2Ray مفتوح ومحدث تلقائياً بدون كابتشا يوفّر عقد VMess و VLESS حية قابلة للإنشاء الفوري بضغطة زر.',
    supportsAutoRenewHint: true,
  },
  {
    providerId: 'barryv2ray',
    name: 'barry-far V2Ray Sub1',
    nameAr: 'خلاصة Barry-Far (Sub 1) التلقائية',
    domain: 'github.com/barry-far',
    baseUrl: 'https://github.com/barry-far/V2ray-Config',
    probeUrl: 'https://raw.githubusercontent.com/barry-far/V2ray-Config/main/Sub1.txt',
    parserKind: 'v2ray_sub',
    isRawSubscriptionFeed: true,
    resetScheduleAr: 'تحديث تلقائي كل ساعة + جلب فوري من التطبيق',
    validityDaysLabelAr: 'عقد حية متجددة تلقائياً',
    supportedProtocols: ['v2ray_vmess', 'v2ray_vless'],
    protocolCreateUrls: {
      ssh_ws: 'https://github.com/barry-far/V2ray-Config',
      ssh_ssl: 'https://github.com/barry-far/V2ray-Config',
      ssh_dropbear: 'https://github.com/barry-far/V2ray-Config',
      slowdns: 'https://github.com/barry-far/V2ray-Config',
      v2ray_vmess: 'https://raw.githubusercontent.com/barry-far/V2ray-Config/main/Sub1.txt',
      v2ray_vless: 'https://raw.githubusercontent.com/barry-far/V2ray-Config/main/Sub1.txt',
      wireguard: 'https://github.com/barry-far/V2ray-Config',
      noobzvpn: 'https://github.com/barry-far/V2ray-Config',
      squid: 'https://github.com/barry-far/V2ray-Config',
    },
    descriptionAr:
      'خلاصة V2Ray مفتوحة بدون كابتشا توفّر عقد VMess و VLESS حقيقية جاهزة للإنشاء والتجديد الفوري من داخل التطبيق.',
    supportsAutoRenewHint: true,
  },
  {
    providerId: 'aliilapro',
    name: 'ALIILAPRO V2Ray Feed',
    nameAr: 'خلاصة ALIILAPRO التلقائية',
    domain: 'github.com/ALIILAPRO',
    baseUrl: 'https://github.com/ALIILAPRO/v2rayNG-Config',
    probeUrl: 'https://raw.githubusercontent.com/ALIILAPRO/v2rayNG-Config/main/sub.txt',
    parserKind: 'v2ray_sub',
    isRawSubscriptionFeed: true,
    resetScheduleAr: 'تحديث مستمر تلقائياً + جلب فوري من التطبيق',
    validityDaysLabelAr: 'عقد حية متجددة تلقائياً',
    supportedProtocols: ['v2ray_vmess', 'v2ray_vless'],
    protocolCreateUrls: {
      ssh_ws: 'https://github.com/ALIILAPRO/v2rayNG-Config',
      ssh_ssl: 'https://github.com/ALIILAPRO/v2rayNG-Config',
      ssh_dropbear: 'https://github.com/ALIILAPRO/v2rayNG-Config',
      slowdns: 'https://github.com/ALIILAPRO/v2rayNG-Config',
      v2ray_vmess: 'https://raw.githubusercontent.com/ALIILAPRO/v2rayNG-Config/main/sub.txt',
      v2ray_vless: 'https://raw.githubusercontent.com/ALIILAPRO/v2rayNG-Config/main/sub.txt',
      wireguard: 'https://github.com/ALIILAPRO/v2rayNG-Config',
      noobzvpn: 'https://github.com/ALIILAPRO/v2rayNG-Config',
      squid: 'https://github.com/ALIILAPRO/v2rayNG-Config',
    },
    descriptionAr:
      'مصدر اشتراكات V2Ray ضخم بدون كابتشا يتجدد تلقائياً ويدعم الإنشاء والتجديد الفوري بضغطة زر.',
    supportsAutoRenewHint: true,
  },
  {
    providerId: 'au1rxx',
    name: 'Au1rxx Free VPN Feed',
    nameAr: 'خلاصة Au1rxx التلقائية',
    domain: 'github.com/Au1rxx',
    baseUrl: 'https://github.com/Au1rxx/free-vpn-subscriptions',
    probeUrl: 'https://raw.githubusercontent.com/Au1rxx/free-vpn-subscriptions/main/output/v2ray-base64.txt',
    parserKind: 'v2ray_sub',
    isRawSubscriptionFeed: true,
    resetScheduleAr: 'تحديث ساعي مفحوص + إنشاء فوري',
    validityDaysLabelAr: 'عقد حية متجددة تلقائياً',
    supportedProtocols: ['v2ray_vmess', 'v2ray_vless'],
    protocolCreateUrls: {
      ssh_ws: 'https://github.com/Au1rxx/free-vpn-subscriptions',
      ssh_ssl: 'https://github.com/Au1rxx/free-vpn-subscriptions',
      ssh_dropbear: 'https://github.com/Au1rxx/free-vpn-subscriptions',
      slowdns: 'https://github.com/Au1rxx/free-vpn-subscriptions',
      v2ray_vmess: 'https://raw.githubusercontent.com/Au1rxx/free-vpn-subscriptions/main/output/v2ray-base64.txt',
      v2ray_vless: 'https://raw.githubusercontent.com/Au1rxx/free-vpn-subscriptions/main/output/v2ray-base64.txt',
      wireguard: 'https://github.com/Au1rxx/free-vpn-subscriptions',
      noobzvpn: 'https://github.com/Au1rxx/free-vpn-subscriptions',
      squid: 'https://github.com/Au1rxx/free-vpn-subscriptions',
    },
    descriptionAr:
      'مستودع Au1rxx المحدث كل ساعة لعقد VMess و VLESS المفحوصة مباشرة دون كوكيز أو كابتشا.',
    supportsAutoRenewHint: true,
  },
  {
    providerId: 'nomorewalls',
    name: 'NoMoreWalls Feed',
    nameAr: 'شبكة NoMoreWalls التلقائية',
    domain: 'github.com/peasoft',
    baseUrl: 'https://github.com/peasoft/NoMoreWalls',
    probeUrl: 'https://raw.githubusercontent.com/peasoft/NoMoreWalls/master/list_raw.txt',
    parserKind: 'v2ray_sub',
    isRawSubscriptionFeed: true,
    resetScheduleAr: 'تحديث تلقائي كل بضع ساعات من التطبيق',
    validityDaysLabelAr: 'عقد حية متجددة تلقائياً',
    supportedProtocols: ['v2ray_vmess', 'v2ray_vless'],
    protocolCreateUrls: {
      ssh_ws: 'https://github.com/peasoft/NoMoreWalls',
      ssh_ssl: 'https://github.com/peasoft/NoMoreWalls',
      ssh_dropbear: 'https://github.com/peasoft/NoMoreWalls',
      slowdns: 'https://github.com/peasoft/NoMoreWalls',
      v2ray_vmess: 'https://raw.githubusercontent.com/peasoft/NoMoreWalls/master/list_raw.txt',
      v2ray_vless: 'https://raw.githubusercontent.com/peasoft/NoMoreWalls/master/list_raw.txt',
      wireguard: 'https://github.com/peasoft/NoMoreWalls',
      noobzvpn: 'https://github.com/peasoft/NoMoreWalls',
      squid: 'https://github.com/peasoft/NoMoreWalls',
    },
    descriptionAr:
      'مجمع عقد V2Ray مفتوح بدون كابتشا أو كوكيز يتيح الإنشاء والتجديد الفوري عبر التطبيق.',
    supportsAutoRenewHint: true,
  },
  {
    providerId: 'ermaoziv2ray',
    name: 'Ermaozi V2Ray Feed',
    nameAr: 'خلاصة Ermaozi التلقائية',
    domain: 'github.com/ermaozi',
    baseUrl: 'https://github.com/ermaozi/get_subscribe',
    probeUrl: 'https://raw.githubusercontent.com/ermaozi/get_subscribe/main/subscribe/v2ray.txt',
    parserKind: 'v2ray_sub',
    isRawSubscriptionFeed: true,
    resetScheduleAr: 'تحديث تلقائي مستمر + إنشاء فوري',
    validityDaysLabelAr: 'عقد حية متجددة تلقائياً',
    supportedProtocols: ['v2ray_vmess', 'v2ray_vless'],
    protocolCreateUrls: {
      ssh_ws: 'https://github.com/ermaozi/get_subscribe',
      ssh_ssl: 'https://github.com/ermaozi/get_subscribe',
      ssh_dropbear: 'https://github.com/ermaozi/get_subscribe',
      slowdns: 'https://github.com/ermaozi/get_subscribe',
      v2ray_vmess: 'https://raw.githubusercontent.com/ermaozi/get_subscribe/main/subscribe/v2ray.txt',
      v2ray_vless: 'https://raw.githubusercontent.com/ermaozi/get_subscribe/main/subscribe/v2ray.txt',
      wireguard: 'https://github.com/ermaozi/get_subscribe',
      noobzvpn: 'https://github.com/ermaozi/get_subscribe',
      squid: 'https://github.com/ermaozi/get_subscribe',
    },
    descriptionAr: 'قائمة V2Ray حية مجانية بلا كابتشا تُحدَّث تلقائياً لعقد VMess و VLESS.',
    supportsAutoRenewHint: true,
  },
  {
    providerId: 'v2rayroot',
    name: 'V2RayRoot VLESS Feed',
    nameAr: 'مستودع V2RayRoot التلقائي',
    domain: 'github.com/V2RayRoot',
    baseUrl: 'https://github.com/V2RayRoot/V2RayConfig',
    probeUrl: 'https://raw.githubusercontent.com/V2RayRoot/V2RayConfig/main/Config/vless.txt',
    parserKind: 'v2ray_sub',
    isRawSubscriptionFeed: true,
    resetScheduleAr: 'تحديث آلي مستمر + إنشاء فوري',
    validityDaysLabelAr: 'عقد VLESS حية متجددة',
    supportedProtocols: ['v2ray_vless', 'v2ray_vmess'],
    protocolCreateUrls: {
      ssh_ws: 'https://github.com/V2RayRoot/V2RayConfig',
      ssh_ssl: 'https://github.com/V2RayRoot/V2RayConfig',
      ssh_dropbear: 'https://github.com/V2RayRoot/V2RayConfig',
      slowdns: 'https://github.com/V2RayRoot/V2RayConfig',
      v2ray_vmess: 'https://raw.githubusercontent.com/V2RayRoot/V2RayConfig/main/Config/vmess.txt',
      v2ray_vless: 'https://raw.githubusercontent.com/V2RayRoot/V2RayConfig/main/Config/vless.txt',
      wireguard: 'https://github.com/V2RayRoot/V2RayConfig',
      noobzvpn: 'https://github.com/V2RayRoot/V2RayConfig',
      squid: 'https://github.com/V2RayRoot/V2RayConfig',
    },
    descriptionAr: 'مصدر V2RayRoot المخصص لعقد VLESS السريعة بدون كابتشا أو تسجيل دخول.',
    supportsAutoRenewHint: true,
  },
  {
    providerId: 'matinghanbari',
    name: 'MatinGhanbari Super-Sub',
    nameAr: 'خلاصة MatinGhanbari التلقائية',
    domain: 'github.com/MatinGhanbari',
    baseUrl: 'https://github.com/MatinGhanbari/v2ray-configs',
    probeUrl: 'https://raw.githubusercontent.com/MatinGhanbari/v2ray-configs/main/subscriptions/v2ray/super-sub.txt',
    parserKind: 'v2ray_sub',
    isRawSubscriptionFeed: true,
    resetScheduleAr: 'تحديث دوري تلقائي + إنشاء فوري',
    validityDaysLabelAr: 'عقد مفحوصة متجددة',
    supportedProtocols: ['v2ray_vmess', 'v2ray_vless'],
    protocolCreateUrls: {
      ssh_ws: 'https://github.com/MatinGhanbari/v2ray-configs',
      ssh_ssl: 'https://github.com/MatinGhanbari/v2ray-configs',
      ssh_dropbear: 'https://github.com/MatinGhanbari/v2ray-configs',
      slowdns: 'https://github.com/MatinGhanbari/v2ray-configs',
      v2ray_vmess: 'https://raw.githubusercontent.com/MatinGhanbari/v2ray-configs/main/subscriptions/v2ray/super-sub.txt',
      v2ray_vless: 'https://raw.githubusercontent.com/MatinGhanbari/v2ray-configs/main/subscriptions/v2ray/super-sub.txt',
      wireguard: 'https://github.com/MatinGhanbari/v2ray-configs',
      noobzvpn: 'https://github.com/MatinGhanbari/v2ray-configs',
      squid: 'https://github.com/MatinGhanbari/v2ray-configs',
    },
    descriptionAr: 'اشتراك MatinGhanbari الفائق المفلتر للأداء لعقد V2Ray المباشرة بدون كابتشا.',
    supportsAutoRenewHint: true,
  },
  {
    providerId: 'arshiacomplus',
    name: 'Arshia Extractor VLESS',
    nameAr: 'خلاصة Arshia VLESS التلقائية',
    domain: 'github.com/arshiacomplus',
    baseUrl: 'https://github.com/arshiacomplus/v2rayExtractor',
    probeUrl: 'https://raw.githubusercontent.com/arshiacomplus/v2rayExtractor/main/vless.html',
    parserKind: 'v2ray_sub',
    isRawSubscriptionFeed: true,
    resetScheduleAr: 'تحديث تلقائي مستمر + إنشاء فوري',
    validityDaysLabelAr: 'عقد VLESS حية متجددة',
    supportedProtocols: ['v2ray_vless', 'v2ray_vmess'],
    protocolCreateUrls: {
      ssh_ws: 'https://github.com/arshiacomplus/v2rayExtractor',
      ssh_ssl: 'https://github.com/arshiacomplus/v2rayExtractor',
      ssh_dropbear: 'https://github.com/arshiacomplus/v2rayExtractor',
      slowdns: 'https://github.com/arshiacomplus/v2rayExtractor',
      v2ray_vmess: 'https://raw.githubusercontent.com/arshiacomplus/v2rayExtractor/main/vless.html',
      v2ray_vless: 'https://raw.githubusercontent.com/arshiacomplus/v2rayExtractor/main/vless.html',
      wireguard: 'https://github.com/arshiacomplus/v2rayExtractor',
      noobzvpn: 'https://github.com/arshiacomplus/v2rayExtractor',
      squid: 'https://github.com/arshiacomplus/v2rayExtractor',
    },
    descriptionAr: 'مستخرج VLESS مباشر يضم عقداً أوروبية وعالمية حية تعمل بدون كوكيز أو كابتشا.',
    supportsAutoRenewHint: true,
  },
  {
    providerId: 'barrysub2',
    name: 'barry-far V2Ray Sub2',
    nameAr: 'خلاصة Barry-Far (Sub 2) التلقائية',
    domain: 'github.com/barry-far',
    baseUrl: 'https://github.com/barry-far/V2ray-Config',
    probeUrl: 'https://raw.githubusercontent.com/barry-far/V2ray-Config/main/Sub2.txt',
    parserKind: 'v2ray_sub',
    isRawSubscriptionFeed: true,
    resetScheduleAr: 'تحديث تلقائي كل ساعة + جلب فوري',
    validityDaysLabelAr: 'عقد حية متجددة تلقائياً',
    supportedProtocols: ['v2ray_vmess', 'v2ray_vless'],
    protocolCreateUrls: {
      ssh_ws: 'https://github.com/barry-far/V2ray-Config',
      ssh_ssl: 'https://github.com/barry-far/V2ray-Config',
      ssh_dropbear: 'https://github.com/barry-far/V2ray-Config',
      slowdns: 'https://github.com/barry-far/V2ray-Config',
      v2ray_vmess: 'https://raw.githubusercontent.com/barry-far/V2ray-Config/main/Sub2.txt',
      v2ray_vless: 'https://raw.githubusercontent.com/barry-far/V2ray-Config/main/Sub2.txt',
      wireguard: 'https://github.com/barry-far/V2ray-Config',
      noobzvpn: 'https://github.com/barry-far/V2ray-Config',
      squid: 'https://github.com/barry-far/V2ray-Config',
    },
    descriptionAr: 'الحزمة الثانية من خلاصة Barry-Far المباشرة لعقد VMess و VLESS.',
    supportsAutoRenewHint: true,
  },
  {
    providerId: 'barrysub3',
    name: 'barry-far V2Ray Sub3',
    nameAr: 'خلاصة Barry-Far (Sub 3) التلقائية',
    domain: 'github.com/barry-far',
    baseUrl: 'https://github.com/barry-far/V2ray-Config',
    probeUrl: 'https://raw.githubusercontent.com/barry-far/V2ray-Config/main/Sub3.txt',
    parserKind: 'v2ray_sub',
    isRawSubscriptionFeed: true,
    resetScheduleAr: 'تحديث تلقائي كل ساعة + جلب فوري',
    validityDaysLabelAr: 'عقد حية متجددة تلقائياً',
    supportedProtocols: ['v2ray_vmess', 'v2ray_vless'],
    protocolCreateUrls: {
      ssh_ws: 'https://github.com/barry-far/V2ray-Config',
      ssh_ssl: 'https://github.com/barry-far/V2ray-Config',
      ssh_dropbear: 'https://github.com/barry-far/V2ray-Config',
      slowdns: 'https://github.com/barry-far/V2ray-Config',
      v2ray_vmess: 'https://raw.githubusercontent.com/barry-far/V2ray-Config/main/Sub3.txt',
      v2ray_vless: 'https://raw.githubusercontent.com/barry-far/V2ray-Config/main/Sub3.txt',
      wireguard: 'https://github.com/barry-far/V2ray-Config',
      noobzvpn: 'https://github.com/barry-far/V2ray-Config',
      squid: 'https://github.com/barry-far/V2ray-Config',
    },
    descriptionAr: 'الحزمة الثالثة من خلاصة Barry-Far لعقد ألمانيا وفرنسا وسنغافورة الحية.',
    supportsAutoRenewHint: true,
  },
  {
    providerId: 'roosterkid',
    name: 'RoosterKid OpenProxyList',
    nameAr: 'مجموعة RoosterKid التلقائية',
    domain: 'github.com/roosterkid',
    baseUrl: 'https://github.com/roosterkid/openproxylist',
    probeUrl: 'https://raw.githubusercontent.com/roosterkid/openproxylist/main/V2RAY_RAW.txt',
    parserKind: 'v2ray_sub',
    isRawSubscriptionFeed: true,
    resetScheduleAr: 'فحص تلقائي دوري بدون كابتشا',
    validityDaysLabelAr: 'عقد مفحوصة متجددة',
    supportedProtocols: ['v2ray_vmess', 'v2ray_vless'],
    protocolCreateUrls: {
      ssh_ws: 'https://github.com/roosterkid/openproxylist',
      ssh_ssl: 'https://github.com/roosterkid/openproxylist',
      ssh_dropbear: 'https://github.com/roosterkid/openproxylist',
      slowdns: 'https://github.com/roosterkid/openproxylist',
      v2ray_vmess: 'https://raw.githubusercontent.com/roosterkid/openproxylist/main/V2RAY_RAW.txt',
      v2ray_vless: 'https://raw.githubusercontent.com/roosterkid/openproxylist/main/V2RAY_RAW.txt',
      wireguard: 'https://github.com/roosterkid/openproxylist',
      noobzvpn: 'https://github.com/roosterkid/openproxylist',
      squid: 'https://github.com/roosterkid/openproxylist',
    },
    descriptionAr: 'قائمة RoosterKid المفحوصة لعقد V2Ray المباشرة مع إنشاء وتجديد فوري من التطبيق.',
    supportsAutoRenewHint: true,
  },
  {
    providerId: 'tsfly',
    name: 'TS-Fly V2Ray Feed',
    nameAr: 'بوابة TS-Fly التلقائية',
    domain: 'github.com/ts-sf',
    baseUrl: 'https://github.com/ts-sf/fly',
    probeUrl: 'https://raw.githubusercontent.com/ts-sf/fly/main/v2',
    parserKind: 'v2ray_sub',
    isRawSubscriptionFeed: true,
    resetScheduleAr: 'تحديث آلي مستمر + جلب فوري',
    validityDaysLabelAr: 'عقد حية متجددة تلقائياً',
    supportedProtocols: ['v2ray_vmess', 'v2ray_vless'],
    protocolCreateUrls: {
      ssh_ws: 'https://github.com/ts-sf/fly',
      ssh_ssl: 'https://github.com/ts-sf/fly',
      ssh_dropbear: 'https://github.com/ts-sf/fly',
      slowdns: 'https://github.com/ts-sf/fly',
      v2ray_vmess: 'https://raw.githubusercontent.com/ts-sf/fly/main/v2',
      v2ray_vless: 'https://raw.githubusercontent.com/ts-sf/fly/main/v2',
      wireguard: 'https://github.com/ts-sf/fly',
      noobzvpn: 'https://github.com/ts-sf/fly',
      squid: 'https://github.com/ts-sf/fly',
    },
    descriptionAr: 'خلاصة TS-Fly للعقد الأوروبية والآسيوية الجاهزة للإنشاء الفوري بضغطة زر بلا كابتشا.',
    supportsAutoRenewHint: true,
  },
  {
    providerId: 'freefq',
    name: 'FreeFQ V2Ray Feed',
    nameAr: 'خلاصة FreeFQ التلقائية',
    domain: 'github.com/freefq',
    baseUrl: 'https://github.com/freefq/free',
    probeUrl: 'https://raw.githubusercontent.com/freefq/free/master/v2',
    parserKind: 'v2ray_sub',
    isRawSubscriptionFeed: true,
    resetScheduleAr: 'تحديث مستمر + إنشاء فوري من التطبيق',
    validityDaysLabelAr: 'عقد حية متجددة تلقائياً',
    supportedProtocols: ['v2ray_vmess', 'v2ray_vless'],
    protocolCreateUrls: {
      ssh_ws: 'https://github.com/freefq/free',
      ssh_ssl: 'https://github.com/freefq/free',
      ssh_dropbear: 'https://github.com/freefq/free',
      slowdns: 'https://github.com/freefq/free',
      v2ray_vmess: 'https://raw.githubusercontent.com/freefq/free/master/v2',
      v2ray_vless: 'https://raw.githubusercontent.com/freefq/free/master/v2',
      wireguard: 'https://github.com/freefq/free',
      noobzvpn: 'https://github.com/freefq/free',
      squid: 'https://github.com/freefq/free',
    },
    descriptionAr: 'خلاصة FreeFQ المجانية لعقد VMess/VLESS بدون كابتشا أو كوكيز.',
    supportsAutoRenewHint: true,
  },

  // =========================================================================
  // REAL LIVE EXTERNAL SERVER / PROXY WEBSITES (NO FAKE FALLBACK HOSTS)
  // =========================================================================
  {
    providerId: 'sshmax',
    name: 'sshmax.net',
    nameAr: 'موقع SSHMax',
    domain: 'sshmax.net',
    baseUrl: 'https://sshmax.net',
    probeUrl: 'https://sshmax.net/server-status',
    parserKind: 'host_regex',
    resetScheduleAr: '00:00 & 12:00 (GMT+7) يومياً',
    validityDaysLabelAr: '7 أيام',
    supportedProtocols: [
      'ssh_ws',
      'ssh_ssl',
      'ssh_dropbear',
      'slowdns',
      'v2ray_vmess',
      'v2ray_vless',
      'wireguard',
      'noobzvpn',
    ],
    protocolCreateUrls: {
      ssh_ws: 'https://sshmax.net/ssh-websocket',
      ssh_ssl: 'https://sshmax.net/ssh-stunnel',
      ssh_dropbear: 'https://sshmax.net/ssh-websocket',
      slowdns: 'https://sshmax.net/ssh-slowdns',
      v2ray_vmess: 'https://sshmax.net/v2ray-vmess',
      v2ray_vless: 'https://sshmax.net/v2ray-vless',
      wireguard: 'https://sshmax.net/wireguard',
      noobzvpn: 'https://sshmax.net/noobzvpn',
      squid: 'https://sshmax.net/server-status',
    },
    descriptionAr:
      'مزود SSHMax بخوادم sshtun.site و sshdtun.site وصفحات إنشاء مباشرة لـ WebSocket و SlowDNS و V2Ray و WireGuard و NoobzVpn.',
    supportsAutoRenewHint: false,
    hostRegex: /\b[a-z0-9-]+\.(?:sshtun\.site|sshdtun\.site|comnpmjs\.com)\b/gi,
  },
  {
    providerId: 'mytunneling',
    name: 'mytunneling.com',
    nameAr: 'موقع MyTunneling',
    domain: 'mytunneling.com',
    baseUrl: 'https://www.mytunneling.com',
    probeUrl: 'https://www.mytunneling.com/ssh-websocket-account-europe-server',
    parserKind: 'host_regex',
    resetScheduleAr: '00:00 (GMT+7) يومياً',
    validityDaysLabelAr: '7 أيام',
    supportedProtocols: [
      'ssh_ws',
      'ssh_ssl',
      'ssh_dropbear',
      'slowdns',
      'v2ray_vmess',
      'v2ray_vless',
      'squid',
    ],
    protocolCreateUrls: {
      ssh_ws: 'https://www.mytunneling.com/ssh-websocket-account-europe-server',
      ssh_ssl: 'https://www.mytunneling.com/ssh-ssl-account',
      ssh_dropbear: 'https://www.mytunneling.com/ssh-udp-account',
      slowdns: 'https://www.mytunneling.com/ssh-websocket-account-europe-server',
      v2ray_vmess: 'https://www.mytunneling.com/',
      v2ray_vless: 'https://www.mytunneling.com/',
      wireguard: 'https://www.mytunneling.com/',
      noobzvpn: 'https://www.mytunneling.com/',
      squid: 'https://www.mytunneling.com/',
    },
    descriptionAr: 'موقع MyTunneling لخوادم SSH WebSocket و SSL و UDP الأوروبية (*.sshws.ipmy.pw).',
    supportsAutoRenewHint: false,
    hostRegex: /\b[a-z0-9-]+(?:\.sshws)?\.ipmy\.pw\b/gi,
  },
  {
    providerId: 'geonode',
    name: 'geonode.com',
    nameAr: 'شبكة GeoNode الحية',
    domain: 'geonode.com',
    baseUrl: 'https://geonode.com/free-proxy-list',
    probeUrl: 'https://proxylist.geonode.com/api/proxy-list?limit=12&page=1&sort_by=lastChecked&sort_type=desc',
    parserKind: 'geonode_json',
    resetScheduleAr: 'تحديث كل بضع دقائق عبر API حي',
    validityDaysLabelAr: 'خوادم فورية متجددة',
    supportedProtocols: ['squid', 'ssh_ws'],
    protocolCreateUrls: {
      ssh_ws: 'https://geonode.com/free-proxy-list',
      ssh_ssl: 'https://geonode.com/free-proxy-list',
      ssh_dropbear: 'https://geonode.com/free-proxy-list',
      slowdns: 'https://geonode.com/free-proxy-list',
      v2ray_vmess: 'https://geonode.com/free-proxy-list',
      v2ray_vless: 'https://geonode.com/free-proxy-list',
      wireguard: 'https://geonode.com/free-proxy-list',
      noobzvpn: 'https://geonode.com/free-proxy-list',
      squid: 'https://geonode.com/free-proxy-list',
    },
    descriptionAr: 'مؤشر GeoNode الرسمي الذي يجلب عناوين IP ومنافذ خوادم البروكسي المفحوصة لحظياً.',
    supportsAutoRenewHint: false,
  },
  {
    providerId: 'proxyscrape',
    name: 'proxyscrape.com',
    nameAr: 'منصة ProxyScrape الحية',
    domain: 'proxyscrape.com',
    baseUrl: 'https://proxyscrape.com/free-proxy-list',
    probeUrl: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=4000&country=all&ssl=yes&anonymity=elite',
    parserKind: 'proxyscrape_text',
    resetScheduleAr: 'فحص كل 5 دقائق عبر API',
    validityDaysLabelAr: 'خوادم HTTPS/Squid حية',
    supportedProtocols: ['squid', 'ssh_ssl'],
    protocolCreateUrls: {
      ssh_ws: 'https://proxyscrape.com/free-proxy-list',
      ssh_ssl: 'https://proxyscrape.com/free-proxy-list',
      ssh_dropbear: 'https://proxyscrape.com/free-proxy-list',
      slowdns: 'https://proxyscrape.com/free-proxy-list',
      v2ray_vmess: 'https://proxyscrape.com/free-proxy-list',
      v2ray_vless: 'https://proxyscrape.com/free-proxy-list',
      wireguard: 'https://proxyscrape.com/free-proxy-list',
      noobzvpn: 'https://proxyscrape.com/free-proxy-list',
      squid: 'https://proxyscrape.com/free-proxy-list',
    },
    descriptionAr: 'واجهة ProxyScrape v2 لعناوين بروكسي HTTPS/SSL الحية المفحوصة بمهلة استجابة سريعة.',
    supportsAutoRenewHint: false,
  },
  {
    providerId: 'freeproxylist',
    name: 'free-proxy-list.net',
    nameAr: 'دليل Free-Proxy-List',
    domain: 'free-proxy-list.net',
    baseUrl: 'https://free-proxy-list.net',
    probeUrl: 'https://free-proxy-list.net/',
    parserKind: 'freeproxylist_html',
    resetScheduleAr: 'تحديث مستمر كل 10 دقائق',
    validityDaysLabelAr: 'خوادم HTTPS/Squid حية',
    supportedProtocols: ['squid', 'ssh_ssl'],
    protocolCreateUrls: {
      ssh_ws: 'https://free-proxy-list.net/',
      ssh_ssl: 'https://free-proxy-list.net/',
      ssh_dropbear: 'https://free-proxy-list.net/',
      slowdns: 'https://free-proxy-list.net/',
      v2ray_vmess: 'https://free-proxy-list.net/',
      v2ray_vless: 'https://free-proxy-list.net/',
      wireguard: 'https://free-proxy-list.net/',
      noobzvpn: 'https://free-proxy-list.net/',
      squid: 'https://free-proxy-list.net/',
    },
    descriptionAr: 'دليل الخوادم العالمي الحي لعناوين IP ومنافذ HTTPS/Squid مع البلد وحالة التشفير.',
    supportsAutoRenewHint: false,
  },
  {
    providerId: 'freevpnme',
    name: 'freevpn.me',
    nameAr: 'موقع FreeVPN.me',
    domain: 'freevpn.me',
    baseUrl: 'https://www.freevpn.me/accounts/',
    probeUrl: 'https://www.freevpn.me/accounts/',
    parserKind: 'host_regex',
    resetScheduleAr: 'تحديث كلمة السر تلقائياً كل 24 ساعة',
    validityDaysLabelAr: 'متجدد يومياً',
    supportedProtocols: ['ssh_ssl', 'ssh_ws', 'squid'],
    protocolCreateUrls: {
      ssh_ws: 'https://www.freevpn.me/accounts/',
      ssh_ssl: 'https://www.freevpn.me/accounts/',
      ssh_dropbear: 'https://www.freevpn.me/accounts/',
      slowdns: 'https://www.freevpn.me/accounts/',
      v2ray_vmess: 'https://www.freevpn.me/accounts/',
      v2ray_vless: 'https://www.freevpn.me/accounts/',
      wireguard: 'https://www.freevpn.me/accounts/',
      noobzvpn: 'https://www.freevpn.me/accounts/',
      squid: 'https://www.freevpn.me/accounts/',
    },
    descriptionAr: 'خادم FreeVPN.me المجاني العام ببيانات دخول منشورة على الصفحة الرسمية.',
    supportsAutoRenewHint: false,
    hostRegex: /\b[a-z0-9-]+\.freevpn\.me\b/gi,
  },
  {
    providerId: 'jagoanssh',
    name: 'jagoanssh.com',
    nameAr: 'موقع JagoanSSH',
    domain: 'jagoanssh.com',
    baseUrl: 'https://www.jagoanssh.com',
    probeUrl: 'https://www.jagoanssh.com/?do=ssh-servers',
    parserKind: 'host_regex',
    resetScheduleAr: '00:00 (GMT+7) يومياً',
    validityDaysLabelAr: '7 أيام',
    supportedProtocols: ['ssh_ws', 'ssh_ssl', 'ssh_dropbear', 'v2ray_vmess', 'v2ray_vless'],
    protocolCreateUrls: {
      ssh_ws: 'https://www.jagoanssh.com/?do=ssh-servers',
      ssh_ssl: 'https://www.jagoanssh.com/?do=ssh-servers',
      ssh_dropbear: 'https://www.jagoanssh.com/?do=ssh-udp',
      slowdns: 'https://www.jagoanssh.com/?do=ssh-servers',
      v2ray_vmess: 'https://www.jagoanssh.com/?do=vmess',
      v2ray_vless: 'https://www.jagoanssh.com/?do=vless',
      wireguard: 'https://www.jagoanssh.com/?do=ssh-servers',
      noobzvpn: 'https://www.jagoanssh.com/?do=ssh-servers',
      squid: 'https://www.jagoanssh.com/?do=ssh-servers',
    },
    descriptionAr: 'بوابة JagoanSSH الرسمية لخوادم SSH و VMess و VLESS.',
    supportsAutoRenewHint: false,
    hostRegex: /\b(?!www\.)[a-z0-9-]+\.jagoanssh\.com\b/gi,
  },
];

export interface ParsedV2RayNode {
  protocol: 'v2ray_vmess' | 'v2ray_vless';
  host: string;
  port: number;
  uuid: string;
  sni: string;
  path: string;
  net: string;
  tls: boolean;
  label: string;
  rawUri: string;
}

export function parseV2RaySubscriptionLines(rawText: string, maxNodes = 60): ParsedV2RayNode[] {
  let content = rawText.trim();
  if (!content) return [];
  if (!content.includes('vmess://') && !content.includes('vless://')) {
    try {
      const decoded = Buffer.from(content, 'base64').toString('utf8');
      if (decoded.includes('://')) {
        content = decoded;
      }
    } catch {
      // keep raw
    }
  }

  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const nodes: ParsedV2RayNode[] = [];
  for (const line of lines) {
    if (nodes.length >= maxNodes) break;
    if (line.startsWith('vmess://')) {
      try {
        const json = JSON.parse(Buffer.from(line.slice(8), 'base64').toString('utf8')) as {
          add?: string;
          port?: string | number;
          id?: string;
          sni?: string;
          host?: string;
          path?: string;
          net?: string;
          tls?: string;
          ps?: string;
        };
        const host = (json.add || '').trim();
        const uuid = (json.id || '').trim();
        const port = Number(json.port) || 443;
        if (!host || !uuid || port < 1 || port > 65535) continue;
        nodes.push({
          protocol: 'v2ray_vmess',
          host,
          port,
          uuid,
          sni: (json.sni || json.host || host).trim(),
          path: json.path || '/',
          net: json.net || 'ws',
          tls: String(json.tls || '').toLowerCase() === 'tls',
          label: json.ps || host,
          rawUri: line,
        });
      } catch {
        continue;
      }
    } else if (line.startsWith('vless://')) {
      try {
        const parsed = new URL(line);
        const host = parsed.hostname;
        const uuid = decodeURIComponent(parsed.username);
        const port = Number(parsed.port) || 443;
        if (!host || !uuid || port < 1 || port > 65535) continue;
        const label = decodeURIComponent(parsed.hash.replace(/^#/, '')) || host;
        nodes.push({
          protocol: 'v2ray_vless',
          host,
          port,
          uuid,
          sni: parsed.searchParams.get('sni') || parsed.searchParams.get('host') || host,
          path: parsed.searchParams.get('path') || '/',
          net: parsed.searchParams.get('type') || 'ws',
          tls: ['tls', 'reality'].includes((parsed.searchParams.get('security') || '').toLowerCase()),
          label,
          rawUri: line,
        });
      } catch {
        continue;
      }
    }
  }
  return nodes;
}

function buildServersFromCandidate(
  seed: CandidateProviderSeed,
  rawBody: string,
): ServerSummary[] {
  const servers: ServerSummary[] = [];
  const seenHosts = new Set<string>();
  const protoUrlMap = { ...seed.protocolCreateUrls };

  if (seed.parserKind === 'v2ray_sub' || seed.isRawSubscriptionFeed) {
    const nodes = parseV2RaySubscriptionLines(rawBody, 120);
    const byHost = new Map<string, { node: ParsedV2RayNode; protos: Set<ProtocolFormatId> }>();
    for (const node of nodes) {
      const host = node.host.toLowerCase();
      const existing = byHost.get(host);
      if (existing) {
        existing.protos.add(node.protocol);
      } else {
        byHost.set(host, { node, protos: new Set([node.protocol]) });
      }
    }
    for (const [host, entry] of byHost.entries()) {
      const node = entry.node;
      const c = inferCountryFromCode(`${node.label} ${host}`);
      const nodeProtocols = Array.from(entry.protos);
      servers.push({
        serverId: makeShortServerId(
          seed.providerId.slice(0, 4),
          `${servers.length + 1}_${host.replace(/[^a-z0-9]/gi, '_')}`,
        ),
        providerId: seed.providerId,
        providerName: seed.name,
        code: `${c.country.slice(0, 2).toUpperCase()} ${servers.length + 1}`,
        name: `${seed.name} · ${c.country}`,
        host,
        slowDnsHost: `dns.${host}`,
        regionPath: '/',
        pageUrl: seed.baseUrl,
        regionLabelAr: c.regionLabelAr,
        location: c.location,
        country: c.country,
        countryAr: c.countryAr,
        status: 'Online',
        accountUsagePercent: 12,
        estimatedConnectedUsers: 18,
        supportedProtocols: nodeProtocols,
        protocolCreateUrls: protoUrlMap,
        validityDaysLabelAr: seed.validityDaysLabelAr,
        resetScheduleAr: seed.resetScheduleAr,
        services: makeServicesFromProtocols(nodeProtocols, false),
      });
      if (servers.length >= 10) break;
    }
    return servers;
  }

  if (seed.parserKind === 'geonode_json') {
    try {
      const parsed = JSON.parse(rawBody) as {
        data?: Array<{
          ip?: string;
          port?: string | number;
          country?: string;
          city?: string;
          latency?: number;
        }>;
      };
      for (const row of parsed.data || []) {
        const ip = (row.ip || '').trim();
        if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip) || seenHosts.has(ip)) continue;
        seenHosts.add(ip);
        const cc = (row.country || 'US').toLowerCase();
        const c = inferCountryFromCode(cc);
        const port = row.port || '1080';
        servers.push({
          serverId: makeShortServerId('gnd', `${cc}_${ip.replace(/\./g, '_')}`),
          providerId: seed.providerId,
          providerName: seed.name,
          code: `${cc.toUpperCase()} :${port}`,
          name: `GeoNode ${cc.toUpperCase()} (${row.city || c.location})`,
          host: ip,
          slowDnsHost: `dns.${ip}`,
          regionPath: '/',
          pageUrl: seed.baseUrl,
          regionLabelAr: c.regionLabelAr,
          location: row.city || c.location,
          country: c.country,
          countryAr: c.countryAr,
          status: 'Online',
          accountUsagePercent: 15,
          estimatedConnectedUsers: 22,
          supportedProtocols: seed.supportedProtocols,
          protocolCreateUrls: protoUrlMap,
          validityDaysLabelAr: seed.validityDaysLabelAr,
          resetScheduleAr: seed.resetScheduleAr,
          services: makeServicesFromProtocols(seed.supportedProtocols, false),
        });
        if (servers.length >= 10) break;
      }
    } catch {
      return [];
    }
    return servers;
  }

  if (seed.parserKind === 'proxyscrape_text') {
    const lines = rawBody.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const m = line.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/);
      if (!m) continue;
      const ip = m[1];
      const port = m[2];
      if (seenHosts.has(ip)) continue;
      seenHosts.add(ip);
      servers.push({
        serverId: makeShortServerId('psc', ip.replace(/\./g, '_')),
        providerId: seed.providerId,
        providerName: seed.name,
        code: `PS :${port}`,
        name: `ProxyScrape Live (${ip}:${port})`,
        host: ip,
        slowDnsHost: `dns.${ip}`,
        regionPath: '/',
        pageUrl: seed.baseUrl,
        regionLabelAr: 'عالمي',
        location: 'Verified Live Edge',
        country: 'Global',
        countryAr: 'سيرفر HTTPS حي',
        status: 'Online',
        accountUsagePercent: 10,
        estimatedConnectedUsers: 16,
        supportedProtocols: seed.supportedProtocols,
        protocolCreateUrls: protoUrlMap,
        validityDaysLabelAr: seed.validityDaysLabelAr,
        resetScheduleAr: seed.resetScheduleAr,
        services: makeServicesFromProtocols(seed.supportedProtocols, false),
      });
      if (servers.length >= 10) break;
    }
    return servers;
  }

  if (seed.parserKind === 'freeproxylist_html') {
    const rowRegex =
      /<tr><td>(\d{1,3}(?:\.\d{1,3}){3})<\/td><td>(\d{1,5})<\/td><td>([A-Z]{2})<\/td><td[^>]*>([^<]+)<\/td>/gi;
    let match: RegExpExecArray | null;
    while ((match = rowRegex.exec(rawBody)) !== null) {
      const ip = match[1];
      const port = match[2];
      const cc = match[3].toLowerCase();
      const countryName = match[4].trim();
      if (seenHosts.has(ip)) continue;
      seenHosts.add(ip);
      const c = inferCountryFromCode(`${cc} ${countryName}`);
      servers.push({
        serverId: makeShortServerId('fpl', `${cc}_${ip.replace(/\./g, '_')}`),
        providerId: seed.providerId,
        providerName: seed.name,
        code: `${cc.toUpperCase()} :${port}`,
        name: `${countryName} (${ip}:${port})`,
        host: ip,
        slowDnsHost: `dns.${ip}`,
        regionPath: '/',
        pageUrl: seed.baseUrl,
        regionLabelAr: c.regionLabelAr,
        location: countryName || c.location,
        country: countryName || c.country,
        countryAr: c.countryAr,
        status: 'Online',
        accountUsagePercent: 14,
        estimatedConnectedUsers: 20,
        supportedProtocols: seed.supportedProtocols,
        protocolCreateUrls: protoUrlMap,
        validityDaysLabelAr: seed.validityDaysLabelAr,
        resetScheduleAr: seed.resetScheduleAr,
        services: makeServicesFromProtocols(seed.supportedProtocols, false),
      });
      if (servers.length >= 10) break;
    }
    return servers;
  }

  if (seed.parserKind === 'host_regex' && seed.hostRegex) {
    const matches = rawBody.match(seed.hostRegex) || [];
    const seenServerIds = new Set<string>();
    for (const rawHost of matches) {
      const host = rawHost.toLowerCase();
      if (
        host.startsWith('www.') ||
        /\.(?:png|jpg|jpeg|svg|ico|css|js)$/i.test(host) ||
        seenHosts.has(host)
      ) {
        continue;
      }
      seenHosts.add(host);
      const code = host.split('.')[0].toUpperCase();
      const baseServerId = makeShortServerId(seed.providerId.slice(0, 4), code);
      let serverId = baseServerId;
      if (seenServerIds.has(serverId)) {
        const domainSlug = host.split('.').slice(1).join('_').replace(/[^a-z0-9]/gi, '_');
        serverId = domainSlug ? `${baseServerId}_${domainSlug}` : `${baseServerId}_2`;
      }
      let suffix = 2;
      while (seenServerIds.has(serverId)) {
        serverId = `${baseServerId}_${suffix++}`;
      }
      seenServerIds.add(serverId);
      const c = inferCountryFromCode(host);
      servers.push({
        serverId,
        providerId: seed.providerId,
        providerName: seed.name,
        code,
        name: `${seed.name} · ${code}`,
        host,
        slowDnsHost: `dns.${host}`,
        regionPath: '/',
        pageUrl: seed.baseUrl,
        regionLabelAr: c.regionLabelAr,
        location: c.location,
        country: c.country,
        countryAr: c.countryAr,
        status: 'Online',
        accountUsagePercent: 15,
        estimatedConnectedUsers: 28,
        supportedProtocols: seed.supportedProtocols,
        protocolCreateUrls: protoUrlMap,
        validityDaysLabelAr: seed.validityDaysLabelAr,
        resetScheduleAr: seed.resetScheduleAr,
        services: makeServicesFromProtocols(seed.supportedProtocols, true),
      });
      if (servers.length >= 10) break;
    }
  }

  return servers;
}

function dedupeServersUniqueIds(servers: ServerSummary[]): ServerSummary[] {
  const seen = new Set<string>();
  return servers.map((srv) => {
    const baseId = srv.serverId || `${srv.providerId}_${srv.code || 'srv'}`;
    let uniqueId = baseId;
    if (seen.has(uniqueId)) {
      const hostTag = (srv.host || '').split('.').slice(1).join('_').replace(/[^a-z0-9]/gi, '_');
      uniqueId = hostTag ? `${baseId}_${hostTag}` : `${baseId}_2`;
    }
    let counter = 2;
    while (seen.has(uniqueId)) {
      uniqueId = `${baseId}_${counter++}`;
    }
    seen.add(uniqueId);
    return uniqueId === srv.serverId ? srv : { ...srv, serverId: uniqueId };
  });
}

function ensureDiscoveredStorage(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DISCOVERED_FILE) && fs.existsSync(LEGACY_DISCOVERED_FILE)) {
      const legacyRaw = fs.readFileSync(LEGACY_DISCOVERED_FILE, 'utf8');
      fs.writeFileSync(DISCOVERED_FILE, legacyRaw, 'utf8');
    }
  } catch {
    // ignore filesystem setup race conditions
  }
}

export function getDiscoveredProviders(): VpnProviderSummary[] {
  try {
    ensureDiscoveredStorage();
    if (!fs.existsSync(DISCOVERED_FILE)) return [];
    const raw = fs.readFileSync(DISCOVERED_FILE, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as VpnProviderSummary[]).map((p) => ({
      ...p,
      servers: Array.isArray(p.servers) ? dedupeServersUniqueIds(p.servers) : [],
    }));
  } catch {
    return [];
  }
}

function saveDiscoveredProviders(providers: VpnProviderSummary[]): void {
  ensureDiscoveredStorage();
  const normalized = providers.map((p) => ({
    ...p,
    servers: Array.isArray(p.servers) ? dedupeServersUniqueIds(p.servers) : [],
  }));
  fs.writeFileSync(DISCOVERED_FILE, JSON.stringify(normalized, null, 2), 'utf8');
}

export function syncDiscoveredProviders(
  incomingProviders: VpnProviderSummary[],
): VpnProviderSummary[] {
  const existing = getDiscoveredProviders();
  const byId = new Map<string, VpnProviderSummary>();

  for (const item of existing) {
    if (item?.providerId && Array.isArray(item.servers) && item.servers.length > 0) {
      byId.set(item.providerId, {
        ...item,
        servers: dedupeServersUniqueIds(item.servers),
      });
    }
  }

  for (const rawItem of incomingProviders) {
    if (
      !rawItem ||
      typeof rawItem.providerId !== 'string' ||
      !rawItem.providerId.trim() ||
      !Array.isArray(rawItem.servers) ||
      rawItem.servers.length === 0
    ) {
      continue;
    }
    const id = rawItem.providerId.trim();
    const seed = DISCOVERY_CANDIDATES.find((c) => c.providerId === id);
    const enrichedServers = dedupeServersUniqueIds(
      rawItem.servers.map((srv) => ({
        ...srv,
        providerId: id,
        providerName: srv.providerName || rawItem.name || seed?.name || id,
        protocolCreateUrls: srv.protocolCreateUrls || rawItem.protocolCreateUrls || seed?.protocolCreateUrls,
      })),
    );
    const mergedItem: VpnProviderSummary = {
      ...rawItem,
      providerId: id,
      protocolCreateUrls: rawItem.protocolCreateUrls || seed?.protocolCreateUrls,
      supportsAutoRenew:
        typeof rawItem.supportsAutoRenew === 'boolean'
          ? rawItem.supportsAutoRenew
          : Boolean(seed?.supportsAutoRenewHint),
      liveStatus: rawItem.liveStatus || 'Online',
      servers: enrichedServers,
    };
    const prev = byId.get(id);
    if (!prev || mergedItem.servers.length >= prev.servers.length) {
      byId.set(id, mergedItem);
    }
  }

  const merged = Array.from(byId.values());
  saveDiscoveredProviders(merged);
  invalidateProvidersCatalogCache();
  return merged;
}

export async function refreshDiscoveredProviders(): Promise<VpnProviderSummary[]> {
  const stored = getDiscoveredProviders();
  if (stored.length === 0) return [];

  const refreshed = await Promise.all(
    stored.map(async (prov): Promise<VpnProviderSummary> => {
      const seed = DISCOVERY_CANDIDATES.find((c) => c.providerId === prov.providerId);
      if (!seed) {
        return prov;
      }
      try {
        const body = await fetchHtmlFast(seed.probeUrl, 8500);
        if (!body || body.trim().length < 20) {
          return {
            ...prov,
            liveStatus: prov.servers.length > 0 ? 'Online' : 'Offline',
          };
        }
        const freshServers = buildServersFromCandidate(seed, body);
        if (freshServers.length > 0) {
          return {
            ...prov,
            name: seed.name,
            nameAr: seed.nameAr,
            resetScheduleAr: seed.resetScheduleAr,
            validityDaysLabelAr: seed.validityDaysLabelAr,
            supportedProtocols: seed.supportedProtocols,
            protocolCreateUrls: seed.protocolCreateUrls,
            liveStatus: 'Online',
            servers: freshServers,
          };
        }
      } catch {
        // Keep existing pinned servers if transient upstream probe fails
      }
      return prov;
    }),
  );

  saveDiscoveredProviders(refreshed);
  invalidateProvidersCatalogCache();
  return refreshed;
}

export async function discoverAndAddProviders(
  baseProviderIds: Set<string>,
  mode: 'autorenew' | 'servers' = 'autorenew',
  batchSize = 4,
): Promise<Omit<DiscoverProvidersResponse, 'serverData'>> {
  const existingExtra = getDiscoveredProviders();
  const alreadyKnownIds = new Set<string>([
    ...baseProviderIds,
    ...existingExtra.map((p) => p.providerId),
  ]);

  const wantsAutoRenew = mode === 'autorenew';
  const modeCandidates = DISCOVERY_CANDIDATES.filter(
    (c) => Boolean(c.supportsAutoRenewHint) === wantsAutoRenew,
  );
  const unadded = modeCandidates.filter((c) => !alreadyKnownIds.has(c.providerId));

  if (unadded.length === 0) {
    return {
      mode,
      newlyAddedCount: 0,
      autoRenewAddedCount: 0,
      serversAddedCount: 0,
      remainingPoolCount: 0,
      addedProviders: [],
      messageAr: wantsAutoRenew
        ? 'تم جلب وإضافة جميع مواقع التجديد التلقائي الحقيقية المتوفرة بالفعل.'
        : 'تم جلب وإضافة جميع مواقع السيرفرات الحقيقية المتوفرة بالفعل.',
    };
  }

  const selectedBatch = unadded.slice(0, batchSize);

  const probeResults = await Promise.all(
    selectedBatch.map(async (seed) => {
      const body = await fetchHtmlFast(seed.probeUrl, 8500);
      if (!body || body.trim().length < 20) {
        return { seed, servers: [] as ServerSummary[], supportsAutoRenew: wantsAutoRenew };
      }

      const lower = body.toLowerCase();
      const hasChallenge =
        lower.includes('just a moment...') ||
        lower.includes('cf-browser-verification') ||
        (wantsAutoRenew &&
          (lower.includes('g-recaptcha') ||
            lower.includes('h-captcha') ||
            lower.includes('cf-turnstile')));

      if (hasChallenge) {
        return { seed, servers: [] as ServerSummary[], supportsAutoRenew: wantsAutoRenew };
      }

      const servers = buildServersFromCandidate(seed, body);
      return {
        seed,
        servers,
        supportsAutoRenew: wantsAutoRenew,
      };
    }),
  );

  const newlyAddedProviders: VpnProviderSummary[] = [];
  const reportItems: DiscoveredProviderReportItem[] = [];

  for (const res of probeResults) {
    if (res.servers.length === 0) continue;
    const { seed, servers, supportsAutoRenew } = res;

    const providerObj: VpnProviderSummary = {
      providerId: seed.providerId,
      name: seed.name,
      nameAr: seed.nameAr,
      domain: seed.domain,
      baseUrl: seed.baseUrl,
      resetScheduleAr: seed.resetScheduleAr,
      validityDaysLabelAr: seed.validityDaysLabelAr,
      supportedProtocols: seed.supportedProtocols,
      protocolCreateUrls: seed.protocolCreateUrls,
      descriptionAr: seed.descriptionAr,
      liveStatus: 'Online',
      supportsAutoRenew,
      requiresCookies: false,
      servers,
    };

    newlyAddedProviders.push(providerObj);
    reportItems.push({
      providerId: seed.providerId,
      name: seed.name,
      nameAr: seed.nameAr,
      domain: seed.domain,
      baseUrl: seed.baseUrl,
      supportsAutoRenew,
      targetTab: supportsAutoRenew ? 'autorenew' : 'servers',
      serversCount: servers.length,
      protocolsCount: seed.supportedProtocols.length,
      reasonAr: supportsAutoRenew
        ? `تم جلب ${servers.length} خادم/عقدة حقيقية ومزود متاح`
        : `تم استخراج ${servers.length} خادم حقيقي مباشر من الموقع`,
    });
  }

  const updatedStored = [...existingExtra, ...newlyAddedProviders];
  if (newlyAddedProviders.length > 0) {
    saveDiscoveredProviders(updatedStored);
    invalidateProvidersCatalogCache();
  }

  const remainingPoolCount = Math.max(
    0,
    modeCandidates.filter(
      (c) =>
        !baseProviderIds.has(c.providerId) &&
        !updatedStored.some((p) => p.providerId === c.providerId),
    ).length,
  );

  const autoRenewAddedCount = reportItems.filter((r) => r.supportsAutoRenew).length;
  const serversAddedCount = reportItems.filter((r) => !r.supportsAutoRenew).length;

  const messageAr =
    newlyAddedProviders.length === 0
      ? 'لم تستجب المصادر الحالية بعقد حية في هذه الدفعة؛ اضغط مجدداً لفحص الدفعة التالية.'
      : wantsAutoRenew
        ? `تم جلب ${newlyAddedProviders.length} مواقع تجديد تلقائي حقيقية وإضافتها لخانة التجديد التلقائي.`
        : `تم جلب ${newlyAddedProviders.length} مواقع سيرفرات حقيقية بخوادم حية مباشرة.`;

  return {
    mode,
    newlyAddedCount: newlyAddedProviders.length,
    autoRenewAddedCount,
    serversAddedCount,
    remainingPoolCount,
    addedProviders: reportItems,
    messageAr,
  };
}

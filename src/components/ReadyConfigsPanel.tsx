import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Check,
  ClipboardPaste,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  FileUp,
  Mail,
  PlusCircle,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useInAppBrowser } from '../context/InAppBrowserContext.tsx';
import {
  APP_OWNER_EMAIL,
  MAX_READY_CONFIG_BYTES,
  READY_CONFIG_CHUNK_MARKER,
  isAppOwnerUser,
  isOwnerEmailOnly,
} from '../firebase.ts';
import type { AuthUser, ReadyConfigItem, ReadyConfigProtocolId } from '../types.ts';

interface ReadyConfigsPanelProps {
  configs: ReadyConfigItem[];
  loading: boolean;
  refreshing: boolean;
  errorMsg: string | null;
  user: AuthUser | null;
  onCreateConfig: (input: {
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
  }) => Promise<void>;
  onDeleteConfig: (configId: string, chunkCount?: number) => Promise<void>;
  onRefreshConfigs: () => Promise<number>;
  onResolveConfigContent: (item: ReadyConfigItem) => Promise<string>;
  onResendVerification: () => Promise<void>;
  onRefreshVerification: () => Promise<void>;
  onRequireAuth: () => void;
}

interface ReadyProtocolSpec {
  id: ReadyConfigProtocolId;
  labelAr: string;
  defaultExt: string;
}

const READY_PROTOCOL_SPECS: ReadyProtocolSpec[] = [
  { id: 'ssh_ws', labelAr: 'SSH WebSocket (WS / CDN)', defaultExt: 'txt' },
  { id: 'ssh_ssl', labelAr: 'SSH Stunnel (SSL / TLS)', defaultExt: 'txt' },
  { id: 'ssh_dropbear', labelAr: 'SSH Dropbear مباشر', defaultExt: 'txt' },
  { id: 'slowdns', labelAr: 'SlowDNS (DNSTT)', defaultExt: 'txt' },
  { id: 'v2ray_vmess', labelAr: 'V2Ray VMess (WS + TLS)', defaultExt: 'txt' },
  { id: 'v2ray_vless', labelAr: 'V2Ray VLESS (WS + TLS)', defaultExt: 'txt' },
  { id: 'wireguard', labelAr: 'WireGuard (.conf)', defaultExt: 'conf' },
  { id: 'noobzvpn', labelAr: 'NoobzVpn (Plain / SSL)', defaultExt: 'json' },
  { id: 'squid', labelAr: 'Squid HTTP Proxy', defaultExt: 'txt' },
  { id: 'http_custom', labelAr: 'HTTP Custom (.hc)', defaultExt: 'hc' },
  { id: 'http_injector', labelAr: 'HTTP Injector (.ehi)', defaultExt: 'ehi' },
  { id: 'darktunnel', labelAr: 'DarkTunnel (.dark)', defaultExt: 'dark' },
  { id: 'npv_tunnel', labelAr: 'NPV Tunnel (.npvt)', defaultExt: 'npvt' },
  { id: 'openvpn', labelAr: 'OpenVPN (.ovpn)', defaultExt: 'ovpn' },
  { id: 'custom_file', labelAr: 'صيغة / ملف مخصص', defaultExt: 'txt' },
];

const PROTOCOL_LABEL_MAP: Record<ReadyConfigProtocolId, string> = READY_PROTOCOL_SPECS.reduce(
  (acc, item) => {
    acc[item.id] = item.labelAr;
    return acc;
  },
  {} as Record<ReadyConfigProtocolId, string>,
);

const PROTOCOL_EXT_MAP: Record<ReadyConfigProtocolId, string> = READY_PROTOCOL_SPECS.reduce(
  (acc, item) => {
    acc[item.id] = item.defaultExt;
    return acc;
  },
  {} as Record<ReadyConfigProtocolId, string>,
);

const FIREBASE_RULES_CONSOLE_URL =
  'https://console.firebase.google.com/project/carbide-pen-tpd8p/firestore/databases/ai-studio-sshtunnelde2cons-f7d4b126-82ef-4719-b4f2-b3eb618f8569/rules';

function detectProtocolFromInput(fileName: string, textSample: string): ReadyConfigProtocolId | null {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.hc')) return 'http_custom';
  if (lowerName.endsWith('.ehi')) return 'http_injector';
  if (lowerName.endsWith('.dark')) return 'darktunnel';
  if (lowerName.endsWith('.npvt')) return 'npv_tunnel';
  if (lowerName.endsWith('.ovpn')) return 'openvpn';
  if (lowerName.endsWith('.conf')) return 'wireguard';

  const trimmed = textSample.trim();
  const lowerText = trimmed.toLowerCase();
  if (lowerText.startsWith('vmess://') || lowerText.includes('"v": "2"')) return 'v2ray_vmess';
  if (lowerText.startsWith('vless://')) return 'v2ray_vless';
  if (lowerText.includes('[interface]') && lowerText.includes('[peer]')) return 'wireguard';
  if (lowerText.startsWith('noobz://') || lowerText.includes('port_plain')) return 'noobzvpn';
  if (lowerText.startsWith('dns://') || lowerText.includes('dnstt') || lowerText.includes('slowdns')) return 'slowdns';
  if (lowerText.includes('dev tun') && lowerText.includes('remote ')) return 'openvpn';
  if (lowerText.includes('upgrade: websocket') || lowerText.includes('ws port')) return 'ssh_ws';
  if (lowerText.includes('stunnel') || lowerText.includes('sni=')) return 'ssh_ssl';
  if (lowerText.includes('dropbear')) return 'ssh_dropbear';
  if (lowerText.includes('squid') || /^https?:\/\/[^/\s]+:[^/\s]+@/i.test(lowerText)) return 'squid';
  return null;
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const chunkSize = 0x4000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    let part = '';
    for (let j = 0; j < slice.length; j += 1) {
      part += String.fromCharCode(slice[j]);
    }
    chunks.push(part);
  }
  return btoa(chunks.join(''));
}

async function readFileAsBytesWithFallbacks(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (bytes.length > 0 || file.size === 0) {
        return bytes;
      }
    } catch {
      // Fallback to FileReader below (common with some Android content:// providers)
    }
  }

  try {
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('Invalid ArrayBuffer result'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('FileReader arrayBuffer failed'));
      reader.readAsArrayBuffer(file);
    });
    const bytes = new Uint8Array(buffer);
    if (bytes.length > 0 || file.size === 0) {
      return bytes;
    }
  } catch {
    // Fallback to DataURL reader below
  }

  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Invalid DataURL result'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('FileReader dataURL failed'));
      reader.readAsDataURL(file);
    });
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx !== -1) {
      const b64Part = dataUrl.slice(commaIdx + 1);
      if (b64Part) {
        return base64ToUint8(b64Part);
      }
      if (file.size === 0) {
        return new Uint8Array(0);
      }
    }
  } catch {
    // Fall through to descriptive error
  }

  throw new Error(
    'تعذر قراءة الملف من مساحة التخزين على جهازك. جرب نقل الملف إلى مجلد التنزيلات (Downloads) ثم إعادة اختياره.',
  );
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function looksBinaryBytes(bytes: Uint8Array): boolean {
  const sampleLen = Math.min(bytes.length, 4096);
  let suspicious = 0;
  for (let i = 0; i < sampleLen; i += 1) {
    const b = bytes[i];
    if (b === 0) return true;
    if (b < 32 && b !== 9 && b !== 10 && b !== 13) {
      suspicious += 1;
    }
  }
  return sampleLen > 0 && suspicious / sampleLen > 0.08;
}

function formatArabicDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
}

function formatFileSizeAr(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ReadyConfigsPanel({
  configs,
  loading,
  refreshing,
  errorMsg,
  user,
  onCreateConfig,
  onDeleteConfig,
  onRefreshConfigs,
  onResolveConfigContent,
  onResendVerification,
  onRefreshVerification,
  onRequireAuth,
}: ReadyConfigsPanelProps) {
  const { openInAppUrl } = useInAppBrowser();
  const isOwnerEmail = isOwnerEmailOnly(user);
  const isVerifiedOwner = isAppOwnerUser(user);

  const [filterProtocol, setFilterProtocol] = useState<'all' | ReadyConfigProtocolId>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [cardActionError, setCardActionError] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  // Owner Upload / Paste Form State
  const [inputMode, setInputMode] = useState<'paste' | 'upload'>('paste');
  const [title, setTitle] = useState<string>('');
  const [protocol, setProtocol] = useState<ReadyConfigProtocolId>('v2ray_vless');
  const [fileName, setFileName] = useState<string>('ready-config.txt');
  const [serverLabel, setServerLabel] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [encoding, setEncoding] = useState<'text' | 'base64'>('text');
  const [uploadedByteSize, setUploadedByteSize] = useState<number>(0);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [readingFile, setReadingFile] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileReadError, setFileReadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [verifyingAction, setVerifyingAction] = useState<boolean>(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredConfigs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return configs.filter((item) => {
      if (filterProtocol !== 'all' && item.protocol !== filterProtocol) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.fileName.toLowerCase().includes(q) ||
        item.serverLabel.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q) ||
        item.protocol.toLowerCase().includes(q) ||
        (PROTOCOL_LABEL_MAP[item.protocol] || '').toLowerCase().includes(q)
      );
    });
  }, [configs, filterProtocol, searchQuery]);

  const handleProtocolChange = (nextProto: ReadyConfigProtocolId) => {
    setProtocol(nextProto);
    const nextExt = PROTOCOL_EXT_MAP[nextProto] || 'txt';
    setFileName((prev) => {
      const clean = prev.trim() || 'ready-config';
      const base = clean.includes('.') ? clean.slice(0, clean.lastIndexOf('.')) : clean;
      return `${base || 'ready-config'}.${nextExt}`;
    });
  };

  const processSelectedFile = async (
    file: File,
    options?: { preserveFileName?: boolean; preserveTitle?: boolean },
  ): Promise<{
    content: string;
    encoding: 'text' | 'base64';
    fileName: string;
    protocol: ReadyConfigProtocolId;
    byteSize: number;
  }> => {
    if (file.size > MAX_READY_CONFIG_BYTES) {
      throw new Error('حجم الملف كبير جداً (الحد الأقصى 5 ميجابايت).');
    }

    const bytes = await readFileAsBytesWithFallbacks(file);
    if (bytes.length === 0) {
      throw new Error('الملف المختار فارغ.');
    }
    if (bytes.length > MAX_READY_CONFIG_BYTES) {
      throw new Error('حجم الملف كبير جداً (الحد الأقصى 5 ميجابايت).');
    }

    const nextFileName = options?.preserveFileName && fileName.trim()
      ? fileName.trim().slice(0, 128)
      : (file.name || 'ready-config.txt').slice(0, 128);

    if (!options?.preserveTitle && !title.trim() && file.name) {
      const baseTitle = file.name.includes('.')
        ? file.name.slice(0, file.name.lastIndexOf('.'))
        : file.name;
      setTitle(baseTitle.slice(0, 120));
    }
    if (!options?.preserveFileName || !fileName.trim()) {
      setFileName(nextFileName);
    }

    let nextEncoding: 'text' | 'base64' = 'text';
    let nextContent = '';
    let nextProtocol: ReadyConfigProtocolId = protocol;

    const isKnownBinaryExt = /\.(hc|ehi|dark|npvt|zip|bin)$/i.test(file.name || '');
    const isBinary = isKnownBinaryExt || looksBinaryBytes(bytes);
    if (!isBinary) {
      const decodedText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      const hasReplacementChars = decodedText.includes('\uFFFD');
      if (!hasReplacementChars && decodedText.trim().length > 0 && decodedText.length <= 9_500_000) {
        nextEncoding = 'text';
        nextContent = decodedText;
        const detected = detectProtocolFromInput(file.name, decodedText.slice(0, 8192));
        if (detected) nextProtocol = detected;
      } else {
        const b64 = uint8ToBase64(bytes);
        nextEncoding = 'base64';
        nextContent = b64;
        const detected = detectProtocolFromInput(file.name, '');
        if (detected) nextProtocol = detected;
      }
    } else {
      const b64 = uint8ToBase64(bytes);
      nextEncoding = 'base64';
      nextContent = b64;
      const detected = detectProtocolFromInput(file.name, '');
      if (detected) nextProtocol = detected;
    }

    setUploadedByteSize(bytes.length);
    setEncoding(nextEncoding);
    setContent(nextContent);
    setProtocol(nextProtocol);
    setFileReadError(null);

    return {
      content: nextContent,
      encoding: nextEncoding,
      fileName: nextFileName,
      protocol: nextProtocol,
      byteSize: bytes.length,
    };
  };

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    setFormSuccess(null);
    setFileReadError(null);
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);

    if (!file) {
      setContent('');
      setUploadedByteSize(0);
      return;
    }

    setReadingFile(true);
    try {
      await processSelectedFile(file);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'تعذر قراءة ملف الكونفج المختار.';
      setContent('');
      setUploadedByteSize(0);
      setFileReadError(msg);
      setFormError(msg);
    } finally {
      setReadingFile(false);
    }
  };

  const handlePasteContentChange = (nextText: string) => {
    setEncoding('text');
    setUploadedByteSize(0);
    setSelectedFile(null);
    setFileReadError(null);
    setContent(nextText);
    const detected = detectProtocolFromInput('', nextText);
    if (detected && detected !== protocol) {
      handleProtocolChange(detected);
    }
  };

  const handlePublishSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (readingFile) {
      setFormError('جارٍ قراءة الملف المختار، يرجى الانتظار لحظة ثم المحاولة مجدداً.');
      return;
    }

    if (!title.trim()) {
      setFormError('يرجى إدخال عنوان واضح للكونفج.');
      return;
    }

    let resolvedContent = content;
    let resolvedEncoding = encoding;
    let resolvedProtocol = protocol;
    let resolvedFileName = fileName.trim();
    let resolvedByteSize = uploadedByteSize;

    if (inputMode === 'upload' && !resolvedContent.trim()) {
      const pendingFile = fileInputRef.current?.files?.[0] ?? selectedFile;
      if (pendingFile) {
        setReadingFile(true);
        try {
          const parsed = await processSelectedFile(pendingFile, {
            preserveFileName: Boolean(resolvedFileName),
            preserveTitle: true,
          });
          resolvedContent = parsed.content;
          resolvedEncoding = parsed.encoding;
          resolvedProtocol = parsed.protocol;
          resolvedByteSize = parsed.byteSize;
          if (!resolvedFileName) {
            resolvedFileName = parsed.fileName;
          }
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : 'تعذر قراءة ملف الكونفج المختار.';
          setFileReadError(msg);
          setFormError(msg);
          return;
        } finally {
          setReadingFile(false);
        }
      }
    }

    if (!resolvedContent.trim()) {
      setFormError(
        inputMode === 'upload'
          ? fileReadError || 'يرجى اختيار ملف الكونفج أولاً.'
          : 'يرجى لصق نص أو رابط الكونفج أولاً.',
      );
      return;
    }

    const safeFileName =
      resolvedFileName || `config-${resolvedProtocol}.${PROTOCOL_EXT_MAP[resolvedProtocol] || 'txt'}`;

    setSubmitting(true);
    setUploadProgress(0);
    try {
      await onCreateConfig({
        title: title.trim(),
        protocol: resolvedProtocol,
        fileName: safeFileName,
        serverLabel: serverLabel.trim(),
        notes: notes.trim(),
        content: resolvedContent,
        encoding: resolvedEncoding,
        sourceMode: inputMode,
        totalBytes: resolvedByteSize > 0 ? resolvedByteSize : resolvedContent.length,
        onProgress: (pct) => setUploadProgress(pct),
      });
      setTitle('');
      setServerLabel('');
      setNotes('');
      setContent('');
      setEncoding('text');
      setUploadedByteSize(0);
      setSelectedFile(null);
      setFileReadError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setFormSuccess(
        inputMode === 'upload'
          ? 'تم نشر ملف الكونفج بنجاح وأصبح متاحاً للمستخدمين للتنزيل.'
          : 'تم نشر الكونفج بنجاح وأصبح متاحاً للمستخدمين للنسخ الفوري.',
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'تعذر نشر الكونفج حالياً.');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshNotice(null);
    setCardActionError(null);
    try {
      const count = await onRefreshConfigs();
      setRefreshNotice(`تم تحديث قائمة الكونفجات (${count} كونفج منشور).`);
    } catch (err) {
      setRefreshNotice(err instanceof Error ? err.message : 'تعذر تحديث قائمة الكونفجات حالياً.');
    }
  };

  const handleCopyConfig = async (item: ReadyConfigItem) => {
    setCardActionError(null);
    setBusyActionId(item.id);
    try {
      const fullContent = await onResolveConfigContent(item);
      await navigator.clipboard.writeText(fullContent);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1700);
    } catch (err) {
      setCardActionError(err instanceof Error ? err.message : 'تعذر نسخ الكونفج.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleDownloadConfig = async (item: ReadyConfigItem) => {
    setCardActionError(null);
    setBusyActionId(item.id);
    try {
      const fullContent = await onResolveConfigContent(item);
      const safeName = item.fileName || `config-${item.protocol}.${PROTOCOL_EXT_MAP[item.protocol] || 'txt'}`;
      let blob: Blob;
      if (item.encoding === 'base64') {
        const bytes = base64ToUint8(fullContent);
        const copyBuffer = new Uint8Array(bytes).buffer;
        blob = new Blob([copyBuffer], { type: 'application/octet-stream' });
      } else {
        blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = safeName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setCardActionError(err instanceof Error ? err.message : 'تعذر تنزيل الكونفج.');
    } finally {
      setBusyActionId(null);
    }
  };

  const handleDelete = async (item: ReadyConfigItem) => {
    setBusyDeleteId(item.id);
    try {
      await onDeleteConfig(item.id, item.chunkCount ?? 0);
    } finally {
      setBusyDeleteId(null);
    }
  };

  const isRulesPermissionError =
    Boolean(errorMsg) && /permission|missing or insufficient/i.test(errorMsg || '');

  return (
    <section id="ready-configs" className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-[#09090b]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <FileCode2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <h1 className="text-lg font-bold text-slate-950 dark:text-white">
                كونفجات جاهزه ({configs.length})
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              مكتبة الكونفجات الجاهزة المعتمدة بجميع الصيغ والبروتوكولات — نسخ فوري للكونفجات الملصوقة وتنزيل مباشر للملفات المرفوعة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleManualRefresh()}
              disabled={refreshing || loading}
              title="جلب الكونفجات الجديدة التي رفعها المالك"
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{refreshing ? 'جارٍ التحديث...' : 'تحديث الكونفجات'}</span>
            </button>

            <div className="relative">
              <Search
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في الكونفجات..."
                className="min-h-[38px] w-44 rounded-lg border border-slate-300 bg-slate-50 pr-9 pl-3 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-black dark:text-zinc-100 sm:w-52"
              />
            </div>

            <select
              aria-label="تصفية حسب الصيغة"
              value={filterProtocol}
              onChange={(e) => setFilterProtocol(e.target.value as 'all' | ReadyConfigProtocolId)}
              className="min-h-[38px] rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-black dark:text-zinc-100"
            >
              <option value="all">جميع الصيغ والبروتوكولات</option>
              {READY_PROTOCOL_SPECS.map((spec) => (
                <option key={spec.id} value={spec.id}>
                  {spec.labelAr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {refreshNotice && (
          <p role="status" className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {refreshNotice}
          </p>
        )}

        {cardActionError && (
          <p role="alert" className="mt-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {cardActionError}
          </p>
        )}

        {/* Owner-Only Verification Prompt (if logged in with owner email before email verification) */}
        {isOwnerEmail && !isVerifiedOwner && (
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-50 p-4 text-xs dark:bg-amber-950/25">
            <div className="flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <div className="space-y-1.5">
                <p className="font-bold">
                  تم تسجيل الدخول بحساب المالك ({APP_OWNER_EMAIL}) — خطوة تأكيد البريد مطلوبة للنشر
                </p>
                <p className="leading-relaxed">
                  لحماية صلاحية رفع الكونفجات من أي انتحال في قواعد Firestore، يجب تأكيد البريد الإلكتروني مرة واحدة فقط.
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={verifyingAction}
                onClick={async () => {
                  setVerifyingAction(true);
                  setVerifyNotice(null);
                  try {
                    await onResendVerification();
                    setVerifyNotice('تم إرسال رابط التأكيد إلى بريد المالك. افتح الرسالة ثم اضغط «تحديث حالة التأكيد».');
                  } catch (err) {
                    setVerifyNotice(err instanceof Error ? err.message : 'تعذر إرسال رابط التأكيد');
                  } finally {
                    setVerifyingAction(false);
                  }
                }}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                <span>إرسال رابط التأكيد للبريد</span>
              </button>
              <button
                type="button"
                disabled={verifyingAction}
                onClick={async () => {
                  setVerifyingAction(true);
                  setVerifyNotice(null);
                  try {
                    await onRefreshVerification();
                  } catch (err) {
                    setVerifyNotice(err instanceof Error ? err.message : 'تعذر تحديث الحالة');
                  } finally {
                    setVerifyingAction(false);
                  }
                }}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-amber-500/50 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:bg-black dark:text-amber-200"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${verifyingAction ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span>تحديث حالة التأكيد</span>
              </button>
            </div>
            {verifyNotice && (
              <p className="mt-2 font-semibold text-amber-800 dark:text-amber-300">{verifyNotice}</p>
            )}
          </div>
        )}

        {/* Owner-Only Upload & Paste Panel */}
        {isVerifiedOwner && (
          <form
            onSubmit={handlePublishSubmit}
            className="mt-5 space-y-4 rounded-xl border border-emerald-500/35 bg-emerald-500/[0.03] p-4 sm:p-5 dark:border-emerald-500/30 dark:bg-emerald-950/15"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <h2 className="text-sm font-bold text-slate-950 dark:text-white">
                  لوحة المالك — رفع أو لصق كونفج جاهز ({APP_OWNER_EMAIL})
                </h2>
              </div>

              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:border dark:border-zinc-800 dark:bg-black">
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setInputMode('paste');
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    inputMode === 'paste'
                      ? 'bg-white text-slate-950 shadow-sm dark:bg-zinc-900 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
                  }`}
                >
                  <ClipboardPaste className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>لصق الكونفج</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setInputMode('upload');
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    inputMode === 'upload'
                      ? 'bg-white text-slate-950 shadow-sm dark:bg-zinc-900 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
                  }`}
                >
                  <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>رفع ملف كونفج</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="rc-title" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  عنوان الكونفج
                </label>
                <input
                  id="rc-title"
                  type="text"
                  maxLength={120}
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: كونفج ألمانيا VLESS سريع"
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                />
              </div>

              <div>
                <label htmlFor="rc-protocol" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  الصيغة / البروتوكول
                </label>
                <select
                  id="rc-protocol"
                  value={protocol}
                  onChange={(e) => handleProtocolChange(e.target.value as ReadyConfigProtocolId)}
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                >
                  {READY_PROTOCOL_SPECS.map((spec) => (
                    <option key={spec.id} value={spec.id}>
                      {spec.labelAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="rc-filename" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  اسم الملف للتنزيل
                </label>
                <input
                  id="rc-filename"
                  type="text"
                  dir="ltr"
                  maxLength={128}
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="ready-config.txt"
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                />
              </div>

              <div>
                <label htmlFor="rc-server-label" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  الشبكة أو السيرفر (اختياري)
                </label>
                <input
                  id="rc-server-label"
                  type="text"
                  maxLength={120}
                  value={serverLabel}
                  onChange={(e) => setServerLabel(e.target.value)}
                  placeholder="مثال: فودافون · DE 2"
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                />
              </div>
            </div>

            {inputMode === 'upload' ? (
              <div className="space-y-2 rounded-lg border border-dashed border-emerald-500/45 bg-white p-4 dark:bg-black">
                <label
                  htmlFor="rc-file-input"
                  className="block text-xs font-semibold text-slate-800 dark:text-zinc-200"
                >
                  اختر ملف الكونفج من جهازك (.hc, .ehi, .dark, .npvt, .conf, .ovpn, .json, .txt — حتى 5 ميجابايت)
                </label>
                <input
                  ref={fileInputRef}
                  id="rc-file-input"
                  type="file"
                  onChange={(e) => void handleFileSelected(e)}
                  className="block w-full cursor-pointer text-xs text-slate-600 file:ml-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3.5 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-emerald-500 dark:text-zinc-300"
                />
                {readingFile && (
                  <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    جارٍ قراءة الملف المختار وتجهيزه للنشر...
                  </p>
                )}
                {!readingFile && fileReadError && (
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    {fileReadError}
                  </p>
                )}
                {!readingFile && !fileReadError && content && (
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    تم تجهيز الملف ({fileName}) ·{' '}
                    {encoding === 'base64'
                      ? `ملف ثنائي مشفّر (${formatFileSizeAr(uploadedByteSize)})`
                      : `ملف نصي (${formatFileSizeAr(uploadedByteSize || content.length)})`}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label
                  htmlFor="rc-paste-content"
                  className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
                >
                  محتوى الكونفج أو الرابط المباشر (vmess://, vless://, ssh://, WireGuard .conf, SlowDNS, HTTP Payload, JSON...)
                </label>
                <textarea
                  id="rc-paste-content"
                  rows={5}
                  dir="ltr"
                  value={encoding === 'text' ? content : ''}
                  onChange={(e) => handlePasteContentChange(e.target.value)}
                  placeholder="الصق هنا الكونفج أو الرابط أو ملف الإعدادات بالكامل..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
                />
              </div>
            )}

            <div>
              <label htmlFor="rc-notes" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                ملاحظات التشغيل للمستخدمين (اختياري)
              </label>
              <input
                id="rc-notes"
                type="text"
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: يعمل على باقة السوشيال أو يتطلب تفعيل SNI..."
                className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
              />
            </div>

            {formError && (
              <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {formError}
              </p>
            )}
            {formSuccess && (
              <p role="status" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {formSuccess}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || readingFile}
              className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60 sm:w-auto"
            >
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              <span>
                {readingFile
                  ? 'جارٍ قراءة الملف...'
                  : submitting
                    ? uploadProgress > 0
                      ? `جارٍ الرفع (${uploadProgress}%)...`
                      : 'جارٍ النشر...'
                    : 'نشر الكونفج في القائمة العامة'}
              </span>
            </button>
          </form>
        )}

        {/* Non-owner signed-out helper link */}
        {!user && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600 dark:border-zinc-800 dark:bg-black dark:text-zinc-400">
            <span>يمكنك نسخ وتنزيل أي كونفج جاهز أدناه مجاناً، وللمالك فقط صلاحية الرفع والنشر بعد تسجيل الدخول.</span>
            <button
              type="button"
              onClick={onRequireAuth}
              className="font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
            >
              تسجيل الدخول
            </button>
          </div>
        )}
      </div>

      {/* Firestore Rules Sync Warning if needed */}
      {isRulesPermissionError && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-50 p-4 text-xs text-amber-900 dark:bg-amber-950/25 dark:text-amber-200">
          <p className="font-bold">
            يلزم تفعيل قواعد Firestore المحدّثة لقسم «كونفجات جاهزه» في لوحة Firebase:
          </p>
          <p className="mt-1 leading-relaxed">
            افتح قسم Rules في Firebase Console والصق محتوى ملف <code dir="ltr" className="font-mono">firestore.rules</code> ثم اضغط Publish لتظهر الكونفجات الجاهزة للجميع.
          </p>
          <button
            type="button"
            onClick={() => openInAppUrl(FIREBASE_RULES_CONSOLE_URL, { title: 'Firebase Rules' })}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:bg-black dark:text-amber-300"
          >
            <span>فتح Firebase Firestore Rules</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Configs List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-[#09090b]"
            />
          ))}
        </div>
      ) : filteredConfigs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center dark:border-zinc-800 dark:bg-[#09090b]">
          <FileCode2 className="mx-auto h-9 w-9 text-slate-400 dark:text-zinc-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-zinc-200">
            {configs.length === 0
              ? 'لا توجد كونفجات جاهزة منشورة بعد.'
              : 'لا توجد نتائج مطابقة للبحث أو الصيغة المختارة.'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            {isVerifiedOwner
              ? 'استخدم لوحة المالك أعلاه لرفع أو لصق أول كونفج جاهز.'
              : 'سيظهر هنا كل كونفج يقوم المالك برفعه ليكون متاحاً للنسخ والتنزيل الفوري.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredConfigs.map((item) => {
            const protoLabel = PROTOCOL_LABEL_MAP[item.protocol] || item.protocol;
            const isBinary = item.encoding === 'base64';
            const isChunked =
              (item.chunkCount ?? 0) > 0 || item.content === READY_CONFIG_CHUNK_MARKER;
            const isUploadedFile =
              item.sourceMode === 'upload'
                ? true
                : item.sourceMode === 'paste'
                  ? false
                  : isBinary ||
                    isChunked ||
                    item.content.includes('\uFFFD') ||
                    /\.(hc|ehi|dark|npvt|ovpn|bin|zip)$/i.test(item.fileName);
            const sizeLabel = formatFileSizeAr(item.totalBytes);
            const isCardBusy = busyActionId === item.id;
            return (
              <article
                key={item.id}
                className="flex flex-col justify-between gap-3.5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-[#09090b]"
              >
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-slate-950 dark:text-white">
                        {item.title}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-zinc-400">
                        <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300">
                          {protoLabel}
                        </span>
                        {isUploadedFile && (
                          <span dir="ltr" className="font-mono text-slate-700 dark:text-zinc-300">
                            {item.fileName}
                          </span>
                        )}
                        {sizeLabel && (
                          <span dir="ltr" className="font-mono text-[10px] text-slate-500 dark:text-zinc-400">
                            ({sizeLabel})
                          </span>
                        )}
                        {item.serverLabel && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-slate-700 dark:text-zinc-300">
                              <Server className="h-3 w-3 text-slate-400" aria-hidden="true" />
                              <span>{item.serverLabel}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <span className="shrink-0 text-[10px] text-slate-400 dark:text-zinc-500">
                      {formatArabicDate(item.createdAtIso)}
                    </span>
                  </div>

                  {item.notes && (
                    <p className="rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700 dark:border-zinc-800 dark:bg-black dark:text-zinc-300">
                      {item.notes}
                    </p>
                  )}

                  {isUploadedFile ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-zinc-800 dark:bg-black dark:text-zinc-400">
                      ملف كونفج مرفوع بصيغة <strong className="text-slate-900 dark:text-white">{protoLabel}</strong>
                      {sizeLabel ? ` (${sizeLabel})` : ''} — اضغط «تنزيل الكونفج» لحفظ الملف (<span dir="ltr" className="font-mono">{item.fileName}</span>) وفتحه مباشرة في التطبيق.
                    </div>
                  ) : isChunked ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-zinc-800 dark:bg-black dark:text-zinc-400">
                      كونفج ملصوق بصيغة <strong className="text-slate-900 dark:text-white">{protoLabel}</strong>
                      {sizeLabel ? ` (${sizeLabel})` : ''} — اضغط «نسخ الكونفج» لنسخ المحتوى بالكامل.
                    </div>
                  ) : (
                    <pre
                      dir="ltr"
                      className="max-h-44 overflow-auto rounded-lg border border-slate-200 bg-black p-3 text-left font-mono text-xs leading-relaxed text-emerald-300 dark:border-zinc-800"
                    >
                      {item.content}
                    </pre>
                  )}
                </div>

                {/* Copy for pasted protocol configs, Download for uploaded files + Owner Delete */}
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-3 dark:border-zinc-800">
                  {isUploadedFile ? (
                    <button
                      type="button"
                      disabled={isCardBusy}
                      onClick={() => void handleDownloadConfig(item)}
                      className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{isCardBusy ? 'جارٍ التجهيز...' : 'تنزيل الكونفج'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isCardBusy}
                      onClick={() => void handleCopyConfig(item)}
                      className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                    >
                      {copiedId === item.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>
                        {isCardBusy ? 'جارٍ التجهيز...' : copiedId === item.id ? 'تم النسخ' : 'نسخ الكونفج'}
                      </span>
                    </button>
                  )}

                  {isVerifiedOwner && (
                    <button
                      type="button"
                      disabled={busyDeleteId === item.id}
                      onClick={() => void handleDelete(item)}
                      title="حذف الكونفج"
                      aria-label={`حذف ${item.title}`}
                      className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-slate-200 px-2.5 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function toDatetimeLocalValue(isoOrMs: string | number): string {
  const date = typeof isoOrMs === 'number' ? new Date(isoOrMs) : new Date(Date.parse(isoOrMs));
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function addDaysToDatetimeLocal(days: number): string {
  return toDatetimeLocalValue(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function datetimeLocalToIso(localValue: string): string | null {
  const trimmed = localValue.trim();
  if (!trimmed) return null;
  const ts = Date.parse(trimmed);
  if (Number.isNaN(ts)) return null;
  return new Date(ts).toISOString();
}

export function formatArabicExpiryDate(isoOrLocal: string): string {
  const ts = Date.parse(isoOrLocal);
  if (Number.isNaN(ts)) return isoOrLocal;
  return new Date(ts).toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface ExpiryCounterDetails {
  hasDate: boolean;
  isExpired: boolean;
  isUrgent: boolean;
  daysLeftCeil: number;
  daysRemainingText: string;
  countdownLabel: string;
}

export function getExpiryCounterDetails(
  isoOrLocal: string,
  nowMs: number,
): ExpiryCounterDetails {
  const targetMs = Date.parse(isoOrLocal);
  if (!isoOrLocal || Number.isNaN(targetMs)) {
    return {
      hasDate: false,
      isExpired: false,
      isUrgent: false,
      daysLeftCeil: 0,
      daysRemainingText: 'غير محدد',
      countdownLabel: '--',
    };
  }

  const diffSec = Math.floor((targetMs - nowMs) / 1000);
  if (diffSec <= 0) {
    return {
      hasDate: true,
      isExpired: true,
      isUrgent: true,
      daysLeftCeil: 0,
      daysRemainingText: '0 يوم متبقي (منتهي)',
      countdownLabel: '00:00:00',
    };
  }

  const daysLeftCeil = Math.ceil(diffSec / 86400);
  const fullDays = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  const hms = [hours, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');

  const daysRemainingText =
    daysLeftCeil === 1
      ? 'متبقي يوم واحد'
      : daysLeftCeil === 2
      ? 'متبقي يومان'
      : daysLeftCeil <= 10
      ? `متبقي ${daysLeftCeil} أيام`
      : `متبقي ${daysLeftCeil} يوماً`;

  return {
    hasDate: true,
    isExpired: false,
    isUrgent: diffSec < 86400,
    daysLeftCeil,
    daysRemainingText,
    countdownLabel: fullDays > 0 ? `${fullDays}ي ${hms}` : hms,
  };
}

export interface ExpiryGradualUrgency {
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  rowClass: string;
  badgeClass: string;
  barClass: string;
  stageLabel: string;
}

export function getExpiryGradualUrgency(
  isoOrLocal: string,
  nowMs: number,
): ExpiryGradualUrgency {
  const targetMs = Date.parse(isoOrLocal);
  if (!isoOrLocal || Number.isNaN(targetMs)) {
    return {
      level: 0,
      rowClass: '',
      badgeClass:
        'border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400',
      barClass: 'bg-zinc-600 w-0',
      stageLabel: '',
    };
  }

  const remainingHours = (targetMs - nowMs) / (1000 * 60 * 60);

  if (remainingHours <= 0) {
    return {
      level: 7,
      rowClass:
        'bg-red-100/90 hover:bg-red-100 border-r-4 border-r-red-600 dark:bg-red-950/90 dark:hover:bg-red-950 dark:border-r-red-500',
      badgeClass:
        'border-red-600 bg-red-600 text-white dark:border-red-500 dark:bg-red-600 dark:text-white',
      barClass: 'bg-red-500 w-full',
      stageLabel: 'منتهي الصلاحية',
    };
  }

  if (remainingHours <= 2) {
    return {
      level: 6,
      rowClass:
        'bg-red-100/75 hover:bg-red-100/90 border-r-4 border-r-red-500 dark:bg-red-950/75 dark:hover:bg-red-950/85 dark:border-r-red-500',
      badgeClass:
        'border-red-500 bg-red-600/90 text-white dark:border-red-500 dark:bg-red-900/80 dark:text-red-100',
      barClass: 'bg-red-500 w-1/12',
      stageLabel: 'حرج جداً',
    };
  }

  if (remainingHours <= 6) {
    return {
      level: 5,
      rowClass:
        'bg-red-50/90 hover:bg-red-100/60 border-r-4 border-r-red-500/85 dark:bg-red-950/55 dark:hover:bg-red-950/65 dark:border-r-red-500',
      badgeClass:
        'border-red-400 bg-red-100 text-red-900 dark:border-red-600 dark:bg-red-950/80 dark:text-red-100',
      barClass: 'bg-red-500 w-1/6',
      stageLabel: 'ينتهي خلال ساعات',
    };
  }

  if (remainingHours <= 12) {
    return {
      level: 4,
      rowClass:
        'bg-red-50/70 hover:bg-red-50 border-r-4 border-r-red-400 dark:bg-red-950/40 dark:hover:bg-red-950/50 dark:border-r-red-600',
      badgeClass:
        'border-red-300 bg-red-100/80 text-red-800 dark:border-red-700/80 dark:bg-red-950/65 dark:text-red-200',
      barClass: 'bg-red-500 w-1/4',
      stageLabel: 'أقل من 12 ساعة',
    };
  }

  if (remainingHours <= 24) {
    return {
      level: 3,
      rowClass:
        'bg-red-50/45 hover:bg-red-50/70 border-r-4 border-r-red-400/70 dark:bg-red-950/25 dark:hover:bg-red-950/35 dark:border-r-red-700',
      badgeClass:
        'border-red-300 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/45 dark:text-red-200',
      barClass: 'bg-red-400 w-1/3',
      stageLabel: 'أقل من 24 ساعة',
    };
  }

  if (remainingHours <= 48) {
    return {
      level: 2,
      rowClass:
        'bg-orange-50/50 hover:bg-orange-50/80 border-r-2 border-r-orange-400 dark:bg-orange-950/20 dark:hover:bg-orange-950/30 dark:border-r-orange-600',
      badgeClass:
        'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-700/70 dark:bg-orange-950/45 dark:text-orange-300',
      barClass: 'bg-orange-500 w-1/2',
      stageLabel: 'قريب الانتهاء',
    };
  }

  if (remainingHours <= 72) {
    return {
      level: 1,
      rowClass:
        'bg-amber-50/40 hover:bg-amber-50/70 border-r-2 border-r-amber-400/80 dark:bg-amber-950/15 dark:hover:bg-amber-950/25 dark:border-r-amber-600/70',
      badgeClass:
        'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/35 dark:text-amber-300',
      barClass: 'bg-amber-500 w-3/4',
      stageLabel: 'اقترب الانتهاء',
    };
  }

  return {
    level: 0,
    rowClass: '',
    badgeClass:
      'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-300',
    barClass: 'bg-emerald-500 w-full',
    stageLabel: 'صالح',
  };
}


import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall.ts';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>وضع عدم الاتصال — يتم عرض الواجهة المخزنة مؤقتاً</span>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { getUnsyncedPunches } from '../../lib/offlineQueue';
import { syncOfflinePunches, initAutoSyncListener } from '../../lib/offlineSync';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const checkQueue = async () => {
    const list = await getUnsyncedPunches();
    setUnsyncedCount(list.length);
  };

  useEffect(() => {
    checkQueue();

    const handleOnline = async () => {
      setIsOffline(false);
      const result = await syncOfflinePunches();
      if (result.syncedCount > 0) {
        setSyncToast(`📶 Connection Restored: ${result.syncedCount} offline punch(es) synced successfully!`);
        setTimeout(() => setSyncToast(null), 4000);
      }
      checkQueue();
    };

    const handleOffline = () => {
      setIsOffline(true);
      checkQueue();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const cleanup = initAutoSyncListener((count) => {
      setSyncToast(`📶 ${count} offline punch(es) auto-synced!`);
      setTimeout(() => setSyncToast(null), 4000);
      checkQueue();
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      cleanup();
    };
  }, []);

  if (!isOffline && unsyncedCount === 0 && !syncToast) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300">
      {syncToast ? (
        <div className="glass p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold flex items-center gap-2 shadow-xl shadow-black/50">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="flex-1">{syncToast}</span>
        </div>
      ) : isOffline ? (
        <div className="glass p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs space-y-1 shadow-xl shadow-black/50">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5 text-white">
              <WifiOff className="w-4 h-4 text-amber-400" /> Offline Mode Active
            </span>
            {unsyncedCount > 0 && (
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-[10px]">
                {unsyncedCount} Queued
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-300">
            Punches are saved safely on your device and will auto-sync when network connects.
          </p>
        </div>
      ) : unsyncedCount > 0 ? (
        <div className="glass p-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs flex items-center justify-between shadow-xl shadow-black/50">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
            <span>Syncing {unsyncedCount} offline punch(es)...</span>
          </div>
          <button
            onClick={() => syncOfflinePunches().then(checkQueue)}
            className="px-2.5 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-[10px] font-bold"
          >
            Sync Now
          </button>
        </div>
      ) : null}
    </div>
  );
}

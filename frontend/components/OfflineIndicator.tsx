"use client";

import { useEffect, useState } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getOutboxCount } from "@/lib/offline-store";
import { syncOutbox } from "@/lib/offline-sync";
import { WifiOff, RefreshCw, Check, Cloud } from "lucide-react";

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(0);

  useEffect(() => {
    const updateCount = async () => {
      const count = await getOutboxCount();
      setPendingCount(count);
    };
    updateCount();
    const interval = setInterval(updateCount, 5_000);
    return () => clearInterval(interval);
  }, [lastSynced]);

  useEffect(() => {
    const handleSynced = () => {
      setLastSynced((n) => n + 1);
    };
    window.addEventListener("outbox-synced", handleSynced);
    return () => window.removeEventListener("outbox-synced", handleSynced);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    await syncOutbox();
    setSyncing(false);
    setLastSynced((n) => n + 1);
  };

  // Don't show anything if online and nothing pending
  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOnline ? (
        <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 shadow-lg backdrop-blur-sm">
          <WifiOff className="h-4 w-4 text-warning" />
          <span className="text-sm font-medium text-warning">Offline</span>
          {pendingCount > 0 && (
            <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-bold text-warning">
              {pendingCount} pending
            </span>
          )}
        </div>
      ) : pendingCount > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-4 py-2.5 shadow-lg backdrop-blur-sm">
          <Cloud className="h-4 w-4 text-brand" />
          <span className="text-sm font-medium text-brand">
            {syncing ? "Syncing..." : `${pendingCount} pending`}
          </span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="rounded-lg p-1 text-brand hover:bg-brand/10 transition-colors disabled:opacity-50"
            title="Sync now"
          >
            {syncing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 shadow-lg backdrop-blur-sm">
          <Check className="h-4 w-4 text-success" />
          <span className="text-sm font-medium text-success">All synced</span>
        </div>
      )}
    </div>
  );
}

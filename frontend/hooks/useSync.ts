// frontend/hooks/useSync.ts
// ==========================================
// SS Mart — Sync status hook
// ==========================================
'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSyncEngine, type SyncStatus, type SyncResult } from '@/lib/sync-engine';

export function useSync() {
  const [status, setStatus] = useState<SyncStatus>({
    state: 'idle',
    pending: 0,
    lastSync: null,
  });

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    getSyncEngine().then((engine) => {
      unsubscribe = engine.onStatusChange(setStatus);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const syncNow = useCallback(async (): Promise<SyncResult> => {
    const engine = await getSyncEngine();
    return engine.fullSync();
  }, []);

  const queueMutation = useCallback(
    async (
      table: Parameters<SyncEngine['queueMutation']>[0],
      operation: Parameters<SyncEngine['queueMutation']>[1],
      recordId: string,
      data: Record<string, unknown>
    ) => {
      const engine = await getSyncEngine();
      return engine.queueMutation(table, operation, recordId, data);
    },
    []
  );

  return {
    ...status,
    syncNow,
    queueMutation,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  };
}

// Re-export SyncEngine type for queueMutation parameter typing
import type { SyncEngine } from '@/lib/sync-engine';

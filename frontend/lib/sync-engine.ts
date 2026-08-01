// frontend/lib/sync-engine.ts
// ==========================================
// SS Mart — Offline Sync Engine
// Handles bidirectional sync between IndexedDB and server
// ==========================================

const DB_NAME = 'ssmart-sync';
const DB_VERSION = 1;
const OUTBOX_STORE = 'sync-outbox';
const META_STORE = 'sync-meta';

export type SyncTable =
  | 'products'
  | 'customers'
  | 'invoices'
  | 'invoice_items'
  | 'categories'
  | 'suppliers'
  | 'purchases'
  | 'purchase_items'
  | 'users'
  | 'salesmen'
  | 'settings';

interface OutboxEntry {
  id?: number;
  table: SyncTable;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  recordId: string;
  data: Record<string, unknown>;
  timestamp: number;
  synced: boolean;
  retries: number;
  error?: string;
}

interface SyncMeta {
  key: string;
  value: string;
}

class SyncEngine {
  private db: IDBDatabase | null = null;
  private syncInProgress = false;
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private status: SyncStatus = { state: 'idle', pending: 0, lastSync: null };

  async init(): Promise<void> {
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          const store = db.createObjectStore(OUTBOX_STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('synced', 'synced', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('table', 'table', { unique: false });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' });
        }
      };
    });
  }

  // Subscribe to sync status changes
  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.listeners.add(callback);
    callback(this.status);
    return () => this.listeners.delete(callback);
  }

  private emitStatus() {
    this.listeners.forEach((cb) => cb(this.status));
  }

  private setStatus(partial: Partial<SyncStatus>) {
    this.status = { ...this.status, ...partial };
    this.emitStatus();
  }

  // Add a mutation to the outbox queue
  async queueMutation(
    table: SyncTable,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    recordId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    if (!this.db) throw new Error('SyncEngine not initialized');

    const entry: OutboxEntry = {
      table,
      operation,
      recordId,
      data,
      timestamp: Date.now(),
      synced: false,
      retries: 0,
    };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(OUTBOX_STORE, 'readwrite');
      const store = tx.objectStore(OUTBOX_STORE);
      const request = store.add(entry);
      request.onsuccess = () => {
        this.setStatus({
          pending: this.status.pending + 1,
          state: 'pending',
        });
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get all pending mutations
  async getPendingMutations(): Promise<OutboxEntry[]> {
    if (!this.db) throw new Error('SyncEngine not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(OUTBOX_STORE, 'readonly');
      const store = tx.objectStore(OUTBOX_STORE);
      const index = store.index('synced');
      const request = index.getAll(IDBKeyRange.only(0));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Mark entry as synced
  async markSynced(id: number): Promise<void> {
    if (!this.db) throw new Error('SyncEngine not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(OUTBOX_STORE, 'readwrite');
      const store = tx.objectStore(OUTBOX_STORE);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const entry = getReq.result;
        if (entry) {
          entry.synced = true;
          store.put(entry);
        }
      };
      tx.oncomplete = () => {
        this.setStatus({ pending: this.status.pending - 1 });
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // Mark entry as failed with error
  async markFailed(id: number, error: string): Promise<void> {
    if (!this.db) throw new Error('SyncEngine not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(OUTBOX_STORE, 'readwrite');
      const store = tx.objectStore(OUTBOX_STORE);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const entry = getReq.result;
        if (entry) {
          entry.retries += 1;
          entry.error = error;
          store.put(entry);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Clear all synced entries (cleanup)
  async clearSynced(): Promise<void> {
    if (!this.db) throw new Error('SyncEngine not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(OUTBOX_STORE, 'readwrite');
      const store = tx.objectStore(OUTBOX_STORE);
      const index = store.index('synced');
      const request = index.openCursor(IDBKeyRange.only(1));
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Sync pending mutations to server
  async syncToServer(): Promise<SyncResult> {
    if (this.syncInProgress) return { success: false, reason: 'already_syncing' };
    this.syncInProgress = true;
    this.setStatus({ state: 'syncing' });

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    try {
      const pending = await this.getPendingMutations();

      if (pending.length === 0) {
        this.setStatus({ state: 'idle' });
        return result;
      }

      // Batch sync — send all mutations in one request
      const batchSize = 50;
      for (let i = 0; i < pending.length; i += batchSize) {
        const batch = pending.slice(i, i + batchSize);

        try {
          const response = await fetch('/api/sync/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mutations: batch.map((b) => ({
                table: b.table,
                operation: b.operation,
                recordId: b.recordId,
                data: b.data,
                timestamp: b.timestamp,
              })),
            }),
          });

          if (!response.ok) {
            throw new Error(`Sync failed: ${response.status}`);
          }

          const syncResult = await response.json();

          // Mark each entry as synced
          for (const entry of batch) {
            await this.markSynced(entry.id!);
            result.synced++;
          }

          // Update last sync time
          await this.setMeta('lastSyncTime', new Date().toISOString());
          this.setStatus({
            lastSync: new Date(),
            state: 'idle',
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);

          // Mark entries as failed if retries exceeded
          for (const entry of batch) {
            if (entry.retries >= 3) {
              result.failed++;
              result.errors.push({ id: entry.id!, error: errorMsg });
            } else {
              await this.markFailed(entry.id!, errorMsg);
            }
          }
        }
      }
    } finally {
      this.syncInProgress = false;
      this.setStatus({ state: result.failed > 0 ? 'error' : 'idle' });
    }

    return result;
  }

  // Pull latest data from server
  async pullFromServer(): Promise<void> {
    const lastSync = await this.getMeta('lastSyncTime');

    const response = await fetch(
      `/api/sync/pull?since=${lastSync || '2024-01-01T00:00:00Z'}`,
      { method: 'GET' }
    );

    if (!response.ok) throw new Error(`Pull failed: ${response.status}`);

    const data = await response.json();

    // Apply server changes to IndexedDB
    // This is handled by the offline-store which has its own IndexedDB
    // We just need to update the last sync time
    await this.setMeta('lastSyncTime', new Date().toISOString());
    this.setStatus({ lastSync: new Date() });
  }

  // Full bidirectional sync
  async fullSync(): Promise<SyncResult> {
    try {
      // Push local changes first
      const pushResult = await this.syncToServer();

      // Then pull remote changes
      await this.pullFromServer();

      // Cleanup old synced entries
      await this.clearSynced();

      return pushResult;
    } catch (err) {
      this.setStatus({ state: 'error' });
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: [{ id: 0, error: String(err) }],
      };
    }
  }

  // Meta store helpers
  private async getMeta(key: string): Promise<string | null> {
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db!.transaction(META_STORE, 'readonly');
      const store = tx.objectStore(META_STORE);
      const request = store.get(key);
      request.onsuccess = () =>
        resolve(request.result ? request.result.value : null);
      request.onerror = () => resolve(null);
    });
  }

  private async setMeta(key: string, value: string): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(META_STORE, 'readwrite');
      const store = tx.objectStore(META_STORE);
      store.put({ key, value } as SyncMeta);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Clean up old failed entries (older than 7 days)
  async cleanupOldEntries(): Promise<number> {
    if (!this.db) return 0;

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let deleted = 0;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(OUTBOX_STORE, 'readwrite');
      const store = tx.objectStore(OUTBOX_STORE);
      const index = store.index('timestamp');
      const request = index.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          if (cursor.value.retries >= 3 && cursor.value.timestamp < sevenDaysAgo) {
            cursor.delete();
            deleted++;
          }
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve(deleted);
      tx.onerror = () => reject(tx.error);
    });
  }
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'pending' | 'error';
  pending: number;
  lastSync: Date | null;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: Array<{ id: number; error: string }>;
  reason?: string;
}

// Singleton
let instance: SyncEngine | null = null;

export async function getSyncEngine(): Promise<SyncEngine> {
  if (!instance) {
    instance = new SyncEngine();
    await instance.init();
  }
  return instance;
}

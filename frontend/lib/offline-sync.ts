import { api } from "./api";
import {
  enqueue,
  getPendingItems,
  markSyncing,
  markSynced,
  markFailed,
  cacheProducts,
  cacheCustomers,
  cacheSettings,
  cacheSalesmen,
  type OfflineProduct,
  type OfflineCustomer,
  type OfflineSettings,
  type OfflineSalesman,
} from "./offline-store";

let isSyncing = false;

export function startSyncLoop() {
  if (typeof window === "undefined") return;

  // Sync when coming online
  window.addEventListener("online", () => {
    setTimeout(syncOutbox, 1000);
  });

  // Periodic sync attempt every 30s when online
  setInterval(() => {
    if (navigator.onLine && !isSyncing) {
      syncOutbox();
    }
  }, 30_000);

  // Initial sync on load
  if (navigator.onLine) {
    setTimeout(syncOutbox, 2000);
  }
}

export async function syncOutbox(): Promise<number> {
  if (isSyncing || !navigator.onLine) return 0;
  isSyncing = true;

  let synced = 0;
  try {
    const items = await getPendingItems();
    for (const item of items) {
      if (item.retries >= 5) {
        await markFailed(item.id, "Max retries exceeded");
        continue;
      }
      try {
        await markSyncing(item.id);
        const payload = item.payload as {
          method: string;
          path: string;
          body?: unknown;
        };

        switch (payload.method) {
          case "POST":
            await api.post(payload.path, payload.body);
            break;
          case "PUT":
            await api.put(payload.path, payload.body);
            break;
          case "DELETE":
            await api.delete(payload.path);
            break;
        }

        await markSynced(item.id);
        synced++;

        // Notify UI
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("outbox-synced", { detail: { id: item.id, type: item.type } }));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Sync failed";
        await markFailed(item.id, msg);
      }
    }
  } finally {
    isSyncing = false;
  }
  return synced;
}

export async function syncDataFromServer(): Promise<void> {
  if (!navigator.onLine) return;

  try {
    const [products, customers, settings, salesmen] = await Promise.all([
      api.get<OfflineProduct[]>("/products"),
      api.get<OfflineCustomer[]>("/customers"),
      api.get<OfflineSettings>("/settings"),
      api.get<OfflineSalesman[]>("/salesmen"),
    ]);

    await Promise.all([
      cacheProducts(products),
      cacheCustomers(customers),
      cacheSettings(settings),
      cacheSalesmen(salesmen),
    ]);
  } catch {
    // Silent fail — will retry on next connect
  }
}

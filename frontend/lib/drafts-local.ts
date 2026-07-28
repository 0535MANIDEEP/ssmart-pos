import { openDB, type IDBPDatabase } from "idb";
import type { DraftBill } from "./drafts";

const DB_NAME = "ssmart-pos-drafts";
const STORE = "drafts";

async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    },
  });
}

export async function saveDraftLocal(draft: DraftBill): Promise<void> {
  const db = await getDb();
  await db.put(STORE, draft);
}

export async function loadDraftsLocal(): Promise<DraftBill[]> {
  const db = await getDb();
  return db.getAll(STORE);
}

export async function deleteDraftLocal(id: number): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}

if (typeof navigator !== "undefined" && navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

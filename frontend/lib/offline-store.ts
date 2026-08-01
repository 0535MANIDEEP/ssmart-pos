import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "ssmart-pos-offline";
const DB_VERSION = 2;

export interface OfflineProduct {
  id: number;
  barcode: string;
  name: string;
  category: string | null;
  hsn: string | null;
  unit: string | null;
  purchasePrice: number;
  mrp: number;
  sellingPrice: number;
  taxRate: number;
  discountType: string | null;
  discountValue: number;
  stock: number;
  minStock: number;
  expiryDate: string | null;
  batchNumber: string | null;
  isBulk: boolean;
  bulkProductId: number | null;
  packSize: number | null;
  rateA: number | null;
  rateB: number | null;
  rateC: number | null;
  updatedAt: string;
}

export interface OfflineCustomer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  loyaltyPoints: number;
  totalDue: number;
  creditBalance: number;
  rateTier: string;
  createdAt: string;
}

export interface OfflineSettings {
  id: number;
  shopName: string;
  shopAddress: string | null;
  shopCity: string | null;
  shopState: string | null;
  shopPincode: string | null;
  shopPhone: string | null;
  shopEmail: string | null;
  gstin: string | null;
  pan: string | null;
  currencySymbol: string;
  gstEnabled: boolean;
  loyaltyEnabled: boolean;
  loyaltyRate: number;
  pointValue: number;
  autoPrintReceipt: boolean;
  autoPrintMethod: string | null;
  updatedAt: string;
}

export interface OfflineSalesman {
  id: number;
  name: string;
  code: string;
  active: boolean;
}

export interface OfflineInvoice {
  id: number;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string | null;
  salesmanId: number | null;
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  loyaltyDiscount: number;
  refundValue: number;
  previousDuePaid: number;
  createdAt: string;
  synced: boolean;
}

export interface OutboxItem {
  id: string;
  type: "invoice" | "product-update" | "customer-update" | "return";
  payload: unknown;
  createdAt: string;
  retries: number;
  status: "pending" | "syncing" | "failed";
  error?: string;
}

type StoreNames = "products" | "customers" | "settings" | "salesmen" | "invoices" | "outbox";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, _oldVersion, _newVersion, transaction) {
        // Products store
        if (!db.objectStoreNames.contains("products")) {
          const productStore = db.createObjectStore("products", { keyPath: "id" });
          productStore.createIndex("barcode", "barcode", { unique: false });
          productStore.createIndex("category", "category", { unique: false });
          productStore.createIndex("name", "name", { unique: false });
        }

        // Customers store
        if (!db.objectStoreNames.contains("customers")) {
          const customerStore = db.createObjectStore("customers", { keyPath: "id" });
          customerStore.createIndex("phone", "phone", { unique: false });
        }

        // Settings store (single record)
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "id" });
        }

        // Salesmen store
        if (!db.objectStoreNames.contains("salesmen")) {
          db.createObjectStore("salesmen", { keyPath: "id" });
        }

        // Invoices store (for offline-created invoices)
        if (!db.objectStoreNames.contains("invoices")) {
          const invoiceStore = db.createObjectStore("invoices", { keyPath: "id" });
          invoiceStore.createIndex("synced", "synced", { unique: false });
          invoiceStore.createIndex("createdAt", "createdAt", { unique: false });
        }

        // Outbox store (queued mutations)
        if (!db.objectStoreNames.contains("outbox")) {
          const outboxStore = db.createObjectStore("outbox", { keyPath: "id" });
          outboxStore.createIndex("status", "status", { unique: false });
          outboxStore.createIndex("type", "type", { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

// ─── Products ───────────────────────────────────────────────────────────────

export async function cacheProducts(products: OfflineProduct[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("products", "readwrite");
  const store = tx.objectStore("products");
  await store.clear();
  for (const p of products) {
    await store.put(p);
  }
  await tx.done;
}

export async function getProductByBarcode(barcode: string): Promise<OfflineProduct | undefined> {
  const db = await getDb();
  const all = await db.getAllFromIndex("products", "barcode", barcode);
  return all[0];
}

export async function searchProductsLocal(query: string, category?: string): Promise<OfflineProduct[]> {
  const db = await getDb();
  let products = await db.getAll("products");
  if (category) {
    products = products.filter((p) => p.category === category);
  }
  if (query) {
    const q = query.toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        (p.hsn && p.hsn.toLowerCase().includes(q))
    );
  }
  return products;
}

export async function getAllProducts(): Promise<OfflineProduct[]> {
  const db = await getDb();
  return db.getAll("products");
}

export async function updateProductStock(productId: number, delta: number): Promise<void> {
  const db = await getDb();
  const product = await db.get("products", productId);
  if (product) {
    product.stock = Math.max(0, product.stock + delta);
    await db.put("products", product);
  }
}

// ─── Customers ──────────────────────────────────────────────────────────────

export async function cacheCustomers(customers: OfflineCustomer[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("customers", "readwrite");
  await tx.objectStore("customers").clear();
  for (const c of customers) {
    await tx.objectStore("customers").put(c);
  }
  await tx.done;
}

export async function findCustomerByPhone(phone: string): Promise<OfflineCustomer | undefined> {
  const db = await getDb();
  const all = await db.getAllFromIndex("customers", "phone", phone);
  return all[0];
}

export async function getAllCustomers(): Promise<OfflineCustomer[]> {
  const db = await getDb();
  return db.getAll("customers");
}

// ─── Settings ───────────────────────────────────────────────────────────────

export async function cacheSettings(settings: OfflineSettings): Promise<void> {
  const db = await getDb();
  await db.put("settings", { ...settings, id: 1 });
}

export async function getSettings(): Promise<OfflineSettings | undefined> {
  const db = await getDb();
  return db.get("settings", 1);
}

// ─── Salesmen ───────────────────────────────────────────────────────────────

export async function cacheSalesmen(salesmen: OfflineSalesman[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("salesmen", "readwrite");
  await tx.objectStore("salesmen").clear();
  for (const s of salesmen) {
    await tx.objectStore("salesmen").put(s);
  }
  await tx.done;
}

export async function getAllSalesmen(): Promise<OfflineSalesman[]> {
  const db = await getDb();
  return db.getAll("salesmen");
}

// ─── Invoices ───────────────────────────────────────────────────────────────

export async function saveOfflineInvoice(invoice: OfflineInvoice): Promise<void> {
  const db = await getDb();
  await db.put("invoices", invoice);
}

export async function getUnsyncedInvoices(): Promise<OfflineInvoice[]> {
  const db = await getDb();
  const all = await db.getAll("invoices");
  return all.filter((inv) => !inv.synced);
}

export async function markInvoiceSynced(id: number): Promise<void> {
  const db = await getDb();
  const invoice = await db.get("invoices", id);
  if (invoice) {
    invoice.synced = true;
    await db.put("invoices", invoice);
  }
}

// ─── Outbox (Offline Queue) ────────────────────────────────────────────────

export async function enqueue(item: Omit<OutboxItem, "id" | "createdAt" | "retries" | "status"> & { id?: string }): Promise<string> {
  const db = await getDb();
  const id = item.id || `outbox_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const entry: OutboxItem = {
    ...item,
    id,
    createdAt: new Date().toISOString(),
    retries: 0,
    status: "pending",
  };
  await db.put("outbox", entry);
  return id;
}

export async function getPendingItems(): Promise<OutboxItem[]> {
  const db = await getDb();
  const all = await db.getAll("outbox");
  return all.filter((i) => i.status === "pending" || i.status === "failed");
}

export async function markSyncing(id: string): Promise<void> {
  const db = await getDb();
  const item = await db.get("outbox", id);
  if (item) {
    item.status = "syncing";
    await db.put("outbox", item);
  }
}

export async function markSynced(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("outbox", id);
}

export async function markFailed(id: string, error: string): Promise<void> {
  const db = await getDb();
  const item = await db.get("outbox", id);
  if (item) {
    item.status = "failed";
    item.retries += 1;
    item.error = error;
    await db.put("outbox", item);
  }
}

export async function getOutboxCount(): Promise<number> {
  const db = await getDb();
  const all = await db.getAll("outbox");
  return all.filter((i) => i.status === "pending" || i.status === "failed").length;
}

// ─── Storage Persistence ────────────────────────────────────────────────────

if (typeof navigator !== "undefined" && navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

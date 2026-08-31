import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type CatalogProduct = {
  variantId: string;
  productId: string;
  designation: string;
  reference: string;
  codeBarres: string | null;
  unite: string;
  tauxTaxe: number;
  suiviStock: boolean;
  prixVente: number;
  prixPlancher: number | null;
};

export type QueuedSaleLine = {
  variantId: string;
  quantite: number;
  prixUnitaire: number;
  remise?: number;
};

export type QueuedSalePayment = {
  mode: "ESPECES" | "MOBILE_MONEY" | "CARTE" | "VIREMENT" | "ARDOISE" | "BON_ACHAT";
  montant: number;
  reference?: string;
};

export type QueuedSaleStatus = "pending" | "syncing" | "applied" | "error";

export type QueuedSale = {
  uuid: string;
  numero: string;
  sessionId: string;
  customerId?: string | null;
  lines: QueuedSaleLine[];
  payments: QueuedSalePayment[];
  clientCreatedAt: string;
  status: QueuedSaleStatus;
};

export type SyncMeta = {
  key: "singleton";
  registerId: string | null;
  registerCode: string | null;
  sessionId: string | null;
  ticketRangeNext: number | null;
  ticketRangeEnd: number | null;
  catalogGeneratedAt: string | null;
};

interface PosDBSchema extends DBSchema {
  catalog_products: { key: string; value: CatalogProduct };
  sales_queue: { key: string; value: QueuedSale; indexes: { "by-status": string } };
  sync_meta: { key: string; value: SyncMeta };
}

const DB_NAME = "tacynt-pos";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PosDBSchema>> | null = null;

function getPosDB() {
  if (!dbPromise) {
    dbPromise = openDB<PosDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("catalog_products", { keyPath: "variantId" });
        const salesQueue = db.createObjectStore("sales_queue", { keyPath: "uuid" });
        salesQueue.createIndex("by-status", "status");
        db.createObjectStore("sync_meta", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

export async function saveCatalog(products: CatalogProduct[]): Promise<void> {
  const db = await getPosDB();
  const tx = db.transaction("catalog_products", "readwrite");
  await tx.store.clear();
  await Promise.all(products.map((p) => tx.store.put(p)));
  await tx.done;
}

export async function getCatalog(): Promise<CatalogProduct[]> {
  const db = await getPosDB();
  return db.getAll("catalog_products");
}

export async function enqueueSale(sale: QueuedSale): Promise<void> {
  const db = await getPosDB();
  await db.put("sales_queue", sale);
}

export async function getPendingSales(): Promise<QueuedSale[]> {
  const db = await getPosDB();
  return db.getAllFromIndex("sales_queue", "by-status", "pending");
}

export async function getAllQueuedSales(): Promise<QueuedSale[]> {
  const db = await getPosDB();
  return db.getAll("sales_queue");
}

export async function markSaleStatus(uuid: string, status: QueuedSaleStatus): Promise<void> {
  const db = await getPosDB();
  const sale = await db.get("sales_queue", uuid);
  if (!sale) return;
  sale.status = status;
  await db.put("sales_queue", sale);
}

export async function removeSale(uuid: string): Promise<void> {
  const db = await getPosDB();
  await db.delete("sales_queue", uuid);
}

const DEFAULT_SYNC_META: SyncMeta = {
  key: "singleton",
  registerId: null,
  registerCode: null,
  sessionId: null,
  ticketRangeNext: null,
  ticketRangeEnd: null,
  catalogGeneratedAt: null,
};

export async function getSyncMeta(): Promise<SyncMeta> {
  const db = await getPosDB();
  const meta = await db.get("sync_meta", "singleton");
  return meta ?? DEFAULT_SYNC_META;
}

export async function setSyncMeta(patch: Partial<SyncMeta>): Promise<void> {
  const db = await getPosDB();
  const current = await getSyncMeta();
  await db.put("sync_meta", { ...current, ...patch });
}

export async function countPendingSales(): Promise<number> {
  const db = await getPosDB();
  return db.countFromIndex("sales_queue", "by-status", "pending");
}

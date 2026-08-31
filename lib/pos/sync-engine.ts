import {
  countPendingSales,
  enqueueSale,
  getPendingSales,
  getSyncMeta,
  markSaleStatus,
  removeSale,
  saveCatalog,
  setSyncMeta,
  type QueuedSale,
  type QueuedSaleLine,
  type QueuedSalePayment,
} from "./db";

const TICKET_RANGE_LOW_WATERMARK = 20;

// Mutex anti-double-envoi : la synchro reste in-page (intervalle + événement
// `online` + bouton manuel), pas l'API Background Sync — support navigateur
// trop inégal (absent de Safari) pour une logique métier critique.
let flushing = false;

export async function loadCatalogFromServer(): Promise<number> {
  const res = await fetch("/api/pos/catalog");
  if (!res.ok) throw new Error("Impossible de charger le catalogue.");
  const data = (await res.json()) as {
    generatedAt: string;
    products: Parameters<typeof saveCatalog>[0];
  };
  await saveCatalog(data.products);
  await setSyncMeta({ catalogGeneratedAt: data.generatedAt });
  return data.products.length;
}

export async function openCashSession(
  registerId: string,
  registerCode: string,
  fondInitial: number,
): Promise<string> {
  const res = await fetch("/api/pos/sessions/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registerId, fondInitial }),
  });
  if (!res.ok) throw new Error("Impossible d'ouvrir la session de caisse.");
  const data = (await res.json()) as { sessionId: string };
  await setSyncMeta({ registerId, registerCode, sessionId: data.sessionId });

  // Pré-allocation immédiate, pendant qu'on est encore en ligne : sans ça,
  // une caisse qui passe hors ligne avant sa première vente n'aurait aucun
  // numéro de ticket disponible (cahier des charges 7.3, point 1 : "au
  // démarrage de la caisse", pas à la première vente).
  await ensureTicketRange(registerId);

  return data.sessionId;
}

async function ensureTicketRange(registerId: string): Promise<void> {
  const meta = await getSyncMeta();
  const remaining =
    meta.ticketRangeNext !== null && meta.ticketRangeEnd !== null
      ? meta.ticketRangeEnd - meta.ticketRangeNext + 1
      : 0;

  if (remaining > TICKET_RANGE_LOW_WATERMARK) return;
  // Hors ligne : impossible de réallouer, on continue avec ce qu'il reste
  // (la caisse alerte de façon bloquante si elle tombe à sec — voir 7.3).
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  const res = await fetch(`/api/pos/registers/${registerId}/ticket-range`, { method: "POST" });
  if (!res.ok) return;
  const range = (await res.json()) as { rangeStart: number; rangeEnd: number };
  await setSyncMeta({ ticketRangeNext: range.rangeStart, ticketRangeEnd: range.rangeEnd });
}

export async function createLocalSale(params: {
  lines: QueuedSaleLine[];
  payments: QueuedSalePayment[];
}): Promise<QueuedSale> {
  const meta = await getSyncMeta();
  if (!meta.registerId) throw new Error("Aucun poste de caisse actif.");

  await ensureTicketRange(meta.registerId);
  const fresh = await getSyncMeta();

  if (fresh.ticketRangeNext === null || fresh.sessionId === null) {
    throw new Error("Caisse non initialisée (plage de tickets ou session manquante).");
  }

  const numero = `${fresh.registerCode}-${String(fresh.ticketRangeNext).padStart(6, "0")}`;
  await setSyncMeta({ ticketRangeNext: fresh.ticketRangeNext + 1 });

  const sale: QueuedSale = {
    uuid: crypto.randomUUID(),
    numero,
    sessionId: fresh.sessionId,
    lines: params.lines,
    payments: params.payments,
    clientCreatedAt: new Date().toISOString(),
    status: "pending",
  };

  await enqueueSale(sale);
  void flushQueue(); // best-effort immédiat ; la boucle périodique reprendra sinon
  return sale;
}

export type FlushSummary = {
  attempted: number;
  applied: number;
  duplicates: number;
  errors: number;
  stockAlerts: number;
};

export async function flushQueue(): Promise<FlushSummary | null> {
  if (flushing) return null;
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;

  flushing = true;
  try {
    const pending = await getPendingSales();
    if (pending.length === 0) {
      return { attempted: 0, applied: 0, duplicates: 0, errors: 0, stockAlerts: 0 };
    }

    for (const sale of pending) {
      await markSaleStatus(sale.uuid, "syncing");
    }

    const res = await fetch("/api/pos/sync/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sales: pending }),
    });

    if (!res.ok) {
      for (const sale of pending) {
        await markSaleStatus(sale.uuid, "pending");
      }
      return {
        attempted: pending.length,
        applied: 0,
        duplicates: 0,
        errors: pending.length,
        stockAlerts: 0,
      };
    }

    const { results } = (await res.json()) as {
      results: { uuid: string; status: string; stockAlert?: boolean }[];
    };

    const summary: FlushSummary = {
      attempted: pending.length,
      applied: 0,
      duplicates: 0,
      errors: 0,
      stockAlerts: 0,
    };

    for (const result of results) {
      if (result.status === "applied" || result.status === "duplicate") {
        await removeSale(result.uuid);
        if (result.status === "applied") summary.applied += 1;
        else summary.duplicates += 1;
        if (result.stockAlert) summary.stockAlerts += 1;
      } else {
        await markSaleStatus(result.uuid, "error");
        summary.errors += 1;
      }
    }

    return summary;
  } finally {
    flushing = false;
  }
}

export function startSyncLoop(intervalMs = 15000): () => void {
  const onOnline = () => void flushQueue();
  window.addEventListener("online", onOnline);
  const interval = setInterval(() => void flushQueue(), intervalMs);

  return () => {
    window.removeEventListener("online", onOnline);
    clearInterval(interval);
  };
}

export { countPendingSales };

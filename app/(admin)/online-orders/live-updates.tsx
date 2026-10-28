"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { toastManager } from "@/lib/toast";

const POLL_INTERVAL_MS = 10000;

// Même patron que lib/pos/sync-engine.ts (startSyncLoop) : setInterval +
// nettoyage au démontage. lastSeen en ref, jamais resynchronisé depuis
// latestOrderCreatedAt à chaque rendu — sinon un router.refresh() qui
// remonte ce composant avec la même prop perdrait le fil entre deux polls.
export function LiveUpdates({ latestOrderCreatedAt }: { latestOrderCreatedAt: string | null }) {
  const router = useRouter();
  // Pas de commande du tout pour l'instant : on part de "maintenant" plutôt
  // que de rester bloqué sur null indéfiniment — sinon la toute première
  // commande jamais reçue ne serait jamais détectée.
  const lastSeenRef = useRef(latestOrderCreatedAt ?? new Date().toISOString());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(
          `/api/online-orders/poll?after=${encodeURIComponent(lastSeenRef.current)}`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          orders: { id: string; numero: string; nomClient: string; totalTtcLabel: string; createdAt: string }[];
        };
        if (data.orders.length === 0) return;

        for (const order of data.orders) {
          toastManager.add({
            title: "Nouvelle commande",
            description: `${order.numero} — ${order.nomClient} — ${order.totalTtcLabel}`,
          });
        }
        lastSeenRef.current = data.orders[data.orders.length - 1].createdAt;
        router.refresh();
      } catch {
        // Hors ligne/erreur réseau ponctuelle — retenté au prochain intervalle.
      }
    }

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [router]);

  return null;
}

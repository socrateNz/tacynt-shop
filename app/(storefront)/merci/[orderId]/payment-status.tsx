"use client";

import { useEffect, useRef, useState } from "react";

type PaymentStatut = "INITIE" | "EN_ATTENTE" | "REUSSI" | "ECHEC" | "EXPIRE";

const TERMINAL = new Set<PaymentStatut>(["REUSSI", "ECHEC", "EXPIRE"]);
const POLL_INTERVAL_MS = 3000;

export function PaymentStatus({
  orderId,
  orderConfirmee,
  statutInitial,
}: {
  orderId: string;
  orderConfirmee: boolean;
  statutInitial: PaymentStatut | null;
}) {
  const [confirmee, setConfirmee] = useState(orderConfirmee);
  const [statut, setStatut] = useState<PaymentStatut | null>(statutInitial);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (confirmee || (statut && TERMINAL.has(statut))) return;

    async function poll() {
      try {
        const res = await fetch(`/api/storefront/payments/status?orderId=${orderId}`);
        const body = (await res.json()) as {
          orderStatut?: string;
          paiement?: { statut: PaymentStatut } | null;
        };
        if (body.orderStatut === "CONFIRMEE") {
          setConfirmee(true);
        }
        if (body.paiement) {
          setStatut(body.paiement.statut);
        }
      } catch {
        // Une panne réseau côté client ne doit pas arrêter le suivi, on
        // réessaiera au prochain intervalle.
      }
    }

    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [orderId, confirmee, statut]);

  async function retryPayment() {
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch("/api/storefront/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setRetryError(body.error ?? "Échec du démarrage du paiement.");
        return;
      }
      window.location.assign(body.url);
    } finally {
      setRetrying(false);
    }
  }

  if (confirmee) {
    return (
      <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
        Paiement reçu — commande confirmée.
      </p>
    );
  }

  if (statut === "ECHEC" || statut === "EXPIRE") {
    return (
      <div className="flex flex-col gap-2">
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {statut === "EXPIRE" ? "La session de paiement a expiré." : "Le paiement a échoué."}
        </p>
        {retryError && <p className="text-sm text-destructive">{retryError}</p>}
        <button
          type="button"
          onClick={retryPayment}
          disabled={retrying}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {retrying ? "Connexion à Codees..." : "Réessayer le paiement"}
        </button>
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      En attente de la confirmation du paiement...
    </p>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/money";

import { useCart } from "../../cart-context";

export function CheckoutForm({ devise }: { devise: string }) {
  const router = useRouter();
  const { cart, loaded, total, clear, emballageUnitPrice, emballageTotal } = useCart();
  const [modeRetrait, setModeRetrait] = useState<"RETRAIT_BOUTIQUE" | "LIVRAISON">("RETRAIT_BOUTIQUE");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [paiementEnLigneActif, setPaiementEnLigneActif] = useState<boolean | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  // Le paiement en ligne est décidé boutique par boutique (Shop côté
  // serveur) — le shopId du panier ne vit que côté client (localStorage),
  // donc on l'interroge au montage plutôt que de le recevoir en props.
  useEffect(() => {
    if (!cart?.shopId) return;
    let cancelled = false;
    fetch(`/api/storefront/shops/${cart.shopId}`)
      .then((res) => res.json())
      .then((data: { paiementEnLigneActif?: boolean }) => {
        if (!cancelled) setPaiementEnLigneActif(Boolean(data.paiementEnLigneActif));
      })
      .catch(() => {
        if (!cancelled) setPaiementEnLigneActif(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cart?.shopId]);

  async function startPayment(orderId: string) {
    setPending(true);
    try {
      const res = await fetch("/api/storefront/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setError(body.error ?? "Échec du démarrage du paiement.");
        setPendingOrderId(orderId);
        return;
      }
      window.location.assign(body.url);
    } finally {
      setPending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!cart || cart.items.length === 0) return;
    setError(null);
    setPending(true);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/storefront/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: cart.shopId,
          nomClient: formData.get("nomClient"),
          telephoneClient: formData.get("telephoneClient"),
          emailClient: formData.get("emailClient"),
          modeRetrait,
          adresseLivraison: formData.get("adresseLivraison"),
          notes: formData.get("notes"),
          lines: cart.items.map((i) => ({ variantId: i.variantId, quantite: i.quantite })),
          emballageQuantite: cart.emballageQuantite,
        }),
      });
      const body = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !body.id) {
        setError(body.error ?? "Échec de la commande.");
        return;
      }
      clear();

      if (paiementEnLigneActif) {
        setPendingOrderId(body.id);
        await startPayment(body.id);
        return;
      }

      router.push(`/merci/${body.id}`);
    } finally {
      setPending(false);
    }
  }

  if (!loaded) return null;

  // Commande déjà créée mais le démarrage du paiement a échoué (panne
  // Codees, etc.) : on ne recrée jamais la commande, on relance seulement le
  // paiement sur l'id déjà connu.
  if (pendingOrderId) {
    return (
      <div className="flex flex-col gap-4">
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Votre commande est enregistrée, mais le paiement en ligne n&apos;a pas pu démarrer.
        </p>
        <Button onClick={() => startPayment(pendingOrderId)} disabled={pending}>
          {pending ? "Connexion à Codees..." : "Réessayer le paiement"}
        </Button>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Votre panier est vide.</p>
        <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Retour au catalogue
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">Récapitulatif</p>
        <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
          {cart.items.map((i) => (
            <li key={i.variantId}>
              {i.quantite} {i.unite} × {i.designation} — {formatMoney(i.prixVente * i.quantite, devise)}
            </li>
          ))}
          {cart.emballageQuantite > 0 && emballageUnitPrice > 0 && (
            <li>
              {cart.emballageQuantite} emballage(s) × {formatMoney(emballageUnitPrice, devise)} —{" "}
              {formatMoney(emballageTotal, devise)}
            </li>
          )}
        </ul>
        <p className="num mt-2 text-lg font-semibold text-foreground">
          Total : {formatMoney(total, devise)}
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nomClient">Nom</Label>
        <Input id="nomClient" name="nomClient" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="telephoneClient">Téléphone</Label>
        <Input id="telephoneClient" name="telephoneClient" required />
      </div>

      {paiementEnLigneActif && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="emailClient">Email (requis pour le paiement en ligne)</Label>
          <Input id="emailClient" name="emailClient" type="email" required />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="modeRetrait">Mode de retrait</Label>
        <select
          id="modeRetrait"
          name="modeRetrait"
          value={modeRetrait}
          onChange={(e) => setModeRetrait(e.target.value as typeof modeRetrait)}
          className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
        >
          <option value="RETRAIT_BOUTIQUE">Retrait en boutique</option>
          <option value="LIVRAISON">Livraison</option>
        </select>
      </div>

      {modeRetrait === "LIVRAISON" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="adresseLivraison">Adresse de livraison</Label>
          <Input id="adresseLivraison" name="adresseLivraison" required />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes (optionnel)</Label>
        <Input id="notes" name="notes" />
      </div>

      <p className="text-xs text-muted-foreground">
        {paiementEnLigneActif
          ? "Paiement en ligne requis (Orange Money / MTN MoMo) — vous serez redirigé(e) vers la page de paiement."
          : "Paiement à la réception (espèces, Mobile Money, carte) — aucun paiement en ligne requis."}
      </p>

      <Button type="submit" disabled={pending}>
        {pending ? "Envoi..." : paiementEnLigneActif ? "Payer maintenant" : "Confirmer la commande"}
      </Button>
    </form>
  );
}

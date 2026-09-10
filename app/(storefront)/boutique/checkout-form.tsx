"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/money";

import { cartTotal, clearCart, getCart, type Cart } from "../cart";

export function CheckoutForm({ devise }: { devise: string }) {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [modeRetrait, setModeRetrait] = useState<"RETRAIT_BOUTIQUE" | "LIVRAISON">("RETRAIT_BOUTIQUE");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // Même pattern que cart-view.tsx / pos-client.tsx : lecture localStorage
    // dans un callback, pas en synchrone dans le corps de l'effet.
    (async () => {
      setCart(getCart());
      setLoaded(true);
    })();
  }, []);

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
          modeRetrait,
          adresseLivraison: formData.get("adresseLivraison"),
          notes: formData.get("notes"),
          lines: cart.items.map((i) => ({ variantId: i.variantId, quantite: i.quantite })),
        }),
      });
      const body = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !body.id) {
        setError(body.error ?? "Échec de la commande.");
        return;
      }
      clearCart();
      router.push(`/boutique/merci/${body.id}`);
    } finally {
      setPending(false);
    }
  }

  if (!loaded) return null;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Votre panier est vide.</p>
        <Link href="/boutique" className="text-sm text-primary underline-offset-4 hover:underline">
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
              {i.quantite} × {i.designation} — {formatMoney(i.prixVente * i.quantite, devise)}
            </li>
          ))}
        </ul>
        <p className="num mt-2 text-lg font-semibold text-foreground">
          Total : {formatMoney(cartTotal(cart), devise)}
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
        Paiement à la réception (espèces, Mobile Money, carte) — aucun paiement en ligne requis.
      </p>

      <Button type="submit" disabled={pending}>
        {pending ? "Envoi..." : "Confirmer la commande"}
      </Button>
    </form>
  );
}

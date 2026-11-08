"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/money";

import { useCart } from "../../cart-context";

type Provider = "CODEES" | "STRIPE";
type PaymentChoice = "RECEPTION" | Provider;
type PaymentOptions = { online: Provider[]; reception: boolean };
type ShopSettings = {
  paymentOptions?: PaymentOptions;
  deliveryZones?: { id: string; nom: string }[];
  montantMinimumLivraison?: number | null;
};

const CHOICE_LABEL: Record<PaymentChoice, string> = {
  RECEPTION: "Payer à la réception",
  CODEES: "Mobile Money (Orange Money / MTN MoMo)",
  STRIPE: "Carte bancaire",
};

export function CheckoutForm({ devise }: { devise: string }) {
  const router = useRouter();
  const { cart, loaded, total, clear, emballageUnitPrice, emballageTotal } = useCart();
  const [modeRetrait, setModeRetrait] = useState<"RETRAIT_BOUTIQUE" | "LIVRAISON">("RETRAIT_BOUTIQUE");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptions | null>(null);
  const [deliveryZones, setDeliveryZones] = useState<{ id: string; nom: string }[]>([]);
  const [minimumLivraison, setMinimumLivraison] = useState<number | null>(null);
  const [choice, setChoice] = useState<PaymentChoice>("RECEPTION");
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const isOnline = choice !== "RECEPTION";

  // Le paiement en ligne est décidé boutique par boutique (Shop côté
  // serveur) — le shopId du panier ne vit que côté client (localStorage),
  // donc on l'interroge au montage plutôt que de le recevoir en props.
  useEffect(() => {
    if (!cart?.shopId) return;
    let cancelled = false;
    fetch(`/api/storefront/shops/${cart.shopId}`)
      .then((res) => res.json())
      .then((data: ShopSettings) => {
        if (cancelled) return;
        setDeliveryZones(data.deliveryZones ?? []);
        setMinimumLivraison(data.montantMinimumLivraison ?? null);
        const options = data.paymentOptions ?? { online: [], reception: true };
        setPaymentOptions(options);
        // Par défaut : le premier moyen en ligne proposé, sinon la réception.
        setChoice(options.online[0] ?? "RECEPTION");
      })
      .catch(() => {
        if (!cancelled) setPaymentOptions({ online: [], reception: true });
      });
    return () => {
      cancelled = true;
    };
  }, [cart?.shopId]);

  async function startPayment(orderId: string, provider: Provider) {
    setPending(true);
    try {
      const res = await fetch("/api/storefront/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, provider }),
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
          deliveryZoneId: formData.get("deliveryZoneId"),
          lieuDit: formData.get("lieuDit"),
          notes: formData.get("notes"),
          lines: cart.items.map((i) => ({ variantId: i.variantId, quantite: i.quantite })),
          emballageQuantite: cart.emballageQuantite,
          modePaiement: isOnline ? "EN_LIGNE" : "RECEPTION",
        }),
      });
      const body = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !body.id) {
        setError(body.error ?? "Échec de la commande.");
        return;
      }
      clear();

      if (choice !== "RECEPTION") {
        setPendingOrderId(body.id);
        await startPayment(body.id, choice);
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
        <Button onClick={() => startPayment(pendingOrderId, choice === "RECEPTION" ? "STRIPE" : choice)} disabled={pending}>
          {pending ? "Connexion au service de paiement..." : "Réessayer le paiement"}
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
        <ul className="mt-3 flex flex-col gap-3">
          {cart.items.map((i) => (
            <li key={i.variantId} className="flex items-center gap-3">
              {i.productId && i.coverImageId ? (
                // eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable
                <img
                  src={`/api/products/${i.productId}/images/${i.coverImageId}`}
                  alt=""
                  className="size-10 shrink-0 rounded-md border border-border object-cover"
                />
              ) : (
                <div className="size-10 shrink-0 rounded-md border border-dashed border-border" />
              )}
              <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                {i.quantite} {i.unite} × {i.designation}
              </span>
              <span className="num shrink-0 text-sm text-foreground">
                {formatMoney(i.prixVente * i.quantite, devise)}
              </span>
            </li>
          ))}
          {cart.emballageQuantite > 0 && emballageUnitPrice > 0 && (
            <li className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="min-w-0 flex-1">
                {cart.emballageQuantite} emballage(s) × {formatMoney(emballageUnitPrice, devise)}
              </span>
              <span className="num shrink-0 text-foreground">{formatMoney(emballageTotal, devise)}</span>
            </li>
          )}
        </ul>
        <p className="num mt-3 border-t border-border pt-3 text-lg font-semibold text-foreground">
          Total : {formatMoney(total, devise)}
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">Vos informations</p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nomClient">Nom</Label>
          <Input id="nomClient" name="nomClient" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="telephoneClient">Téléphone</Label>
          <Input id="telephoneClient" name="telephoneClient" required />
        </div>

        {isOnline && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emailClient">
              {choice === "CODEES" ? "Email (requis pour le paiement Mobile Money)" : "Email (reçu de paiement)"}
            </Label>
            <Input id="emailClient" name="emailClient" type="email" required={choice === "CODEES"} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">Livraison</p>
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

        {minimumLivraison !== null && (
          <p
            className={
              modeRetrait === "LIVRAISON" && total - emballageTotal < minimumLivraison
                ? "text-sm font-medium text-destructive"
                : "text-xs text-muted-foreground"
            }
          >
            Livraison possible à partir de {formatMoney(minimumLivraison, devise)} d&apos;articles
            {total - emballageTotal < minimumLivraison
              ? ` — il manque ${formatMoney(minimumLivraison - (total - emballageTotal), devise)}.`
              : "."}
          </p>
        )}

        {modeRetrait === "LIVRAISON" && deliveryZones.length > 0 && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deliveryZoneId">Zone de livraison</Label>
              <select
                id="deliveryZoneId"
                name="deliveryZoneId"
                required
                defaultValue=""
                className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
              >
                <option value="" disabled>
                  Choisir une zone desservie…
                </option>
                {deliveryZones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.nom}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lieuDit">Lieu-dit</Label>
              <Input
                id="lieuDit"
                name="lieuDit"
                required
                maxLength={300}
                placeholder="Repère, rue, immeuble, couleur du portail…"
              />
            </div>
          </>
        )}

        {modeRetrait === "LIVRAISON" && deliveryZones.length === 0 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adresseLivraison">Adresse de livraison</Label>
            <Input id="adresseLivraison" name="adresseLivraison" required />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">Notes (optionnel)</Label>
          <Input id="notes" name="notes" />
        </div>
      </div>

      {paymentOptions && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Paiement</p>
          {([...paymentOptions.online, ...(paymentOptions.reception ? ["RECEPTION" as const] : [])] as PaymentChoice[]).map(
            (c) => (
              <label key={c} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name="paymentChoice"
                  value={c}
                  checked={choice === c}
                  onChange={() => setChoice(c)}
                />
                {CHOICE_LABEL[c]}
              </label>
            ),
          )}
          <p className="text-xs text-muted-foreground">
            {isOnline
              ? "Vous serez redirigé(e) vers la page de paiement sécurisée."
              : "Vous payez directement à la boutique, au retrait ou à la livraison."}
          </p>
        </div>
      )}

      <Button type="submit" disabled={pending || !paymentOptions}>
        {pending ? "Envoi..." : isOnline ? "Payer maintenant" : "Confirmer la commande"}
      </Button>
    </form>
  );
}

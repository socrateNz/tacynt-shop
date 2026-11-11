"use client";

import { Settings2 } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updateDeliverySettings, type DeliverySettingsState } from "./actions";

export type ShopDeliverySettings = {
  id: string;
  nom: string;
  livraisonActive: boolean;
  montantMinimumLivraison: number | null;
  livraisonGratuiteActive: boolean;
  montantLivraisonGratuite: number | null;
};

const initialState: DeliverySettingsState = { error: null };

// Paramètres de livraison d'une boutique : activation, panier minimum pour
// être livré, et livraison offerte au-delà d'un montant (case à cocher qui
// fait apparaître le montant).
function ShopSettingsForm({ shop, devise }: { shop: ShopDeliverySettings; devise: string }) {
  const [state, formAction, isPending] = useActionState(updateDeliverySettings, initialState);
  const [livraisonActive, setLivraisonActive] = useState(shop.livraisonActive);
  const [gratuite, setGratuite] = useState(shop.livraisonGratuiteActive);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="shopId" value={shop.id} />

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.saved && !state.error && (
        <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          Paramètres enregistrés.
        </p>
      )}

      <label className="flex items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="livraisonActive"
          checked={livraisonActive}
          onChange={(e) => setLivraisonActive(e.target.checked)}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          <span className="font-medium">Proposer la livraison</span>
          <span className="block text-xs text-muted-foreground">
            Décochée : retrait en boutique uniquement, quelles que soient les zones.
          </span>
        </span>
      </label>

      <fieldset disabled={!livraisonActive} className="flex flex-col gap-4 disabled:opacity-50">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`min-${shop.id}`}>Panier minimum pour être livré ({devise})</Label>
          <Input
            id={`min-${shop.id}`}
            name="montantMinimumLivraison"
            type="number"
            min={0}
            step="1"
            inputMode="decimal"
            placeholder="Aucun minimum"
            defaultValue={shop.montantMinimumLivraison ?? ""}
          />
          <p className="text-xs text-muted-foreground">En dessous, le client ne peut choisir que le retrait.</p>
        </div>

        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="livraisonGratuiteActive"
            checked={gratuite}
            onChange={(e) => setGratuite(e.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            <span className="font-medium">Livraison gratuite à partir d&apos;un montant</span>
            <span className="block text-xs text-muted-foreground">
              Au-delà de ce montant d&apos;articles, les frais de la zone ne sont pas facturés.
            </span>
          </span>
        </label>

        {gratuite && (
          <div className="flex flex-col gap-1.5 pl-6">
            <Label htmlFor={`free-${shop.id}`}>Livraison gratuite dès ({devise})</Label>
            <Input
              id={`free-${shop.id}`}
              name="montantLivraisonGratuite"
              type="number"
              min={1}
              step="1"
              inputMode="decimal"
              required
              placeholder="20000"
              defaultValue={shop.montantLivraisonGratuite ?? ""}
            />
          </div>
        )}
      </fieldset>

      <Button type="submit" className="self-end" disabled={isPending}>
        {isPending ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}

export function DeliverySettingsDialog({ shops, devise }: { shops: ShopDeliverySettings[]; devise: string }) {
  const [shopId, setShopId] = useState(shops[0]?.id ?? "");
  const shop = shops.find((s) => s.id === shopId) ?? shops[0];

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" className="gap-1.5" disabled={shops.length === 0} />}>
        <Settings2 className="size-4" />
        Paramètres de livraison
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Paramètres de livraison</DialogTitle>
        </DialogHeader>
        {shops.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-shop">Boutique</Label>
            <select
              id="settings-shop"
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>
          </div>
        )}
        {/* key : formulaire remis à zéro en changeant de boutique. */}
        {shop && <ShopSettingsForm key={shop.id} shop={shop} devise={devise} />}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { receiveStock, type ReceiveStockState } from "./actions";

const initialState: ReceiveStockState = { error: null };

export function ReceiveStockForm({
  variants,
  showLots,
  showSerial,
}: {
  variants: { id: string; label: string }[];
  showLots: boolean;
  showSerial: boolean;
}) {
  const [state, formAction, isPending] = useActionState(receiveStock, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Réception de stock</h2>

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-3 flex flex-col gap-1.5">
          <Label htmlFor="variantId">Produit</Label>
          <select
            id="variantId"
            name="variantId"
            required
            className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
          >
            <option value="">Sélectionner...</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quantite">Quantité reçue</Label>
          <Input id="quantite" name="quantite" type="number" step="0.001" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="coutUnitaire">Coût unitaire</Label>
          <Input id="coutUnitaire" name="coutUnitaire" type="number" step="0.01" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="motif">Motif / document (optionnel)</Label>
          <Input id="motif" name="motif" placeholder="BR-2026-004" />
        </div>
        {showLots && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lotNumero">N° de lot (si applicable)</Label>
              <Input id="lotNumero" name="lotNumero" placeholder="LOT-2026-04" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="datePeremption">Date de péremption</Label>
              <Input id="datePeremption" name="datePeremption" type="date" />
            </div>
          </>
        )}
      </div>

      {showSerial && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="serialNumbers">
            Numéros de série (si applicable — un par ligne, autant que la quantité reçue)
          </Label>
          <textarea
            id="serialNumbers"
            name="serialNumbers"
            rows={4}
            placeholder={"SN-000123\nSN-000124"}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
          />
        </div>
      )}

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Enregistrement..." : "Enregistrer la réception"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { receiveStock, type ReceiveStockState } from "./actions";

const initialState: ReceiveStockState = { error: null };

export function ReceiveStockForm({ variants }: { variants: { id: string; label: string }[] }) {
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
      </div>

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Enregistrement..." : "Enregistrer la réception"}
      </Button>
    </form>
  );
}

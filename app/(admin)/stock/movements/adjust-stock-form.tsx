"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { adjustStock, type AdjustStockState } from "./actions";

const initialState: AdjustStockState = { error: null };

export function AdjustStockForm({ variants }: { variants: { id: string; label: string }[] }) {
  const [state, formAction, isPending] = useActionState(adjustStock, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">
        Ajustement d&apos;inventaire (comptage, casse, perte)
      </h2>

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-3 flex flex-col gap-1.5">
          <Label htmlFor="adjustVariantId">Produit</Label>
          <select
            id="adjustVariantId"
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
          <Label htmlFor="delta">Écart (+ ou -)</Label>
          <Input id="delta" name="delta" type="number" step="0.001" required placeholder="-2" />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="adjustMotif">Motif (obligatoire)</Label>
          <Input id="adjustMotif" name="motif" required placeholder="Comptage du 31/08" />
        </div>
      </div>

      <Button type="submit" variant="outline" className="self-start" disabled={isPending}>
        {isPending ? "Enregistrement..." : "Enregistrer l'ajustement"}
      </Button>
    </form>
  );
}

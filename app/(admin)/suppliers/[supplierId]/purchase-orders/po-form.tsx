"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createPurchaseOrder, type PurchaseOrderFormState } from "./actions";

const initialState: PurchaseOrderFormState = { error: null };

export function PurchaseOrderForm({
  supplierId,
  products,
}: {
  supplierId: string;
  products: { variantId: string; label: string; prixAchatDernier: number }[];
}) {
  const [state, formAction, isPending] = useActionState(createPurchaseOrder, initialState);
  const [lineCount, setLineCount] = useState(1);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Nouvelle commande</h2>
      <input type="hidden" name="supplierId" value={supplierId} />

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label>Lignes</Label>
        {Array.from({ length: lineCount }).map((_, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>Produit</Label>
              <select
                name="lineVariantId"
                defaultValue=""
                onChange={(e) => {
                  const product = products.find((p) => p.variantId === e.target.value);
                  const priceInput = document.getElementById(`line-prix-${i}`) as HTMLInputElement | null;
                  if (product && priceInput && !priceInput.value) {
                    priceInput.value = String(product.prixAchatDernier);
                  }
                }}
                className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
              >
                <option value="">Sélectionner...</option>
                {products.map((p) => (
                  <option key={p.variantId} value={p.variantId}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex w-24 flex-col gap-1.5">
              <Label>Quantité</Label>
              <Input name="lineQuantite" type="number" step="0.001" />
            </div>
            <div className="flex w-28 flex-col gap-1.5">
              <Label>Prix unitaire</Label>
              <Input id={`line-prix-${i}`} name="linePrixUnitaire" type="number" step="0.01" />
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setLineCount((prev) => prev + 1)}
        >
          + Ajouter une ligne
        </Button>
      </div>

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Création..." : "Créer la commande (brouillon)"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createTransferRequest, type TransferFormState } from "./actions";

const initialState: TransferFormState = { error: null };

export function TransferForm({
  shops,
  variants,
}: {
  shops: { id: string; nom: string }[];
  variants: { id: string; label: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createTransferRequest, initialState);
  const [lineCount, setLineCount] = useState(1);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Nouvelle demande de transfert</h2>

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fromShopId">Boutique émettrice</Label>
          <select
            id="fromShopId"
            name="fromShopId"
            required
            className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
          >
            <option value="">Sélectionner...</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="toShopId">Boutique destinataire</Label>
          <select
            id="toShopId"
            name="toShopId"
            required
            className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
          >
            <option value="">Sélectionner...</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Lignes</Label>
        {Array.from({ length: lineCount }).map((_, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>Produit</Label>
              <select
                name="lineVariantId"
                defaultValue=""
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
            <div className="flex w-24 flex-col gap-1.5">
              <Label>Quantité</Label>
              <Input name="lineQuantite" type="number" step="0.001" />
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
        {isPending ? "Création..." : "Créer la demande"}
      </Button>
    </form>
  );
}

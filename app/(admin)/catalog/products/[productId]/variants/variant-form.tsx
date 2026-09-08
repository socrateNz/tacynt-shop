"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createVariant, type VariantFormState } from "./actions";

const initialState: VariantFormState = { error: null };

export function VariantForm({ productId }: { productId: string }) {
  const [state, formAction, isPending] = useActionState(createVariant, initialState);
  const [attributeRowCount, setAttributeRowCount] = useState(1);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">Nouvelle variante</h2>
      <input type="hidden" name="productId" value={productId} />

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label>Attributs (taille, couleur...)</Label>
        {Array.from({ length: attributeRowCount }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <Input name="attributeName" placeholder="Taille" className="flex-1" />
            <Input name="attributeValue" placeholder="M" className="flex-1" />
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setAttributeRowCount((prev) => prev + 1)}
        >
          + Ajouter un attribut
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="codeBarres">Code-barres</Label>
          <Input id="codeBarres" name="codeBarres" placeholder="EAN/UPC" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prixAchatRef">Prix d&apos;achat de référence</Label>
          <Input id="prixAchatRef" name="prixAchatRef" type="number" step="0.01" defaultValue="0" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prixVente">Prix de vente</Label>
          <Input id="prixVente" name="prixVente" type="number" step="0.01" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prixPlancher">Prix plancher (optionnel)</Label>
          <Input id="prixPlancher" name="prixPlancher" type="number" step="0.01" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="seuilAlerte">Seuil d&apos;alerte de stock</Label>
          <Input id="seuilAlerte" name="seuilAlerte" type="number" />
        </div>
      </div>

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Création..." : "Créer la variante"}
      </Button>
    </form>
  );
}

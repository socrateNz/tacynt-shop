"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createVariant, updateVariant, type VariantFormState } from "./variant-actions";
import { UnitCombobox } from "./unit-combobox";

const initialState: VariantFormState = { error: null };

export type VariantEditValues = {
  id: string;
  attributs: { name: string; value: string }[];
  codeBarres: string | null;
  prixAchatRef: number;
  unite: string;
  uniteQuantite: number;
  prixVente: number;
  prixPlancher: number | null;
  seuilAlerte: number | null;
};

export function VariantForm({
  productId,
  variant,
  onSuccess,
}: {
  productId?: string;
  variant?: VariantEditValues;
  onSuccess?: () => void;
}) {
  const isEdit = variant !== undefined;
  const [state, formAction, isPending] = useActionState(
    isEdit ? updateVariant : createVariant,
    initialState,
  );
  const [attributeRows, setAttributeRows] = useState(
    variant && variant.attributs.length > 0 ? variant.attributs : [{ name: "", value: "" }],
  );
  // useActionState ne donne pas de callback "succès" — state reste { error:
  // null } aussi bien avant toute soumission qu'après une soumission réussie.
  // Le ref distingue les deux : seule une vraie soumission (onSubmit, avant
  // que l'action serveur ne tourne) doit déclencher onSuccess au prochain
  // rendu sans erreur.
  const submittedRef = useRef(false);
  useEffect(() => {
    if (submittedRef.current && state.error === null) {
      submittedRef.current = false;
      onSuccess?.();
    }
  }, [state, onSuccess]);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        submittedRef.current = true;
      }}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
    >
      <h2 className="text-sm font-medium text-foreground">
        {isEdit ? "Modifier la variante" : "Nouvelle variante"}
      </h2>
      {isEdit ? (
        <input type="hidden" name="variantId" value={variant.id} />
      ) : (
        <input type="hidden" name="productId" value={productId} />
      )}

      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label>Attributs (taille, couleur...)</Label>
        {attributeRows.map((row, i) => (
          <div key={i} className="flex gap-2">
            <Input
              name="attributeName"
              placeholder="Taille"
              defaultValue={row.name}
              className="flex-1"
            />
            <Input
              name="attributeValue"
              placeholder="M"
              defaultValue={row.value}
              className="flex-1"
            />
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setAttributeRows((prev) => [...prev, { name: "", value: "" }])}
        >
          + Ajouter un attribut
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="codeBarres">Code-barres</Label>
          <Input
            id="codeBarres"
            name="codeBarres"
            placeholder="EAN/UPC"
            defaultValue={variant?.codeBarres ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prixAchatRef">Prix d&apos;achat de référence</Label>
          <Input
            id="prixAchatRef"
            name="prixAchatRef"
            type="number"
            step="0.01"
            defaultValue={variant?.prixAchatRef ?? 0}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="uniteQuantite">Quantité</Label>
          <Input
            id="uniteQuantite"
            name="uniteQuantite"
            type="number"
            step="0.001"
            min="0"
            defaultValue={variant?.uniteQuantite ?? 1}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unite">Unité</Label>
          <UnitCombobox id="unite" name="unite" defaultValue={variant?.unite ?? "piece"} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prixVente">Prix de vente</Label>
          <Input
            id="prixVente"
            name="prixVente"
            type="number"
            step="0.01"
            required
            defaultValue={variant?.prixVente}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prixPlancher">Prix plancher (optionnel)</Label>
          <Input
            id="prixPlancher"
            name="prixPlancher"
            type="number"
            step="0.01"
            defaultValue={variant?.prixPlancher ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="seuilAlerte">Seuil d&apos;alerte de stock</Label>
          <Input
            id="seuilAlerte"
            name="seuilAlerte"
            type="number"
            defaultValue={variant?.seuilAlerte ?? ""}
          />
        </div>
      </div>

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending
          ? isEdit
            ? "Enregistrement..."
            : "Création..."
          : isEdit
            ? "Enregistrer les modifications"
            : "Créer la variante"}
      </Button>
    </form>
  );
}

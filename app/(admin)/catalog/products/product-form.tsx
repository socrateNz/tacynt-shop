"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SALE_UNITS } from "@/lib/tenant/units";

import { createProduct, type ProductFormState } from "./actions";

const initialState: ProductFormState = { error: null };

export function ProductForm({
  categories,
  showLots,
  showSerial,
}: {
  categories: { id: string; nom: string }[];
  showLots: boolean;
  showSerial: boolean;
}) {
  const [state, formAction, isPending] = useActionState(createProduct, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="designation">Désignation</Label>
          <Input
            id="designation"
            name="designation"
            required
            placeholder="Savon de Marseille 200 g"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="categoryId">Catégorie</Label>
          <select
            id="categoryId"
            name="categoryId"
            className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
          >
            <option value="">Aucune</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unite">Unité de vente</Label>
          <Select name="unite" defaultValue="piece">
            <SelectTrigger id="unite" className="w-full">
              <SelectValue placeholder="Unité de vente" />
            </SelectTrigger>
            <SelectContent>
              {SALE_UNITS.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="codeBarres">Code-barres</Label>
          <Input id="codeBarres" name="codeBarres" placeholder="EAN/UPC" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tauxTaxe">Taux de taxe (%)</Label>
          <Input id="tauxTaxe" name="tauxTaxe" type="number" step="0.01" defaultValue="0" />
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

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" name="suiviStock" defaultChecked className="size-4" />
        Suivi de stock (décocher pour un service)
      </label>

      {showLots && (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="suiviLots" className="size-4" />
          Suivi par lots et péremption (sortie FEFO)
        </label>
      )}

      {showSerial && (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="suiviSerie" className="size-4" />
          Suivi par numéro de série (traçabilité unité par unité)
        </label>
      )}

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Création..." : "Créer le produit"}
      </Button>
    </form>
  );
}

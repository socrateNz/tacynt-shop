"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { SALE_UNITS } from "@/lib/tenant/units";

const MAX_IMAGES = 3;

type VariantRow = { id: number; attributeIds: number[] };

// Compteur de clés stables pour les lignes dynamiques (variantes et leurs
// attributs) — jamais réinitialisé entre deux ouvertures du formulaire dans
// le même onglet, mais ça n'a pas besoin d'être global entre composants,
// juste unique au sein d'un même rendu de formulaire.
let nextRowId = 1;

function emptyVariantRow(): VariantRow {
  return { id: nextRowId++, attributeIds: [nextRowId++] };
}

export function ProductForm({
  categories,
  showLots,
  showSerial,
  onSuccess,
}: {
  categories: { id: string; nom: string }[];
  showLots: boolean;
  showSerial: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([emptyVariantRow()]);

  function addVariantRow() {
    setVariantRows((prev) => [...prev, emptyVariantRow()]);
  }

  function removeVariantRow(rowId: number) {
    setVariantRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== rowId) : prev));
  }

  function addAttributeRow(rowId: number) {
    setVariantRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, attributeIds: [...r.attributeIds, nextRowId++] } : r)),
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Capturé avant le premier await : event.currentTarget redevient null
    // dès que la pile d'appels synchrone se termine (spec DOM, pas propre à
    // React) — l'appeler après un await plantait silencieusement .reset(),
    // rattrapé par le catch ci-dessous qui affichait alors un échec même
    // quand la création avait réussi côté serveur (bug réel constaté).
    const form = e.currentTarget;
    setError(null);

    const formData = new FormData(form);
    if (formData.getAll("images").filter((f) => f instanceof File && f.size > 0).length > MAX_IMAGES) {
      setError(`${MAX_IMAGES} photos maximum par produit.`);
      return;
    }

    // Chaque ligne de variante a ses champs nommés avec son id (variant-<id>-
    // ...) pour rester indépendante des autres lignes, qui peuvent chacune
    // avoir un nombre différent d'attributs — même principe que les paires
    // attributeName/attributeValue répétées de variant-form.tsx, juste
    // préfixé par ligne puisqu'il y en a plusieurs ici.
    const variants = variantRows.map((row) => {
      const attributeNames = formData.getAll(`variant-${row.id}-attributeName`) as string[];
      const attributeValues = formData.getAll(`variant-${row.id}-attributeValue`) as string[];
      const attributs: Record<string, string> = {};
      attributeNames.forEach((name, i) => {
        const trimmedName = name.trim();
        const value = (attributeValues[i] ?? "").trim();
        if (trimmedName && value) attributs[trimmedName] = value;
      });

      const prixPlancherRaw = String(formData.get(`variant-${row.id}-prixPlancher`) ?? "").trim();
      const seuilAlerteRaw = String(formData.get(`variant-${row.id}-seuilAlerte`) ?? "").trim();

      return {
        attributs,
        codeBarres: String(formData.get(`variant-${row.id}-codeBarres`) ?? "").trim() || null,
        prixAchatRef: Number(formData.get(`variant-${row.id}-prixAchatRef`) ?? 0),
        prixVente: Number(formData.get(`variant-${row.id}-prixVente`) ?? 0),
        prixPlancher: prixPlancherRaw ? Number(prixPlancherRaw) : null,
        seuilAlerte: seuilAlerteRaw ? Number(seuilAlerteRaw) : null,
      };
    });

    if (variants.some((v) => !Number.isFinite(v.prixVente) || v.prixVente < 0)) {
      setError("Chaque variante doit avoir un prix de vente valide.");
      return;
    }

    formData.set("variantsJson", JSON.stringify(variants));

    setIsPending(true);
    try {
      const res = await fetch("/api/products", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Échec de la création du produit.");
        return;
      }
      form.reset();
      setVariantRows([emptyVariantRow()]);
      router.refresh();
      onSuccess?.();
    } catch {
      setError("Échec de la création du produit.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <Label htmlFor="tauxTaxe">Taux de taxe (%)</Label>
          <Input id="tauxTaxe" name="tauxTaxe" type="number" step="0.01" defaultValue="0" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="images">Photos (jusqu&apos;à {MAX_IMAGES}, optionnel)</Label>
          <input
            id="images"
            name="images"
            type="file"
            accept="image/*"
            multiple
            className="text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Label>Variantes</Label>
        {variantRows.map((row, index) => (
          <div key={row.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Variante {index + 1}</p>
              {variantRows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeVariantRow(row.id)}
                >
                  Retirer
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Attributs (taille, couleur...)</Label>
              {row.attributeIds.map((attrId) => (
                <div key={attrId} className="flex gap-2">
                  <Input
                    name={`variant-${row.id}-attributeName`}
                    placeholder="Taille"
                    className="flex-1"
                  />
                  <Input
                    name={`variant-${row.id}-attributeValue`}
                    placeholder="M"
                    className="flex-1"
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => addAttributeRow(row.id)}
              >
                + Ajouter un attribut
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`variant-${row.id}-codeBarres`}>Code-barres</Label>
                <Input
                  id={`variant-${row.id}-codeBarres`}
                  name={`variant-${row.id}-codeBarres`}
                  placeholder="EAN/UPC"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`variant-${row.id}-prixAchatRef`}>Prix d&apos;achat de référence</Label>
                <Input
                  id={`variant-${row.id}-prixAchatRef`}
                  name={`variant-${row.id}-prixAchatRef`}
                  type="number"
                  step="0.01"
                  defaultValue="0"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`variant-${row.id}-prixVente`}>Prix de vente</Label>
                <Input
                  id={`variant-${row.id}-prixVente`}
                  name={`variant-${row.id}-prixVente`}
                  type="number"
                  step="0.01"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`variant-${row.id}-prixPlancher`}>Prix plancher (optionnel)</Label>
                <Input
                  id={`variant-${row.id}-prixPlancher`}
                  name={`variant-${row.id}-prixPlancher`}
                  type="number"
                  step="0.01"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`variant-${row.id}-seuilAlerte`}>Seuil d&apos;alerte de stock</Label>
                <Input
                  id={`variant-${row.id}-seuilAlerte`}
                  name={`variant-${row.id}-seuilAlerte`}
                  type="number"
                />
              </div>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={addVariantRow}>
          + Ajouter une variante
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description (optionnel)</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Affichée sur la fiche produit de la boutique en ligne."
          rows={4}
        />
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

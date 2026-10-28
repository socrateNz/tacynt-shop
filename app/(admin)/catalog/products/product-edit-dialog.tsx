"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { UnitCombobox } from "./unit-combobox";

const MAX_IMAGES = 3;

export type ProductEditVariant = {
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

export type ProductEditValues = {
  id: string;
  designation: string;
  categoryId: string | null;
  tauxTaxe: number;
  prixEmballage: number | null;
  description: string | null;
  suiviStock: boolean;
  suiviLots: boolean;
  suiviSerie: boolean;
  images: { id: string }[];
  variants: ProductEditVariant[];
};

type AttributeRow = { key: number; name: string; value: string };
type VariantRow = {
  rowKey: number;
  variantId: string | null;
  attributeRows: AttributeRow[];
  codeBarres: string | null;
  prixAchatRef: number;
  unite: string;
  uniteQuantite: number;
  prixVente: number;
  prixPlancher: number | null;
  seuilAlerte: number | null;
};

// Même compteur que product-form.tsx (clés stables pour les lignes
// dynamiques), indépendant d'un composant à l'autre — chaque formulaire n'a
// besoin que de clés uniques au sein de son propre rendu.
let nextRowId = 1;

function emptyVariantRow(): VariantRow {
  return {
    rowKey: nextRowId++,
    variantId: null,
    attributeRows: [{ key: nextRowId++, name: "", value: "" }],
    codeBarres: null,
    prixAchatRef: 0,
    unite: "piece",
    uniteQuantite: 1,
    prixVente: 0,
    prixPlancher: null,
    seuilAlerte: null,
  };
}

function rowFromVariant(v: ProductEditVariant): VariantRow {
  return {
    rowKey: nextRowId++,
    variantId: v.id,
    attributeRows:
      v.attributs.length > 0
        ? v.attributs.map((a) => ({ key: nextRowId++, name: a.name, value: a.value }))
        : [{ key: nextRowId++, name: "", value: "" }],
    codeBarres: v.codeBarres,
    prixAchatRef: v.prixAchatRef,
    unite: v.unite,
    uniteQuantite: v.uniteQuantite,
    prixVente: v.prixVente,
    prixPlancher: v.prixPlancher,
    seuilAlerte: v.seuilAlerte,
  };
}

// Même structure que product-form.tsx (formulaire de création) — le produit
// et toutes ses variantes dans un seul formulaire, pas juste variants[0]
// comme l'ancien dialogue "Modifier" le faisait. Les lignes retirées ici
// désactivent la variante existante (jamais de suppression physique, même
// règle que deactivateVariant) ; une ligne ajoutée sans variantId en crée une
// nouvelle au submit — même revalidation serveur que la création, jamais
// fait confiance à cette seule distinction côté client.
export function ProductEditDialog({
  product,
  categories,
  showLots,
  showSerial,
}: {
  product: ProductEditValues;
  categories: { id: string; nom: string }[];
  showLots: boolean;
  showSerial: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [variantRows, setVariantRows] = useState<VariantRow[]>(() =>
    product.variants.length > 0 ? product.variants.map(rowFromVariant) : [emptyVariantRow()],
  );
  const [deactivatedVariantIds, setDeactivatedVariantIds] = useState<string[]>([]);

  function addVariantRow() {
    setVariantRows((prev) => [...prev, emptyVariantRow()]);
  }

  function removeVariantRow(row: VariantRow) {
    setVariantRows((prev) => {
      if (prev.length <= 1) return prev;
      if (row.variantId) setDeactivatedVariantIds((ids) => [...ids, row.variantId!]);
      return prev.filter((r) => r.rowKey !== row.rowKey);
    });
  }

  function addAttributeRow(rowKey: number) {
    setVariantRows((prev) =>
      prev.map((r) =>
        r.rowKey === rowKey
          ? { ...r, attributeRows: [...r.attributeRows, { key: nextRowId++, name: "", value: "" }] }
          : r,
      ),
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Capturé avant le premier await — voir product-form.tsx (même piège
    // event.currentTarget redevenu null constaté).
    const form = e.currentTarget;
    setError(null);

    const formData = new FormData(form);
    if (formData.getAll("images").filter((f) => f instanceof File && f.size > 0).length > MAX_IMAGES) {
      setError(`${MAX_IMAGES} photos maximum par produit.`);
      return;
    }

    const variants = variantRows.map((row) => {
      const attributeNames = formData.getAll(`variant-${row.rowKey}-attributeName`) as string[];
      const attributeValues = formData.getAll(`variant-${row.rowKey}-attributeValue`) as string[];
      const attributs: Record<string, string> = {};
      attributeNames.forEach((name, i) => {
        const trimmedName = name.trim();
        const value = (attributeValues[i] ?? "").trim();
        if (trimmedName && value) attributs[trimmedName] = value;
      });

      const prixPlancherRaw = String(formData.get(`variant-${row.rowKey}-prixPlancher`) ?? "").trim();
      const seuilAlerteRaw = String(formData.get(`variant-${row.rowKey}-seuilAlerte`) ?? "").trim();

      return {
        variantId: row.variantId,
        attributs,
        codeBarres: String(formData.get(`variant-${row.rowKey}-codeBarres`) ?? "").trim() || null,
        prixAchatRef: Number(formData.get(`variant-${row.rowKey}-prixAchatRef`) ?? 0),
        unite: String(formData.get(`variant-${row.rowKey}-unite`) ?? "piece").trim() || "piece",
        uniteQuantite: Number(formData.get(`variant-${row.rowKey}-uniteQuantite`) ?? 1),
        prixVente: Number(formData.get(`variant-${row.rowKey}-prixVente`) ?? 0),
        prixPlancher: prixPlancherRaw ? Number(prixPlancherRaw) : null,
        seuilAlerte: seuilAlerteRaw ? Number(seuilAlerteRaw) : null,
      };
    });

    if (variants.some((v) => !Number.isFinite(v.prixVente) || v.prixVente < 0)) {
      setError("Chaque variante doit avoir un prix de vente valide.");
      return;
    }
    if (variants.some((v) => !Number.isFinite(v.uniteQuantite) || v.uniteQuantite < 0)) {
      setError("Chaque variante doit avoir une quantité d'unité valide.");
      return;
    }

    formData.set("variantsJson", JSON.stringify(variants));
    formData.set("deactivatedVariantIdsJson", JSON.stringify(deactivatedVariantIds));

    setIsPending(true);
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Échec de la modification du produit.");
        return;
      }
      // router.refresh() + fermeture du dialogue dans le même mouvement :
      // sans startTransition, Next.js pouvait planter le client React
      // (TypeError interne "enqueueModel", constaté en test) en démontant
      // le formulaire pendant qu'une requête RSC de rafraîchissement était
      // encore en cours. startTransition est le patron documenté pour
      // coordonner router.refresh() avec une autre mise à jour d'état.
      startTransition(() => {
        router.refresh();
        setOpen(false);
      });
    } catch {
      setError("Échec de la modification du produit.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Pencil className="size-3.5" />
        <span className="sr-only">Modifier</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modifier — {product.designation}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-designation">Désignation</Label>
              <Input
                id="edit-designation"
                name="designation"
                required
                defaultValue={product.designation}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-categoryId">Catégorie</Label>
              <select
                id="edit-categoryId"
                name="categoryId"
                defaultValue={product.categoryId ?? ""}
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
              <Label htmlFor="edit-tauxTaxe">Taux de taxe (%)</Label>
              <Input
                id="edit-tauxTaxe"
                name="tauxTaxe"
                type="number"
                step="0.01"
                defaultValue={product.tauxTaxe}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-prixEmballage">Prix d&apos;emballage (optionnel)</Label>
              <Input
                id="edit-prixEmballage"
                name="prixEmballage"
                type="number"
                step="0.01"
                min="0"
                defaultValue={product.prixEmballage ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-images">Ajouter des photos</Label>
              <input
                id="edit-images"
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
              <div
                key={row.rowKey}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Variante {index + 1}</p>
                  {variantRows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVariantRow(row)}
                    >
                      Retirer
                    </Button>
                  )}
                </div>

                <input type="hidden" name={`variant-${row.rowKey}-variantId`} value={row.variantId ?? ""} />

                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground">Attributs (taille, couleur...)</Label>
                  {row.attributeRows.map((attr) => (
                    <div key={attr.key} className="flex gap-2">
                      <Input
                        name={`variant-${row.rowKey}-attributeName`}
                        placeholder="Taille"
                        defaultValue={attr.name}
                        className="flex-1"
                      />
                      <Input
                        name={`variant-${row.rowKey}-attributeValue`}
                        placeholder="M"
                        defaultValue={attr.value}
                        className="flex-1"
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={() => addAttributeRow(row.rowKey)}
                  >
                    + Ajouter un attribut
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`variant-${row.rowKey}-codeBarres`}>Code-barres</Label>
                    <Input
                      id={`variant-${row.rowKey}-codeBarres`}
                      name={`variant-${row.rowKey}-codeBarres`}
                      placeholder="EAN/UPC"
                      defaultValue={row.codeBarres ?? ""}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`variant-${row.rowKey}-prixAchatRef`}>Prix d&apos;achat de référence</Label>
                    <Input
                      id={`variant-${row.rowKey}-prixAchatRef`}
                      name={`variant-${row.rowKey}-prixAchatRef`}
                      type="number"
                      step="0.01"
                      defaultValue={row.prixAchatRef}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`variant-${row.rowKey}-uniteQuantite`}>Quantité</Label>
                    <Input
                      id={`variant-${row.rowKey}-uniteQuantite`}
                      name={`variant-${row.rowKey}-uniteQuantite`}
                      type="number"
                      step="0.001"
                      min="0"
                      defaultValue={row.uniteQuantite}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`variant-${row.rowKey}-unite`}>Unité</Label>
                    <UnitCombobox
                      id={`variant-${row.rowKey}-unite`}
                      name={`variant-${row.rowKey}-unite`}
                      defaultValue={row.unite}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`variant-${row.rowKey}-prixVente`}>Prix de vente</Label>
                    <Input
                      id={`variant-${row.rowKey}-prixVente`}
                      name={`variant-${row.rowKey}-prixVente`}
                      type="number"
                      step="0.01"
                      required
                      defaultValue={row.prixVente}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`variant-${row.rowKey}-prixPlancher`}>Prix plancher (optionnel)</Label>
                    <Input
                      id={`variant-${row.rowKey}-prixPlancher`}
                      name={`variant-${row.rowKey}-prixPlancher`}
                      type="number"
                      step="0.01"
                      defaultValue={row.prixPlancher ?? ""}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`variant-${row.rowKey}-seuilAlerte`}>Seuil d&apos;alerte de stock</Label>
                    <Input
                      id={`variant-${row.rowKey}-seuilAlerte`}
                      name={`variant-${row.rowKey}-seuilAlerte`}
                      type="number"
                      defaultValue={row.seuilAlerte ?? ""}
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
            <Label htmlFor="edit-description">Description (optionnel)</Label>
            <Textarea
              id="edit-description"
              name="description"
              defaultValue={product.description ?? ""}
              placeholder="Affichée sur la fiche produit de la boutique en ligne."
              rows={4}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="suiviStock"
              defaultChecked={product.suiviStock}
              className="size-4"
            />
            Suivi de stock (décocher pour un service)
          </label>

          {showLots && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="suiviLots"
                defaultChecked={product.suiviLots}
                className="size-4"
              />
              Suivi par lots et péremption (sortie FEFO)
            </label>
          )}

          {showSerial && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="suiviSerie"
                defaultChecked={product.suiviSerie}
                className="size-4"
              />
              Suivi par numéro de série (traçabilité unité par unité)
            </label>
          )}

          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">
              Photos ({product.images.length}/{MAX_IMAGES})
            </p>
            {product.images.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {product.images.map((image) => (
                  <div key={image.id} className="flex flex-col items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable */}
                    <img
                      src={`/api/products/${product.id}/images/${image.id}`}
                      alt=""
                      className="size-16 rounded-md border border-border object-cover"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        name="removeImageIds"
                        value={image.id}
                        className="size-3.5"
                      />
                      Supprimer
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune photo pour l&apos;instant.</p>
            )}
          </div>

          <Button type="submit" className="self-start" disabled={isPending}>
            {isPending ? "Enregistrement..." : "Enregistrer les modifications"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

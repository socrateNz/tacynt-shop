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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SALE_UNITS } from "@/lib/tenant/units";

export type ProductEditValues = {
  id: string;
  designation: string;
  categoryId: string | null;
  unite: string;
  tauxTaxe: number;
  codeBarres: string | null;
  prixVente: number;
  prixPlancher: number | null;
  seuilAlerte: number | null;
  hasImage: boolean;
};

export function ProductEditDialog({
  product,
  categories,
}: {
  product: ProductEditValues;
  categories: { id: string; nom: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setIsPending(true);
    try {
      const formData = new FormData(form);
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

          <div className="grid grid-cols-2 gap-4">
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
              <Label htmlFor="edit-unite">Unité de vente</Label>
              <Select name="unite" defaultValue={product.unite}>
                <SelectTrigger id="edit-unite" className="w-full">
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
              <Label htmlFor="edit-codeBarres">Code-barres</Label>
              <Input
                id="edit-codeBarres"
                name="codeBarres"
                placeholder="EAN/UPC"
                defaultValue={product.codeBarres ?? ""}
              />
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
              <Label htmlFor="edit-prixVente">Prix de vente</Label>
              <Input
                id="edit-prixVente"
                name="prixVente"
                type="number"
                step="0.01"
                required
                defaultValue={product.prixVente}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-prixPlancher">Prix plancher (optionnel)</Label>
              <Input
                id="edit-prixPlancher"
                name="prixPlancher"
                type="number"
                step="0.01"
                defaultValue={product.prixPlancher ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-seuilAlerte">Seuil d&apos;alerte de stock</Label>
              <Input
                id="edit-seuilAlerte"
                name="seuilAlerte"
                type="number"
                defaultValue={product.seuilAlerte ?? ""}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">Photo</p>
            {product.hasImage ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable */}
                <img
                  src={`/api/products/${product.id}/image`}
                  alt=""
                  className="size-16 rounded-md border border-border object-cover"
                />
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" name="removeImage" className="size-4" />
                  Supprimer la photo actuelle
                </label>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune photo pour l&apos;instant.</p>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-image">
                {product.hasImage ? "Remplacer par une nouvelle photo" : "Ajouter une photo"}
              </Label>
              <input id="edit-image" name="image" type="file" accept="image/*" className="text-sm" />
            </div>
          </div>

          <Button type="submit" className="self-start" disabled={isPending}>
            {isPending ? "Enregistrement..." : "Enregistrer les modifications"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MAX_IMAGES = 3;

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "CHAMBRE", label: "Chambre" },
  { value: "STUDIO", label: "Studio" },
  { value: "APPARTEMENT", label: "Appartement" },
  { value: "VILLA", label: "Villa" },
  { value: "AUTRE", label: "Autre" },
];

export type UnitEditValues = {
  id: string;
  type: string;
  designation: string;
  description: string | null;
  montantMensuel: number;
  dureeMinMois: number;
  commissionMontant: number;
  actif: boolean;
  images: { id: string }[];
};

export function UnitEditDialog({ unit }: { unit: UnitEditValues }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [removedImageIds, setRemovedImageIds] = useState<Set<string>>(new Set());

  const remainingImages = unit.images.filter((img) => !removedImageIds.has(img.id));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);

    const formData = new FormData(form);
    const newImagesCount = formData
      .getAll("images")
      .filter((f) => f instanceof File && f.size > 0).length;
    if (remainingImages.length + newImagesCount > MAX_IMAGES) {
      setError(`${MAX_IMAGES} photos maximum par logement.`);
      return;
    }
    for (const id of removedImageIds) formData.append("removeImageIds", id);

    setIsPending(true);
    try {
      const res = await fetch(`/api/rentals/units/${unit.id}`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Échec de la mise à jour du logement.");
        return;
      }
      router.refresh();
      setOpen(false);
    } catch {
      setError("Échec de la mise à jour du logement.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          setRemovedImageIds(new Set());
        }
      }}
    >
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Modifier
      </Button>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{unit.designation}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`type-${unit.id}`}>Type</Label>
              <select
                id={`type-${unit.id}`}
                name="type"
                required
                defaultValue={unit.type}
                className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`designation-${unit.id}`}>Désignation</Label>
              <Input id={`designation-${unit.id}`} name="designation" required defaultValue={unit.designation} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`montantMensuel-${unit.id}`}>Loyer mensuel</Label>
              <Input
                id={`montantMensuel-${unit.id}`}
                name="montantMensuel"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={unit.montantMensuel}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`dureeMinMois-${unit.id}`}>Durée minimale (mois)</Label>
              <Input
                id={`dureeMinMois-${unit.id}`}
                name="dureeMinMois"
                type="number"
                step="1"
                min="1"
                required
                defaultValue={unit.dureeMinMois}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`commissionMontant-${unit.id}`}>Commission</Label>
              <Input
                id={`commissionMontant-${unit.id}`}
                name="commissionMontant"
                type="number"
                step="0.01"
                min="0"
                defaultValue={unit.commissionMontant}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`images-${unit.id}`}>Ajouter des photos</Label>
              <input id={`images-${unit.id}`} name="images" type="file" accept="image/*" multiple className="text-sm" />
            </div>
          </div>

          {unit.images.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Photos actuelles</Label>
              <div className="flex flex-wrap gap-2">
                {unit.images.map((img) => {
                  const removed = removedImageIds.has(img.id);
                  return (
                    <div key={img.id} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable */}
                      <img
                        src={`/api/rentals/units/${unit.id}/images/${img.id}`}
                        alt=""
                        className={`size-16 rounded-md border border-border object-cover ${removed ? "opacity-30" : ""}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setRemovedImageIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(img.id)) next.delete(img.id);
                            else next.add(img.id);
                            return next;
                          })
                        }
                        className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border border-border bg-background text-foreground"
                        aria-label={removed ? "Conserver la photo" : "Retirer la photo"}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`description-${unit.id}`}>Description</Label>
            <Textarea
              id={`description-${unit.id}`}
              name="description"
              rows={4}
              defaultValue={unit.description ?? ""}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" name="actif" defaultChecked={unit.actif} className="size-4" />
            Actif (visible et proposable à la location)
          </label>

          <Button type="submit" className="self-start" disabled={isPending}>
            {isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

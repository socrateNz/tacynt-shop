"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VEHICLE_DRIVER_MODES, vehicleLabel } from "@/lib/vehicles/types";
import { cn } from "@/lib/utils";

import { TagInput } from "./tag-input";

// Miroir de MAX_VEHICLE_IMAGES (lib/vehicles/form.ts, côté serveur).
const MAX_IMAGES = 5;

export type VehicleEditValues = {
  id: string;
  marque: string;
  modele: string;
  annee: number | null;
  description: string | null;
  tags: string[];
  prixJour: number;
  afficherPrix: boolean;
  chauffeurMode: string;
  caution: number | null;
  afficherCaution: boolean;
  quantite: number;
  actif: boolean;
  imageIds: string[];
};

const selectClass = "h-8 rounded-md border border-border bg-background px-2.5 text-sm";

/**
 * Création (vehicle absent) ou modification d'un véhicule. Fenêtre
 * contrôlée par l'appelant : bouton de l'en-tête pour créer, menu d'actions
 * de la ligne pour modifier.
 */
export function VehicleFormDialog({
  open,
  onOpenChange,
  vehicle,
  devise,
  tagSuggestions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: VehicleEditValues;
  devise: string;
  tagSuggestions: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [removedImageIds, setRemovedImageIds] = useState<Set<string>>(new Set());
  const uid = vehicle?.id ?? "new";
  const keptImages = (vehicle?.imageIds ?? []).filter((id) => !removedImageIds.has(id)).length;

  function close() {
    setError(null);
    setRemovedImageIds(new Set());
    onOpenChange(false);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Capturé avant le premier await (e.currentTarget redevient null ensuite).
    const form = e.currentTarget;
    setError(null);

    const formData = new FormData(form);
    const added = formData.getAll("images").filter((f) => f instanceof File && f.size > 0).length;
    if (keptImages + added > MAX_IMAGES) {
      setError(`${MAX_IMAGES} photos maximum par véhicule.`);
      return;
    }
    for (const id of removedImageIds) formData.append("removeImageIds", id);

    setIsPending(true);
    try {
      const res = await fetch(vehicle ? `/api/vehicles/${vehicle.id}` : "/api/vehicles", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "L'enregistrement du véhicule a échoué.");
        return;
      }
      // refresh + fermeture dans la même transition (même précaution que
      // product-edit-dialog.tsx).
      startTransition(() => {
        router.refresh();
        close();
      });
    } catch {
      setError("L'enregistrement du véhicule a échoué.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{vehicle ? `Modifier — ${vehicleLabel(vehicle)}` : "Nouveau véhicule"}</DialogTitle>
        </DialogHeader>
        {/* key : le formulaire repart des valeurs à jour à chaque ouverture. */}
        <form key={String(open)} onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-sm font-semibold text-foreground">Le véhicule</legend>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`marque-${uid}`}>Marque</Label>
              <Input id={`marque-${uid}`} name="marque" required defaultValue={vehicle?.marque} placeholder="JETOUR" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`modele-${uid}`}>Modèle</Label>
              <Input id={`modele-${uid}`} name="modele" required defaultValue={vehicle?.modele} placeholder="T3" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`annee-${uid}`}>Année (optionnel)</Label>
              <Input
                id={`annee-${uid}`}
                name="annee"
                type="number"
                inputMode="numeric"
                min={1950}
                step={1}
                defaultValue={vehicle?.annee ?? ""}
                placeholder="2024"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`quantite-${uid}`}>Nombre d&apos;exemplaires</Label>
              <Input
                id={`quantite-${uid}`}
                name="quantite"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                required
                defaultValue={vehicle?.quantite ?? 1}
              />
              <p className="text-xs text-muted-foreground">
                Une seule fiche par modèle : indiquez combien de véhicules identiques vous louez.
              </p>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor={`tags-${uid}`}>Étiquettes (optionnel)</Label>
              <TagInput id={`tags-${uid}`} defaultValue={vehicle?.tags} suggestions={tagSuggestions} />
            </div>
          </fieldset>

          <fieldset className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <legend className="sr-only">Tarif et conditions</legend>
            <p className="text-sm font-semibold text-foreground sm:col-span-2">Tarif et conditions</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`prixJour-${uid}`}>Prix par jour ({devise})</Label>
              <Input
                id={`prixJour-${uid}`}
                name="prixJour"
                type="number"
                inputMode="decimal"
                min={0}
                step="1"
                required
                defaultValue={vehicle?.prixJour}
              />
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  name="afficherPrix"
                  defaultChecked={vehicle?.afficherPrix ?? true}
                  className="size-4 accent-primary"
                />
                Afficher le prix sur le site et dans l&apos;app
              </label>
              <p className="text-xs text-muted-foreground">Décoché : le client voit « Prix sur demande ».</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`caution-${uid}`}>Caution ({devise}, optionnel)</Label>
              <Input
                id={`caution-${uid}`}
                name="caution"
                type="number"
                inputMode="decimal"
                min={0}
                step="1"
                defaultValue={vehicle?.caution ?? ""}
                placeholder="Aucune"
              />
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  name="afficherCaution"
                  defaultChecked={vehicle?.afficherCaution ?? true}
                  className="size-4 accent-primary"
                />
                Afficher la caution au client
              </label>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor={`chauffeur-${uid}`}>Chauffeur</Label>
              <select
                id={`chauffeur-${uid}`}
                name="chauffeurMode"
                required
                defaultValue={vehicle?.chauffeurMode ?? "AU_CHOIX"}
                className={selectClass}
              >
                {VEHICLE_DRIVER_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Le supplément chauffeur par jour est le même pour tous les véhicules : réglez-le avec le bouton
                « Supplément chauffeur » de la page.
              </p>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-4 border-t border-border pt-4">
            <legend className="sr-only">Présentation</legend>
            <p className="text-sm font-semibold text-foreground">Présentation</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`images-${uid}`}>Photos (jusqu&apos;à {MAX_IMAGES})</Label>
              {vehicle && vehicle.imageIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {vehicle.imageIds.map((imageId) => {
                    const removed = removedImageIds.has(imageId);
                    return (
                      <div key={imageId} className="flex flex-col items-center gap-1">
                        {/* eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable */}
                        <img
                          src={`/api/vehicles/${vehicle.id}/images/${imageId}`}
                          alt=""
                          className={cn(
                            "size-20 rounded-md border border-border object-cover",
                            removed && "opacity-30",
                          )}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setRemovedImageIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(imageId)) next.delete(imageId);
                              else next.add(imageId);
                              return next;
                            })
                          }
                          className={cn("text-xs hover:underline", removed ? "text-primary" : "text-destructive")}
                        >
                          {removed ? "Garder" : "Retirer"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <input
                id={`images-${uid}`}
                name="images"
                type="file"
                accept="image/*"
                multiple
                className="text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`description-${uid}`}>Description (optionnel)</Label>
              <Textarea
                id={`description-${uid}`}
                name="description"
                rows={3}
                defaultValue={vehicle?.description ?? ""}
                placeholder="Affichée sur la fiche du véhicule."
              />
            </div>
            {vehicle && (
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" name="actif" defaultChecked={vehicle.actif} className="size-4 accent-primary" />
                Proposé à la location (décochez pour le retirer du site sans le supprimer)
              </label>
            )}
          </fieldset>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Enregistrement…" : vehicle ? "Enregistrer" : "Créer le véhicule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

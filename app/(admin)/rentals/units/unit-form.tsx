"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RENTAL_UNIT_AMENITIES, RENTAL_UNIT_TYPES } from "@/lib/rentals/types";

const MAX_IMAGES = 3;

export type LocalityOption = { id: string; nom: string; parentId: string | null };

export function UnitForm({
  localities,
  onSuccess,
}: {
  localities: LocalityOption[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  // Ville/Quartier sont deux selects dépendants, mais un seul champ
  // "localityId" est réellement soumis (celui du quartier s'il est choisi,
  // sinon celui de la ville) — localities seront créées en amont par le
  // personnel, jamais saisies en texte libre ici.
  const [villeId, setVilleId] = useState("");
  const [localityId, setLocalityId] = useState("");

  const villes = localities.filter((l) => !l.parentId);
  const quartiers = localities.filter((l) => l.parentId === villeId);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Capturé avant le premier await — même piège que product-form.tsx
    // (e.currentTarget redevient null après la pile synchrone).
    const form = e.currentTarget;
    setError(null);

    const formData = new FormData(form);
    if (formData.getAll("images").filter((f) => f instanceof File && f.size > 0).length > MAX_IMAGES) {
      setError(`${MAX_IMAGES} photos maximum par logement.`);
      return;
    }

    setIsPending(true);
    try {
      const res = await fetch("/api/rentals/units", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Échec de la création du logement.");
        return;
      }
      form.reset();
      setVilleId("");
      setLocalityId("");
      router.refresh();
      onSuccess?.();
    } catch {
      setError("Échec de la création du logement.");
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
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            name="type"
            required
            defaultValue="CHAMBRE"
            className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
          >
            {RENTAL_UNIT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="designation">Désignation</Label>
          <Input id="designation" name="designation" required placeholder="Chambre 3 - Étage 1" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="montantMensuel">Loyer mensuel</Label>
          <Input id="montantMensuel" name="montantMensuel" type="number" step="0.01" min="0" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dureeMinMois">Durée minimale (mois)</Label>
          <Input
            id="dureeMinMois"
            name="dureeMinMois"
            type="number"
            step="1"
            min="1"
            defaultValue="1"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="commissionMontant">Commission (optionnel)</Label>
          <Input id="commissionMontant" name="commissionMontant" type="number" step="0.01" min="0" defaultValue="0" />
          <p className="text-xs text-muted-foreground">
            Montant fixe facturé une seule fois à la signature, en plus du 1er mois.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="images">Photos (jusqu&apos;à {MAX_IMAGES}, optionnel)</Label>
          <input id="images" name="images" type="file" accept="image/*" multiple className="text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ville">Ville (optionnel)</Label>
          <select
            id="ville"
            value={villeId}
            onChange={(e) => {
              const v = e.target.value;
              setVilleId(v);
              setLocalityId(v);
            }}
            className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
          >
            <option value="">Aucune</option>
            {villes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nom}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quartier">Quartier (optionnel)</Label>
          <select
            id="quartier"
            value={quartiers.some((q) => q.id === localityId) ? localityId : ""}
            onChange={(e) => setLocalityId(e.target.value || villeId)}
            disabled={!villeId}
            className="h-8 rounded-md border border-border bg-background px-2.5 text-sm disabled:opacity-50"
          >
            <option value="">{villeId ? "Aucun quartier précis" : "Choisissez d'abord une ville"}</option>
            {quartiers.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nom}
              </option>
            ))}
          </select>
        </div>
        <input type="hidden" name="localityId" value={localityId} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="surfaceM2">Surface (m², optionnel)</Label>
          <Input id="surfaceM2" name="surfaceM2" type="number" step="1" min="0" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nombrePieces">Nombre de pièces (optionnel)</Label>
          <Input id="nombrePieces" name="nombrePieces" type="number" step="1" min="0" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Équipements (optionnel)</Label>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {RENTAL_UNIT_AMENITIES.map((a) => (
            <label key={a.value} className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" name="equipements" value={a.value} className="size-4 accent-primary" />
              {a.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description (optionnel)</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Affichée sur la fiche du logement sur la vitrine en ligne."
          rows={4}
        />
      </div>

      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Création..." : "Créer le logement"}
      </Button>
    </form>
  );
}

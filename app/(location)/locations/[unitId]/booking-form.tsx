"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BookingForm({
  unitId,
  shopId,
  dureeMinMois,
  montantMensuelLabel,
  commissionLabel,
}: {
  unitId: string;
  shopId: string;
  dureeMinMois: number;
  montantMensuelLabel: string;
  commissionLabel: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);

    const formData = new FormData(form);
    const dureeMois = Number(formData.get("dureeMois"));
    // Garde de saisie côté client — le serveur revalide toujours contre la
    // durée minimale réelle du logement, jamais fait confiance à ceci seul.
    if (!Number.isFinite(dureeMois) || dureeMois < dureeMinMois) {
      setError(`La durée minimale pour ce logement est de ${dureeMinMois} mois.`);
      return;
    }

    setIsPending(true);
    try {
      const res = await fetch("/api/storefront/rental-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId,
          rentalUnitId: unitId,
          nomClient: formData.get("nomClient"),
          telephoneClient: formData.get("telephoneClient"),
          dateDebut: formData.get("dateDebut"),
          dureeMois,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Échec de l'envoi de la demande.");
        return;
      }
      router.push(`/locations/merci/${data.id}`);
    } catch {
      setError("Échec de l'envoi de la demande.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">Faire une demande de réservation</p>
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nomClient">Nom</Label>
        <Input id="nomClient" name="nomClient" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="telephoneClient">Téléphone</Label>
        <Input id="telephoneClient" name="telephoneClient" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dateDebut">Date de début souhaitée</Label>
        <Input id="dateDebut" name="dateDebut" type="date" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dureeMois">Durée (mois)</Label>
        <Input
          id="dureeMois"
          name="dureeMois"
          type="number"
          step="1"
          min={dureeMinMois}
          defaultValue={dureeMinMois}
          required
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {montantMensuelLabel} / mois{commissionLabel ? ` + ${commissionLabel} de commission à la signature` : ""}.
        Un acompte (1er mois{commissionLabel ? " + commission" : ""}) sera demandé à la confirmation.
      </p>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Envoi..." : "Envoyer la demande"}
      </Button>
    </form>
  );
}

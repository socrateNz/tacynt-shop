"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createContractByStaff } from "./actions";

export type AvailableUnit = {
  id: string;
  designation: string;
  dureeMinMois: number;
  montantMensuelLabel: string;
};

export function NewContractDialog({ availableUnits }: { availableUnits: AvailableUnit[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState(availableUnits[0]?.id ?? "");

  const selectedUnit = availableUnits.find((u) => u.id === selectedUnitId);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsPending(true);
    try {
      await createContractByStaff(formData);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la création de la location.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <Button className="gap-1.5" onClick={() => setOpen(true)} disabled={availableUnits.length === 0}>
        <Plus className="size-4" />
        Nouvelle location
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle location</DialogTitle>
        </DialogHeader>
        {availableUnits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun logement disponible pour l&apos;instant — tous sont occupés ou inactifs.
          </p>
        ) : (
          <form action={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rentalUnitId">Logement</Label>
              <select
                id="rentalUnitId"
                name="rentalUnitId"
                required
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
              >
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.designation} — {u.montantMensuelLabel}/mois
                  </option>
                ))}
              </select>
              {selectedUnit && (
                <p className="text-xs text-muted-foreground">
                  Durée minimale : {selectedUnit.dureeMinMois} mois.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nomClient">Nom du client</Label>
                <Input id="nomClient" name="nomClient" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="telephoneClient">Téléphone</Label>
                <Input id="telephoneClient" name="telephoneClient" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dateDebut">Date de début</Label>
                <Input id="dateDebut" name="dateDebut" type="date" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dureeMois">Durée (mois)</Label>
                <Input
                  id="dureeMois"
                  name="dureeMois"
                  type="number"
                  step="1"
                  min={selectedUnit?.dureeMinMois ?? 1}
                  defaultValue={selectedUnit?.dureeMinMois ?? 1}
                  required
                />
              </div>
            </div>

            <Button type="submit" className="self-start" disabled={isPending}>
              {isPending ? "Création..." : "Créer la location"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

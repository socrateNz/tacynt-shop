"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/money";

import { createContractByStaff } from "./actions";

export type AvailableUnit = {
  id: string;
  designation: string;
  dureeMinMois: number;
  montantMensuel: number;
  commissionMontant: number;
  montantMensuelLabel: string;
};

export function NewContractDialog({
  availableUnits,
  devise,
}: {
  availableUnits: AvailableUnit[];
  devise: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState(availableUnits[0]?.id ?? "");
  const [dureeMois, setDureeMois] = useState(availableUnits[0]?.dureeMinMois ?? 1);

  const selectedUnit = availableUnits.find((u) => u.id === selectedUnitId);
  const total = selectedUnit ? selectedUnit.montantMensuel * dureeMois + selectedUnit.commissionMontant : 0;

  function selectUnit(unitId: string) {
    setSelectedUnitId(unitId);
    const unit = availableUnits.find((u) => u.id === unitId);
    if (unit) setDureeMois(unit.dureeMinMois);
  }

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
                onChange={(e) => selectUnit(e.target.value)}
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
                  value={dureeMois}
                  onChange={(e) => setDureeMois(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            {selectedUnit && (
              <div className="flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2.5">
                <span className="text-sm font-medium text-foreground">
                  Total à payer ({dureeMois} mois
                  {selectedUnit.commissionMontant > 0 ? " + commission" : ""})
                </span>
                <span className="num text-lg font-semibold text-foreground">
                  {formatMoney(total, devise)}
                </span>
              </div>
            )}

            <Button type="submit" className="self-end" disabled={isPending}>
              {isPending ? "Création..." : "Créer la location"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

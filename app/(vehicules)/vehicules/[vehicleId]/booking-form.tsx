"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/money";
import { billedDays, bookingTotal, dayKey, parseDay, resolveWithDriver, todayUtc } from "@/lib/vehicles/types";

// Demande de location : dates, chauffeur (si le véhicule le permet),
// coordonnées. Le total affiché n'est qu'indicatif — le serveur recalcule
// tout. Prix masqué par l'administrateur : aucun total, le personnel
// communique le prix en rappelant le client.
export function VehicleBookingForm({
  vehicleId,
  shopId,
  devise,
  prixJour,
  chauffeurMode,
  supplementChauffeurJour,
}: {
  vehicleId: string;
  shopId: string;
  devise: string;
  prixJour: number | null;
  chauffeurMode: string;
  supplementChauffeurJour: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [wantsDriver, setWantsDriver] = useState(chauffeurMode === "AVEC_CHAUFFEUR");

  const today = dayKey(todayUtc());
  const avecChauffeur = resolveWithDriver(chauffeurMode, wantsDriver);
  const debut = parseDay(dateDebut);
  const fin = parseDay(dateFin);
  const nombreJours = debut && fin && fin >= debut ? billedDays(debut, fin) : null;
  const total =
    prixJour !== null && nombreJours
      ? bookingTotal({ prixJour, supplementChauffeurJour, avecChauffeur, nombreJours })
      : null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    if (!debut || !fin || fin < debut) {
      setError("La date de retour doit être le jour de prise ou après.");
      return;
    }

    setIsPending(true);
    try {
      const res = await fetch("/api/storefront/vehicle-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId,
          vehicleId,
          dateDebut,
          dateFin,
          avecChauffeur,
          nomClient: formData.get("nomClient"),
          telephoneClient: formData.get("telephoneClient"),
          notes: formData.get("notes"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "L'envoi de la demande a échoué. Réessayez.");
        return;
      }
      router.push(`/vehicules/merci/${data.id}`);
    } catch {
      setError("L'envoi de la demande a échoué. Vérifiez votre connexion et réessayez.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">Demander une réservation</p>
      {error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateDebut">Prise du véhicule</Label>
          <Input
            id="dateDebut"
            type="date"
            required
            min={today}
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateFin">Retour</Label>
          <Input
            id="dateFin"
            type="date"
            required
            min={dateDebut || today}
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
          />
        </div>
      </div>

      {chauffeurMode === "AU_CHOIX" ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium text-foreground">Chauffeur</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: false, label: "Je conduis moi-même" },
              { value: true, label: "Avec chauffeur" },
            ].map((option) => (
              <label
                key={String(option.value)}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground has-checked:border-primary has-checked:bg-primary/5"
              >
                <input
                  type="radio"
                  name="chauffeur"
                  checked={wantsDriver === option.value}
                  onChange={() => setWantsDriver(option.value)}
                  className="accent-primary"
                />
                {option.label}
              </label>
            ))}
          </div>
          {prixJour !== null && supplementChauffeurJour > 0 && (
            <p className="text-xs text-muted-foreground">
              Chauffeur : + {formatMoney(supplementChauffeurJour, devise)} par jour.
            </p>
          )}
        </fieldset>
      ) : (
        <p className="text-sm text-muted-foreground">
          {chauffeurMode === "AVEC_CHAUFFEUR"
            ? "Ce véhicule est loué avec chauffeur."
            : "Ce véhicule est loué sans chauffeur : vous conduisez."}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nomClient">Nom</Label>
        <Input id="nomClient" name="nomClient" required autoComplete="name" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="telephoneClient">Téléphone</Label>
        <Input id="telephoneClient" name="telephoneClient" type="tel" inputMode="tel" required autoComplete="tel" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Précisions (optionnel)</Label>
        <Textarea id="notes" name="notes" rows={2} maxLength={500} placeholder="Lieu de prise, heure, trajet prévu…" />
      </div>

      {prixJour !== null ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2.5">
          <span className="text-sm font-medium text-foreground">
            {nombreJours ? `Total estimé (${nombreJours} jour${nombreJours > 1 ? "s" : ""})` : "Total estimé"}
          </span>
          <span className="num text-lg font-semibold text-foreground">
            {total !== null ? formatMoney(total, devise) : "—"}
          </span>
        </div>
      ) : (
        <p className="rounded-md border border-border bg-muted px-3 py-2.5 text-sm text-muted-foreground">
          Prix sur demande : vous serez rappelé pour connaître le tarif avant toute confirmation.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Aucun paiement maintenant : la réservation est confirmée par téléphone, et le règlement se fait à la remise du
        véhicule.
      </p>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Envoi…" : "Envoyer la demande"}
      </Button>
    </form>
  );
}

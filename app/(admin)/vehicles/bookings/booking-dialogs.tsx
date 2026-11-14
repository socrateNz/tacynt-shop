"use client";

import { useActionState, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";

import { DetailList } from "@/components/admin/page";
import { PhoneLink } from "@/components/phone-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/money";
import {
  billedDays,
  bookingTotal,
  parseDay,
  resolveWithDriver,
  VEHICLE_BOOKING_STATUS_LABELS,
  VEHICLE_BOOKING_STATUS_TONES,
} from "@/lib/vehicles/types";

import { createBookingByStaff, transitionBooking, type VehicleActionState } from "../actions";

const initial: VehicleActionState = { error: null };
const selectClass = "h-8 rounded-md border border-border bg-background px-2.5 text-sm";

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

export type BookingRow = {
  id: string;
  numero: string;
  statut: string;
  vehicule: string;
  nomClient: string;
  telephoneClient: string;
  periodeLabel: string;
  nombreJours: number;
  avecChauffeur: boolean;
  prixJourLabel: string;
  supplementLabel: string | null;
  cautionLabel: string | null;
  totalLabel: string;
  notes: string | null;
  createdAtLabel: string;
  origine: string;
};

// Étape suivante proposée selon le statut : une seule action principale à la
// fois (à droite), l'annulation à gauche.
const NEXT_STEP: Record<string, { step: string; label: string; pending: string } | undefined> = {
  DEMANDE: { step: "confirm", label: "Accepter la demande", pending: "Acceptation…" },
  CONFIRMEE: { step: "start", label: "Remettre le véhicule", pending: "Enregistrement…" },
  EN_COURS: { step: "complete", label: "Enregistrer le retour", pending: "Enregistrement…" },
};

const CANCEL_LABEL: Record<string, string | undefined> = {
  DEMANDE: "Refuser la demande",
  CONFIRMEE: "Annuler la réservation",
};

/** Fiche d'une réservation + actions (accepter, refuser, remise, retour). */
export function BookingDialog({ booking }: { booking: BookingRow }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(async (prev: VehicleActionState, formData: FormData) => {
    const next = await transitionBooking(prev, formData);
    if (next.ok) setOpen(false);
    return next;
  }, initial);

  const next = NEXT_STEP[booking.statut];
  const cancelLabel = CANCEL_LABEL[booking.statut];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant={booking.statut === "DEMANDE" ? "outline" : "ghost"} size="sm" onClick={() => setOpen(true)}>
        {booking.statut === "DEMANDE" ? "Traiter" : "Ouvrir"}
        <ChevronRight className="size-3.5" />
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Réservation {booking.numero}
            <Badge variant={VEHICLE_BOOKING_STATUS_TONES[booking.statut] ?? "secondary"}>
              {VEHICLE_BOOKING_STATUS_LABELS[booking.statut] ?? booking.statut}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <DetailList
          items={[
            { label: "Véhicule", value: booking.vehicule },
            {
              label: "Client",
              value: (
                <span className="flex flex-col">
                  {booking.nomClient}
                  <PhoneLink telephone={booking.telephoneClient} className="text-sm" />
                </span>
              ),
            },
            {
              label: "Période",
              value: `${booking.periodeLabel} (${booking.nombreJours} jour${booking.nombreJours > 1 ? "s" : ""})`,
            },
            { label: "Chauffeur", value: booking.avecChauffeur ? "Avec chauffeur" : "Sans chauffeur" },
            { label: "Demande reçue", value: `${booking.createdAtLabel} — ${booking.origine}` },
            ...(booking.notes ? [{ label: "Note", value: booking.notes }] : []),
          ]}
        />

        <dl className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Prix par jour</dt>
            <dd className="num text-foreground">{booking.prixJourLabel}</dd>
          </div>
          {booking.supplementLabel && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Supplément chauffeur par jour</dt>
              <dd className="num text-foreground">{booking.supplementLabel}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3 border-t border-border pt-1.5 font-semibold">
            <dt className="text-foreground">Total ({booking.nombreJours} j)</dt>
            <dd className="num text-foreground">{booking.totalLabel}</dd>
          </div>
          {booking.cautionLabel && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Caution à la remise</dt>
              <dd className="num text-foreground">{booking.cautionLabel}</dd>
            </div>
          )}
        </dl>

        <ErrorNote message={state.error} />

        {(next || cancelLabel) && (
          <form action={formAction} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <input type="hidden" name="bookingId" value={booking.id} />
            {cancelLabel ? (
              <Button
                type="submit"
                name="step"
                value="cancel"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={isPending}
              >
                {cancelLabel}
              </Button>
            ) : (
              <span />
            )}
            {next && (
              <Button type="submit" name="step" value={next.step} disabled={isPending}>
                {isPending ? next.pending : next.label}
              </Button>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export type BookableVehicle = { id: string; label: string; prixJour: number; chauffeurMode: string };

/** Réservation saisie par le personnel : confirmée tout de suite. */
export function NewBookingDialog({
  vehicles,
  devise,
  supplementChauffeurJour,
}: {
  vehicles: BookableVehicle[];
  devise: string;
  supplementChauffeurJour: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} disabled={vehicles.length === 0}>
        <Plus />
        Nouvelle réservation
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle réservation</DialogTitle>
        </DialogHeader>
        {/* key : formulaire et état d'action neufs à chaque ouverture. */}
        <NewBookingForm
          key={String(open)}
          vehicles={vehicles}
          devise={devise}
          supplementChauffeurJour={supplementChauffeurJour}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function NewBookingForm({
  vehicles,
  devise,
  supplementChauffeurJour,
  onDone,
}: {
  vehicles: BookableVehicle[];
  devise: string;
  supplementChauffeurJour: number;
  onDone: () => void;
}) {
  const [state, formAction, isPending] = useActionState(async (prev: VehicleActionState, formData: FormData) => {
    const next = await createBookingByStaff(prev, formData);
    if (next.ok) onDone();
    return next;
  }, initial);
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [wantsDriver, setWantsDriver] = useState(false);

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const avecChauffeur = vehicle ? resolveWithDriver(vehicle.chauffeurMode, wantsDriver) : false;
  const debut = parseDay(dateDebut);
  const fin = parseDay(dateFin);
  const nombreJours = debut && fin && fin >= debut ? billedDays(debut, fin) : null;
  const total =
    vehicle && nombreJours
      ? bookingTotal({ prixJour: vehicle.prixJour, supplementChauffeurJour, avecChauffeur, nombreJours })
      : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Pour un client au téléphone ou au comptoir. La réservation est confirmée immédiatement et réserve un
        exemplaire sur ces dates.
      </p>
      <ErrorNote message={state.error} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="vehicleId">Véhicule</Label>
        <select
          id="vehicleId"
          name="vehicleId"
          required
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className={selectClass}
        >
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label} — {formatMoney(v.prixJour, devise)} / jour
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateDebut">Prise du véhicule</Label>
          <Input
            id="dateDebut"
            name="dateDebut"
            type="date"
            required
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateFin">Retour</Label>
          <Input
            id="dateFin"
            name="dateFin"
            type="date"
            required
            min={dateDebut || undefined}
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
          />
        </div>
      </div>

      {vehicle?.chauffeurMode === "AU_CHOIX" ? (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="avecChauffeur"
            checked={wantsDriver}
            onChange={(e) => setWantsDriver(e.target.checked)}
            className="size-4 accent-primary"
          />
          Avec chauffeur
          {supplementChauffeurJour > 0 && (
            <span className="text-muted-foreground">(+ {formatMoney(supplementChauffeurJour, devise)} / jour)</span>
          )}
        </label>
      ) : (
        <p className="text-sm text-muted-foreground">
          {avecChauffeur ? "Ce véhicule est toujours loué avec chauffeur." : "Ce véhicule est loué sans chauffeur."}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nomClient">Nom du client</Label>
          <Input id="nomClient" name="nomClient" required autoComplete="off" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="telephoneClient">Téléphone</Label>
          <Input id="telephoneClient" name="telephoneClient" type="tel" inputMode="tel" required autoComplete="off" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Note (optionnel)</Label>
        <Textarea id="notes" name="notes" rows={2} placeholder="Lieu de remise, heure, précisions…" />
      </div>

      <div className="flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2.5">
        <span className="text-sm font-medium text-foreground">
          {nombreJours ? `Total (${nombreJours} jour${nombreJours > 1 ? "s" : ""})` : "Total"}
        </span>
        <span className="num text-lg font-semibold text-foreground">
          {total !== null ? formatMoney(total, devise) : "—"}
        </span>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Annuler
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Enregistrement…" : "Créer la réservation"}
        </Button>
      </div>
    </form>
  );
}

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { getStorefrontOrganization } from "@/lib/storefront/context";
import { VEHICLE_BOOKING_CUSTOMER_STATUS_LABELS, vehicleLabel } from "@/lib/vehicles/types";

import { StorefrontBreadcrumb } from "../../../../storefront-breadcrumb";

const day = (date: Date) => date.toLocaleDateString("fr-FR", { timeZone: "UTC" });

export default async function VehicleBookingThanksPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const organization = await getStorefrontOrganization("location_vehicules");
  if (!organization) notFound();

  const { bookingId } = await params;
  // Scopé à l'organisation résolue par host (RLS) : un id d'une autre
  // organisation ne correspond à rien.
  const booking = await withTenantContext({ organizationId: organization.id }, (tx) =>
    tx.vehicleBooking.findUnique({ where: { id: bookingId }, include: { vehicle: true } }),
  );
  if (!booking) notFound();

  // Le prix n'est montré que si l'administrateur l'affiche sur ce véhicule.
  const showPrice = booking.vehicle.afficherPrix;
  const showCaution = booking.vehicle.afficherCaution && booking.caution !== null;
  const devise = organization.devise;

  return (
    <div className="flex flex-col gap-6">
      <StorefrontBreadcrumb items={[{ label: "Véhicules", href: "/" }, { label: "Confirmation" }]} />

      <header className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" aria-hidden />
        <div>
          <h1 className="text-xl font-semibold text-success">Demande envoyée</h1>
          <p className="text-sm text-success/80">
            Numéro {booking.numero} — {VEHICLE_BOOKING_CUSTOMER_STATUS_LABELS[booking.statut] ?? booking.statut}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 text-sm">
        <p className="text-base font-medium text-foreground">{vehicleLabel(booking.vehicle)}</p>
        <p className="text-muted-foreground">
          Du {day(booking.dateDebut)} au {day(booking.dateFin)} ({booking.nombreJours} jour
          {booking.nombreJours > 1 ? "s" : ""}) — {booking.avecChauffeur ? "avec chauffeur" : "sans chauffeur"}
        </p>
        {showPrice && (
          <p className="num text-foreground">Total estimé : {formatMoney(booking.total, devise)}</p>
        )}
        {showCaution && (
          <p className="num text-muted-foreground">Caution à la remise : {formatMoney(booking.caution!, devise)}</p>
        )}
        <p className="mt-2 text-muted-foreground">
          Vous serez rappelé au {booking.telephoneClient} pour confirmer la réservation
          {showPrice ? "" : " et vous communiquer le tarif"}. Le règlement se fait à la remise du véhicule.
        </p>
      </div>

      <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
        ← Retour au catalogue
      </Link>
    </div>
  );
}

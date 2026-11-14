"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { notifyVehicleBookingStatus } from "@/lib/marketplace/notifications";
import { assertCapability } from "@/lib/permissions-server";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { assertVehiclesAllowed } from "@/lib/vehicles/access";
import {
  availableUnits,
  BOOKING_ERROR_MESSAGES,
  BookingError,
  createVehicleBookingWithNumero,
  prepareBooking,
} from "@/lib/vehicles/bookings";
import { parseDay } from "@/lib/vehicles/types";

export type VehicleActionState = { error: string | null; ok?: boolean };

function revalidate() {
  revalidatePath("/vehicles");
  revalidatePath("/vehicles/bookings");
}

async function context() {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "vehicles:manage");
  await assertVehiclesAllowed(ctx.organizationId);
  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  return { ctx, shopId };
}

// Supplément chauffeur par jour : un seul montant pour tous les véhicules de
// la boutique (décision utilisateur). Ne modifie jamais les réservations
// déjà enregistrées (montant figé sur chacune).
export async function updateDriverFee(_prev: VehicleActionState, formData: FormData): Promise<VehicleActionState> {
  const { ctx, shopId } = await context();
  const montant = Number(String(formData.get("supplementChauffeurJour") ?? "").trim() || 0);
  if (!Number.isFinite(montant) || montant < 0) return { error: "Montant invalide." };

  await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
    await tx.shop.update({ where: { id: shopId }, data: { supplementChauffeurJour: montant } });
    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "VEHICLE_DRIVER_FEE_UPDATED",
      entite: "shop",
      entiteId: shopId,
      apres: { supplementChauffeurJour: montant },
    });
  });
  revalidate();
  return { error: null, ok: true };
}

// Réservation saisie par le personnel (client au téléphone ou au comptoir) :
// créée directement CONFIRMEE, un exemplaire est réservé tout de suite.
export async function createBookingByStaff(_prev: VehicleActionState, formData: FormData): Promise<VehicleActionState> {
  const { ctx, shopId } = await context();

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const nomClient = String(formData.get("nomClient") ?? "").trim();
  const telephoneClient = String(formData.get("telephoneClient") ?? "").trim();
  const dateDebut = parseDay(formData.get("dateDebut"));
  const dateFin = parseDay(formData.get("dateFin"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!vehicleId || !nomClient || !telephoneClient || !dateDebut || !dateFin) {
    return { error: "Véhicule, client, téléphone et dates sont requis." };
  }

  try {
    await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
      const prepared = await prepareBooking(tx, {
        shopId,
        vehicleId,
        dateDebut,
        dateFin,
        avecChauffeur: formData.get("avecChauffeur") === "on",
        allowPast: true,
      });

      // Client léger retrouvé par téléphone — même principe que les
      // locations de logements.
      let customer = await tx.customer.findFirst({
        where: { organizationId: ctx.organizationId, telephone: telephoneClient },
      });
      if (!customer) {
        customer = await tx.customer.create({
          data: { organizationId: ctx.organizationId, nom: nomClient, telephone: telephoneClient },
        });
      }

      const booking = await createVehicleBookingWithNumero(tx, shopId, {
        organizationId: ctx.organizationId,
        shopId,
        vehicleId,
        customerId: customer.id,
        nomClient,
        telephoneClient,
        statut: "CONFIRMEE",
        dateDebut,
        dateFin,
        nombreJours: prepared.nombreJours,
        avecChauffeur: prepared.avecChauffeur,
        prixJour: prepared.prixJour,
        supplementChauffeurJour: prepared.supplementChauffeurJour,
        caution: prepared.caution,
        total: prepared.total,
        notes,
        confirmedAt: new Date(),
      });

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "VEHICLE_BOOKING_CREATED",
        entite: "vehicle_booking",
        entiteId: booking.id,
        apres: { numero: booking.numero, vehicleId, nombreJours: prepared.nombreJours, total: prepared.total },
      });
    });
  } catch (error) {
    if (error instanceof BookingError) return { error: BOOKING_ERROR_MESSAGES[error.code] };
    throw error;
  }

  revalidate();
  return { error: null, ok: true };
}

type Transition = "confirm" | "cancel" | "start" | "complete";

const TRANSITIONS: Record<
  Transition,
  { from: string[]; to: "CONFIRMEE" | "ANNULEE" | "EN_COURS" | "TERMINEE"; stamp: string; audit: string }
> = {
  confirm: { from: ["DEMANDE"], to: "CONFIRMEE", stamp: "confirmedAt", audit: "VEHICLE_BOOKING_CONFIRMED" },
  cancel: { from: ["DEMANDE", "CONFIRMEE"], to: "ANNULEE", stamp: "cancelledAt", audit: "VEHICLE_BOOKING_CANCELLED" },
  start: { from: ["CONFIRMEE"], to: "EN_COURS", stamp: "startedAt", audit: "VEHICLE_BOOKING_STARTED" },
  complete: { from: ["EN_COURS"], to: "TERMINEE", stamp: "returnedAt", audit: "VEHICLE_BOOKING_COMPLETED" },
};

// Une seule action pour les quatre étapes (accepter, refuser/annuler,
// remise du véhicule, retour) : mêmes contrôles, seul le statut cible change.
export async function transitionBooking(_prev: VehicleActionState, formData: FormData): Promise<VehicleActionState> {
  const { ctx, shopId } = await context();
  const bookingId = String(formData.get("bookingId") ?? "");
  const step = TRANSITIONS[String(formData.get("step") ?? "") as Transition];
  if (!bookingId || !step) return { error: "Action inconnue." };

  let notify = false;
  try {
    await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
      const booking = await tx.vehicleBooking.findUniqueOrThrow({
        where: { id: bookingId },
        include: { vehicle: { select: { id: true, quantite: true } } },
      });
      if (!step.from.includes(booking.statut)) throw new Error("STATUT");

      // Accepter une demande réserve un exemplaire : on revérifie qu'il en
      // reste un sur ces dates (d'autres demandes ont pu être acceptées
      // entre-temps).
      if (step.to === "CONFIRMEE") {
        const libres = await availableUnits(
          tx,
          booking.vehicle,
          { dateDebut: booking.dateDebut, dateFin: booking.dateFin },
          booking.id,
        );
        if (libres < 1) throw new BookingError("INDISPONIBLE");
      }

      await tx.vehicleBooking.update({
        where: { id: bookingId },
        data: { statut: step.to, [step.stamp]: new Date() },
      });
      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: step.audit,
        entite: "vehicle_booking",
        entiteId: bookingId,
        avant: { statut: booking.statut },
        apres: { statut: step.to },
      });
      notify = booking.marketplaceCustomerId !== null;
    });
  } catch (error) {
    if (error instanceof BookingError) {
      return { error: "Plus aucun exemplaire libre sur ces dates : cette demande ne peut pas être acceptée." };
    }
    if (error instanceof Error && error.message === "STATUT") {
      return { error: "Cette réservation a déjà changé de statut. Rechargez la page." };
    }
    throw error;
  }

  // Après la transaction : jamais bloquant (voir lib/marketplace/notifications.ts).
  if (notify) await notifyVehicleBookingStatus(bookingId);
  revalidate();
  return { error: null, ok: true };
}

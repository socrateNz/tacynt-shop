import type { Organization } from "@prisma/client";
import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { resolveStorefrontShopId } from "@/lib/storefront/context";
import {
  BOOKING_ERROR_MESSAGES,
  BookingError,
  createVehicleBookingWithNumero,
  prepareBooking,
} from "@/lib/vehicles/bookings";
import { parseDay } from "@/lib/vehicles/types";

// Public (aucune session) : demande de location d'un véhicule, en attente de
// réponse du personnel (statut DEMANDE). Aucun montant transmis par le client
// n'est accepté : prix, supplément chauffeur et caution sont relus côté
// serveur (prepareBooking).
//
// Partagé entre la vitrine web (organisation résolue par host) et l'app
// mobile Sodu (par id) — même découpage que create-rental-request.ts.
export async function createStorefrontVehicleBooking(
  request: Request,
  organization: Organization,
  options: { marketplaceCustomerId?: string } = {},
) {
  const body = (await request.json().catch(() => null)) as {
    shopId?: string;
    vehicleId?: string;
    nomClient?: string;
    telephoneClient?: string;
    dateDebut?: string;
    dateFin?: string;
    avecChauffeur?: boolean;
    notes?: string;
  } | null;
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const shopId = await resolveStorefrontShopId(organization.id, body.shopId ?? null);
  const vehicleId = String(body.vehicleId ?? "");
  const nomClient = String(body.nomClient ?? "").trim().slice(0, 120);
  const telephoneClient = String(body.telephoneClient ?? "").trim().slice(0, 40);
  const dateDebut = parseDay(body.dateDebut);
  const dateFin = parseDay(body.dateFin);
  const notes = String(body.notes ?? "").trim().slice(0, 500) || null;

  if (!shopId || !vehicleId || !nomClient || !telephoneClient || !dateDebut || !dateFin) {
    return NextResponse.json({ error: "Véhicule, nom, téléphone et dates sont requis." }, { status: 400 });
  }

  try {
    const booking = await withTenantContext({ organizationId: organization.id, shopId }, async (tx) => {
      const prepared = await prepareBooking(tx, {
        shopId,
        vehicleId,
        dateDebut,
        dateFin,
        avecChauffeur: body.avecChauffeur === true,
      });

      // Client léger retrouvé par téléphone — même principe que
      // /api/storefront/orders.
      let customer = await tx.customer.findFirst({
        where: { organizationId: organization.id, telephone: telephoneClient },
      });
      if (!customer) {
        customer = await tx.customer.create({
          data: { organizationId: organization.id, nom: nomClient, telephone: telephoneClient },
        });
      }

      const created = await createVehicleBookingWithNumero(tx, shopId, {
        organizationId: organization.id,
        shopId,
        vehicleId,
        customerId: customer.id,
        nomClient,
        telephoneClient,
        statut: "DEMANDE",
        dateDebut,
        dateFin,
        nombreJours: prepared.nombreJours,
        avecChauffeur: prepared.avecChauffeur,
        prixJour: prepared.prixJour,
        supplementChauffeurJour: prepared.supplementChauffeurJour,
        caution: prepared.caution,
        total: prepared.total,
        notes,
        marketplaceCustomerId: options.marketplaceCustomerId ?? null,
      });

      await recordAuditLog(tx, {
        organizationId: organization.id,
        userId: null,
        action: "VEHICLE_BOOKING_REQUESTED",
        entite: "vehicle_booking",
        entiteId: created.id,
        apres: { numero: created.numero, vehicleId, nombreJours: prepared.nombreJours },
      });

      return created;
    });

    return NextResponse.json({ id: booking.id, numero: booking.numero });
  } catch (error) {
    if (error instanceof BookingError) {
      return NextResponse.json({ error: BOOKING_ERROR_MESSAGES[error.code] }, { status: 400 });
    }
    throw error;
  }
}

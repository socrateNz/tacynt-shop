import { NextResponse } from "next/server";

import { systemPrisma } from "@/lib/db/system-client";
import { getMarketplaceCustomer, unauthorized } from "@/lib/marketplace/auth";

// Réservations de véhicules du client Sodu connecté — même principe que
// /api/marketplace/me/rental-requests. Le total n'est renvoyé que si
// l'administrateur affiche le prix de ce véhicule.
export async function GET(request: Request) {
  const customer = await getMarketplaceCustomer(request);
  if (!customer) return unauthorized();

  const bookings = await systemPrisma.vehicleBooking.findMany({
    where: { marketplaceCustomerId: customer.id },
    include: {
      organization: { select: { id: true, nom: true, devise: true } },
      shop: { select: { telephone: true } },
      vehicle: { select: { id: true, marque: true, modele: true, annee: true, afficherPrix: true, afficherCaution: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      numero: b.numero,
      statut: b.statut,
      createdAt: b.createdAt,
      dateDebut: b.dateDebut,
      dateFin: b.dateFin,
      nombreJours: b.nombreJours,
      avecChauffeur: b.avecChauffeur,
      total: b.vehicle.afficherPrix ? Number(b.total) : null,
      caution: b.vehicle.afficherCaution && b.caution !== null ? Number(b.caution) : null,
      devise: b.organization.devise,
      organizationId: b.organization.id,
      organizationNom: b.organization.nom,
      shopTelephone: b.shop.telephone,
      vehicleId: b.vehicle.id,
      designation: [b.vehicle.marque, b.vehicle.modele, b.vehicle.annee].filter(Boolean).join(" "),
    })),
  });
}

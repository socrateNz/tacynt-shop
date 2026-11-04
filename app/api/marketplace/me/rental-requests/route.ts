import { NextResponse } from "next/server";

import { systemPrisma } from "@/lib/db/system-client";
import { getMarketplaceCustomer, unauthorized } from "@/lib/marketplace/auth";

// Demandes de réservation du client Sodu connecté — même principe que
// app/api/marketplace/me/orders.
export async function GET(request: Request) {
  const customer = await getMarketplaceCustomer(request);
  if (!customer) return unauthorized();

  const contracts = await systemPrisma.rentalContract.findMany({
    where: { marketplaceCustomerId: customer.id },
    include: {
      organization: { select: { id: true, nom: true, devise: true } },
      shop: { select: { telephone: true } },
      rentalUnit: { select: { id: true, designation: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    requests: contracts.map((c) => ({
      id: c.id,
      numero: c.numero,
      statut: c.statut,
      createdAt: c.createdAt,
      dateDebut: c.dateDebut,
      dureeMois: c.dureeMois,
      montantMensuel: Number(c.montantMensuel),
      devise: c.organization.devise,
      organizationId: c.organization.id,
      organizationNom: c.organization.nom,
      shopTelephone: c.shop.telephone,
      rentalUnitId: c.rentalUnit.id,
      designation: c.rentalUnit.designation,
    })),
  });
}

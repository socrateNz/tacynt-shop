import { NextResponse } from "next/server";

import { systemPrisma } from "@/lib/db/system-client";
import { getMarketplaceCustomer, unauthorized } from "@/lib/marketplace/auth";

// Commandes du client Sodu connecté, toutes organisations confondues —
// lecture cross-organisation par construction, donc systemPrisma (même
// raisonnement que lib/marketplace/catalog.ts), toujours filtrée sur le
// compte authentifié : jamais une commande d'un autre client.
export async function GET(request: Request) {
  const customer = await getMarketplaceCustomer(request);
  if (!customer) return unauthorized();

  const orders = await systemPrisma.onlineOrder.findMany({
    where: { marketplaceCustomerId: customer.id },
    include: {
      organization: { select: { id: true, nom: true, devise: true } },
      shop: { select: { nom: true, telephone: true } },
      lines: { include: { variant: { include: { product: { select: { designation: true } } } } } },
      payments: { orderBy: { createdAt: "desc" }, take: 1, select: { statut: true, fournisseur: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      numero: o.numero,
      statut: o.statut,
      createdAt: o.createdAt,
      confirmedAt: o.confirmedAt,
      cancelledAt: o.cancelledAt,
      modeRetrait: o.modeRetrait,
      modePaiement: o.modePaiement,
      // Dernière tentative de paiement en ligne (null si aucune).
      paiement: o.payments[0] ? { statut: o.payments[0].statut, fournisseur: o.payments[0].fournisseur } : null,
      adresseLivraison: o.adresseLivraison,
      totalTtc: Number(o.totalTtc),
      devise: o.organization.devise,
      organizationId: o.organization.id,
      organizationNom: o.organization.nom,
      shopTelephone: o.shop.telephone,
      lines: o.lines.map((l) => ({
        designation: l.variant.product.designation,
        attributs: l.variant.attributs as Record<string, string>,
        quantite: Number(l.quantite),
        prixUnitaire: Number(l.prixUnitaire),
      })),
    })),
  });
}

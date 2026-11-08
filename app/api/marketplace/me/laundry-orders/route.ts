import { NextResponse } from "next/server";

import { systemPrisma } from "@/lib/db/system-client";
import { getMarketplaceCustomer, unauthorized } from "@/lib/marketplace/auth";

// Commandes de blanchisserie du client Sodu connecté, toutes organisations
// confondues (systemPrisma, toujours filtré sur le compte authentifié —
// même principe que /api/marketplace/me/orders).
export async function GET(request: Request) {
  const customer = await getMarketplaceCustomer(request);
  if (!customer) return unauthorized();

  const orders = await systemPrisma.laundryOrder.findMany({
    where: { marketplaceCustomerId: customer.id },
    include: {
      organization: { select: { id: true, nom: true, devise: true } },
      shop: { select: { telephone: true } },
      lines: { orderBy: { designation: "asc" } },
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
      modeAller: o.modeAller,
      modeRetour: o.modeRetour,
      modePaiement: o.modePaiement,
      paiement: o.payments[0] ? { statut: o.payments[0].statut, fournisseur: o.payments[0].fournisseur } : null,
      zoneLivraisonNom: o.zoneLivraisonNom,
      lieuDit: o.lieuDit,
      montantDeclare: Number(o.montantDeclare),
      fraisCollecte: Number(o.fraisCollecte),
      fraisLivraison: Number(o.fraisLivraison),
      totalDeclare: Number(o.totalDeclare),
      montantRecompte: o.montantRecompte === null ? null : Number(o.montantRecompte),
      regularisation: o.regularisation === null ? null : Number(o.regularisation),
      devise: o.organization.devise,
      organizationId: o.organization.id,
      organizationNom: o.organization.nom,
      shopTelephone: o.shop.telephone,
      lines: o.lines.map((l) => ({
        designation: l.designation,
        prixUnitaire: Number(l.prixUnitaire),
        quantiteDeclaree: l.quantiteDeclaree,
        quantiteRecomptee: l.quantiteRecomptee,
      })),
    })),
  });
}

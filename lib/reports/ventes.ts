import type { Prisma } from "@prisma/client";

import { shopScope } from "./scope";

export type VentesReport = {
  totalCa: number;
  totalTickets: number;
  panierMoyen: number;
  parJour: { date: string; ca: number; tickets: number }[];
  parVendeur: { userId: string; email: string; ca: number; tickets: number }[];
  parCategorie: { categorie: string; ca: number }[];
  parModePaiement: { mode: string; montant: number }[];
};

// "Par période, boutique, vendeur, catégorie, mode de paiement" (section
// 5.7). shopId=null consolide toute l'organisation (Phase 3, M20). Les
// quatre autres dimensions sont chacune une table de répartition séparée
// plutôt qu'un seul pivot multi-dimensionnel, plus simple à lire.
export async function getVentesReport(
  tx: Prisma.TransactionClient,
  shopId: string | null,
  from: Date,
  to: Date,
): Promise<VentesReport> {
  const sales = await tx.sale.findMany({
    where: { ...shopScope(shopId), statut: "VALIDEE", createdAt: { gte: from, lt: to } },
    include: {
      lines: { include: { variant: { include: { product: { include: { category: true } } } } } },
      payments: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const userIds = [...new Set(sales.map((s) => s.userId))];
  const users = userIds.length > 0 ? await tx.user.findMany({ where: { id: { in: userIds } } }) : [];
  const emailByUserId = new Map(users.map((u) => [u.id, u.email]));

  const totalCa = sales.reduce((sum, s) => sum + Number(s.totalTtc), 0);
  const totalTickets = sales.length;

  const parJourMap = new Map<string, { ca: number; tickets: number }>();
  const parVendeurMap = new Map<string, { ca: number; tickets: number }>();
  const parCategorieMap = new Map<string, number>();
  const parModeMap = new Map<string, number>();

  for (const sale of sales) {
    const jour = sale.createdAt.toISOString().slice(0, 10);
    const jourEntry = parJourMap.get(jour) ?? { ca: 0, tickets: 0 };
    jourEntry.ca += Number(sale.totalTtc);
    jourEntry.tickets += 1;
    parJourMap.set(jour, jourEntry);

    const vendeurEntry = parVendeurMap.get(sale.userId) ?? { ca: 0, tickets: 0 };
    vendeurEntry.ca += Number(sale.totalTtc);
    vendeurEntry.tickets += 1;
    parVendeurMap.set(sale.userId, vendeurEntry);

    for (const line of sale.lines) {
      const categorie = line.variant.product.category?.nom ?? "Sans catégorie";
      const ligneCa = Number(line.prixUnitaire) * Number(line.quantite) - Number(line.remise);
      parCategorieMap.set(categorie, (parCategorieMap.get(categorie) ?? 0) + ligneCa);
    }

    for (const payment of sale.payments) {
      parModeMap.set(payment.mode, (parModeMap.get(payment.mode) ?? 0) + Number(payment.montant));
    }
  }

  return {
    totalCa,
    totalTickets,
    panierMoyen: totalTickets > 0 ? totalCa / totalTickets : 0,
    parJour: [...parJourMap.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    parVendeur: [...parVendeurMap.entries()]
      .map(([userId, v]) => ({ userId, email: emailByUserId.get(userId) ?? userId, ...v }))
      .sort((a, b) => b.ca - a.ca),
    parCategorie: [...parCategorieMap.entries()]
      .map(([categorie, ca]) => ({ categorie, ca }))
      .sort((a, b) => b.ca - a.ca),
    parModePaiement: [...parModeMap.entries()]
      .map(([mode, montant]) => ({ mode, montant }))
      .sort((a, b) => b.montant - a.montant),
  };
}

import type { Prisma } from "@prisma/client";

import { shopScope } from "./scope";

export type RotationReport = {
  plusVendus: { designation: string; quantiteVendue: number }[];
  dormants: { designation: string; stockActuel: number }[];
  tauxRotation: { designation: string; quantiteVendue: number; stockActuel: number; taux: number }[];
};

// "Produits les plus vendus, produits dormants, taux de rotation du stock"
// (section 5.7). "Dormant" = aucune vente sur la période choisie (le
// sélecteur de période sert ici de fenêtre "N derniers jours", section 5.2)
// alors qu'il reste du stock — surstock qui immobilise du capital.
export async function getRotationReport(
  tx: Prisma.TransactionClient,
  shopId: string | null,
  from: Date,
  to: Date,
): Promise<RotationReport> {
  const [lines, stockLevels] = await Promise.all([
    tx.saleLine.findMany({
      where: { ...shopScope(shopId), sale: { statut: "VALIDEE", createdAt: { gte: from, lt: to } } },
      include: { variant: { include: { product: true } } },
    }),
    tx.stockLevel.findMany({
      where: { ...shopScope(shopId), quantite: { gt: 0 } },
      include: { variant: { include: { product: true } } },
    }),
  ]);

  const quantiteVendueByVariant = new Map<string, number>();
  for (const line of lines) {
    if (!line.variant.product.suiviStock) continue;
    quantiteVendueByVariant.set(
      line.variantId,
      (quantiteVendueByVariant.get(line.variantId) ?? 0) + Number(line.quantite),
    );
  }

  // En vue consolidée (shopId=null), un même variant a une ligne stock_levels
  // PAR boutique : on les agrège en un seul point par variant avant de
  // calculer quoi que ce soit — sinon plusVendus/dormants/tauxRotation
  // dupliqueraient le même produit une fois par boutique, avec un taux de
  // rotation faux (quantité vendue globale divisée par un stock partiel).
  const stockByVariant = new Map<string, { designation: string; quantite: number }>();
  for (const s of stockLevels) {
    if (!s.variant.product.suiviStock) continue;
    const entry = stockByVariant.get(s.variantId) ?? {
      designation: s.variant.product.designation,
      quantite: 0,
    };
    entry.quantite += Number(s.quantite);
    stockByVariant.set(s.variantId, entry);
  }

  const plusVendus = [...quantiteVendueByVariant.entries()]
    .map(([variantId, quantiteVendue]) => ({
      designation: stockByVariant.get(variantId)?.designation ?? variantId,
      quantiteVendue,
    }))
    .sort((a, b) => b.quantiteVendue - a.quantiteVendue)
    .slice(0, 20);

  const dormants = [...stockByVariant.entries()]
    .filter(([variantId]) => !quantiteVendueByVariant.has(variantId))
    .map(([, s]) => ({ designation: s.designation, stockActuel: s.quantite }));

  const tauxRotation = [...stockByVariant.entries()]
    .map(([variantId, s]) => {
      const quantiteVendue = quantiteVendueByVariant.get(variantId) ?? 0;
      return {
        designation: s.designation,
        quantiteVendue,
        stockActuel: s.quantite,
        taux: s.quantite > 0 ? quantiteVendue / s.quantite : 0,
      };
    })
    .sort((a, b) => b.taux - a.taux);

  return { plusVendus, dormants, tauxRotation };
}

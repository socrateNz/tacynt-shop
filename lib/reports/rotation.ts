import type { Prisma } from "@prisma/client";

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
  shopId: string,
  from: Date,
  to: Date,
): Promise<RotationReport> {
  const [lines, stockLevels] = await Promise.all([
    tx.saleLine.findMany({
      where: { shopId, sale: { statut: "VALIDEE", createdAt: { gte: from, lt: to } } },
      include: { variant: { include: { product: true } } },
    }),
    tx.stockLevel.findMany({
      where: { shopId, quantite: { gt: 0 } },
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

  const suiviStockLevels = stockLevels.filter((s) => s.variant.product.suiviStock);

  const plusVendus = [...quantiteVendueByVariant.entries()]
    .map(([variantId, quantiteVendue]) => {
      const level = suiviStockLevels.find((s) => s.variantId === variantId);
      return { designation: level?.variant.product.designation ?? variantId, quantiteVendue };
    })
    .sort((a, b) => b.quantiteVendue - a.quantiteVendue)
    .slice(0, 20);

  const dormants = suiviStockLevels
    .filter((s) => !quantiteVendueByVariant.has(s.variantId))
    .map((s) => ({ designation: s.variant.product.designation, stockActuel: Number(s.quantite) }));

  const tauxRotation = suiviStockLevels
    .map((s) => {
      const quantiteVendue = quantiteVendueByVariant.get(s.variantId) ?? 0;
      const stockActuel = Number(s.quantite);
      return {
        designation: s.variant.product.designation,
        quantiteVendue,
        stockActuel,
        taux: stockActuel > 0 ? quantiteVendue / stockActuel : 0,
      };
    })
    .sort((a, b) => b.taux - a.taux);

  return { plusVendus, dormants, tauxRotation };
}

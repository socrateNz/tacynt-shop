import type { Prisma } from "@prisma/client";

export type StockReport = {
  valorisationTotale: number;
  ecartsInventaire: {
    produit: string;
    theorique: number;
    compte: number;
    ecart: number;
    comptedAt: Date | null;
  }[];
  mouvements: { createdAt: Date; produit: string; type: string; quantite: number; coutUnitaire: number }[];
};

// "Valorisation totale, écarts d'inventaire, historique des mouvements"
// (section 5.7). La valorisation est un instantané (pas scopé période, un
// stock actuel n'a qu'une seule valeur) ; écarts et mouvements sont filtrés
// sur la période choisie.
export async function getStockReport(
  tx: Prisma.TransactionClient,
  shopId: string,
  from: Date,
  to: Date,
): Promise<StockReport> {
  const [stockLevels, counts, movements] = await Promise.all([
    tx.stockLevel.findMany({ where: { shopId } }),
    tx.inventoryCount.findMany({
      where: {
        inventorySession: { shopId },
        quantiteComptee: { not: null },
        comptedAt: { gte: from, lt: to },
      },
      include: { variant: { include: { product: true } } },
      orderBy: { comptedAt: "desc" },
    }),
    tx.stockMovement.findMany({
      where: { shopId, createdAt: { gte: from, lt: to } },
      include: { variant: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const valorisationTotale = stockLevels.reduce(
    (sum, s) => sum + Number(s.quantite) * Number(s.cump),
    0,
  );

  const ecartsInventaire = counts
    .map((c) => {
      const theorique = Number(c.quantiteTheorique);
      const compte = Number(c.quantiteComptee);
      return {
        produit: c.variant.product.designation,
        theorique,
        compte,
        ecart: compte - theorique,
        comptedAt: c.comptedAt,
      };
    })
    .filter((c) => c.ecart !== 0);

  const mouvements = movements.map((m) => ({
    createdAt: m.createdAt,
    produit: m.variant.product.designation,
    type: m.type,
    quantite: Number(m.quantite),
    coutUnitaire: Number(m.coutUnitaire),
  }));

  return { valorisationTotale, ecartsInventaire, mouvements };
}

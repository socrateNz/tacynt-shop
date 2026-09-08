import type { Prisma } from "@prisma/client";

export type MargesReport = {
  parProduit: { designation: string; ca: number; cout: number; marge: number; margePourcent: number }[];
  parCategorie: { categorie: string; ca: number; cout: number; marge: number; margePourcent: number }[];
};

// "Par produit et par catégorie, CA − coût CUMP" (section 5.7). Même
// formule que le tableau de bord journalier (lib/reports/daily.ts) : le
// coût vient de cout_unitaire_fige, jamais recalculé après coup — la marge
// historique ne bouge pas quand le prix d'achat évolue.
export async function getMargesReport(
  tx: Prisma.TransactionClient,
  shopId: string,
  from: Date,
  to: Date,
): Promise<MargesReport> {
  const lines = await tx.saleLine.findMany({
    where: { shopId, sale: { statut: "VALIDEE", createdAt: { gte: from, lt: to } } },
    include: { variant: { include: { product: { include: { category: true } } } } },
  });

  const parProduitMap = new Map<string, { ca: number; cout: number }>();
  const parCategorieMap = new Map<string, { ca: number; cout: number }>();

  for (const line of lines) {
    const ca = Number(line.prixUnitaire) * Number(line.quantite) - Number(line.remise);
    const cout = Number(line.coutUnitaireFige) * Number(line.quantite);

    const designation = line.variant.product.designation;
    const produitEntry = parProduitMap.get(designation) ?? { ca: 0, cout: 0 };
    produitEntry.ca += ca;
    produitEntry.cout += cout;
    parProduitMap.set(designation, produitEntry);

    const categorie = line.variant.product.category?.nom ?? "Sans catégorie";
    const categorieEntry = parCategorieMap.get(categorie) ?? { ca: 0, cout: 0 };
    categorieEntry.ca += ca;
    categorieEntry.cout += cout;
    parCategorieMap.set(categorie, categorieEntry);
  }

  function toRows<T extends { ca: number; cout: number }>(
    map: Map<string, T>,
    keyName: "designation" | "categorie",
  ) {
    return [...map.entries()]
      .map(([key, { ca, cout }]) => {
        const marge = ca - cout;
        return { [keyName]: key, ca, cout, marge, margePourcent: ca > 0 ? (marge / ca) * 100 : 0 };
      })
      .sort((a, b) => b.marge - a.marge);
  }

  return {
    parProduit: toRows(parProduitMap, "designation") as MargesReport["parProduit"],
    parCategorie: toRows(parCategorieMap, "categorie") as MargesReport["parCategorie"],
  };
}

import type { Prisma } from "@prisma/client";

export type StorefrontItem = {
  variantId: string;
  designation: string;
  attributs: Record<string, string>;
  prixVente: number;
  available: boolean;
};

// Lecture seule (Phase 4, M29) : le prix affiché ici n'est JAMAIS celui
// qu'une commande accepte (décision verrouillée #19) — au moment de
// commander (M30), le serveur relit ShopPrice à nouveau, jamais une valeur
// transmise par le client. disponibilité = StockLevel.quantite > 0
// seulement pour un produit à suiviStock ; un produit sans suivi de stock
// (service) est toujours disponible.
export async function getStorefrontCatalog(
  tx: Prisma.TransactionClient,
  shopId: string,
): Promise<StorefrontItem[]> {
  const variants = await tx.productVariant.findMany({
    where: { actif: true, product: { actif: true } },
    include: {
      product: true,
      shopPrices: { where: { shopId } },
      stockLevels: { where: { shopId } },
    },
    orderBy: { product: { designation: "asc" } },
  });

  return variants
    .filter((v) => v.shopPrices.length > 0)
    .map((v) => {
      const price = v.shopPrices[0];
      const stock = v.stockLevels[0];
      const available = !v.product.suiviStock || (stock ? Number(stock.quantite) > 0 : false);

      return {
        variantId: v.id,
        designation: v.product.designation,
        attributs: v.attributs as Record<string, string>,
        prixVente: Number(price.prixVente),
        available,
      };
    });
}

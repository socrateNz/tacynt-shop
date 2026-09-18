import type { Prisma } from "@prisma/client";

export type StorefrontItem = {
  variantId: string;
  productId: string;
  designation: string;
  categoryName: string | null;
  attributs: Record<string, string>;
  prixVente: number;
  available: boolean;
  coverImageId: string | null;
};

export type StorefrontProductDetail = StorefrontItem & {
  description: string | null;
  imageIds: string[];
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
      product: {
        include: {
          // Juste la couverture (position la plus basse) pour la grille —
          // jamais imageData ici, ni les 2 autres photos (inutiles tant
          // qu'on n'est pas sur la fiche détail, voir
          // getStorefrontProductDetail).
          images: { select: { id: true }, orderBy: { position: "asc" }, take: 1 },
          category: true,
        },
      },
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
        productId: v.productId,
        designation: v.product.designation,
        categoryName: v.product.category?.nom ?? null,
        attributs: v.attributs as Record<string, string>,
        prixVente: Number(price.prixVente),
        available,
        coverImageId: v.product.images[0]?.id ?? null,
      };
    });
}

// Fiche détail (M34) : requête dédiée par variantId plutôt qu'un filtrage
// de getStorefrontCatalog — la liste ne charge jamais la description ni
// plus d'une image, cette page-ci en a besoin des trois, pas de raison
// d'alourdir la liste pour ça.
export async function getStorefrontProductDetail(
  tx: Prisma.TransactionClient,
  shopId: string,
  variantId: string,
): Promise<StorefrontProductDetail | null> {
  const variant = await tx.productVariant.findFirst({
    where: { id: variantId, actif: true, product: { actif: true } },
    include: {
      product: {
        include: {
          images: { select: { id: true }, orderBy: { position: "asc" } },
          category: true,
        },
      },
      shopPrices: { where: { shopId } },
      stockLevels: { where: { shopId } },
    },
  });

  if (!variant || variant.shopPrices.length === 0) return null;

  const price = variant.shopPrices[0];
  const stock = variant.stockLevels[0];
  const available = !variant.product.suiviStock || (stock ? Number(stock.quantite) > 0 : false);
  const imageIds = variant.product.images.map((img) => img.id);

  return {
    variantId: variant.id,
    productId: variant.productId,
    designation: variant.product.designation,
    categoryName: variant.product.category?.nom ?? null,
    attributs: variant.attributs as Record<string, string>,
    prixVente: Number(price.prixVente),
    available,
    coverImageId: imageIds[0] ?? null,
    description: variant.product.description,
    imageIds,
  };
}

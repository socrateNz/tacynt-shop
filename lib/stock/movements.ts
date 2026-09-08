import type { Prisma, StockMovementType } from "@prisma/client";

type CreditStockParams = {
  organizationId: string;
  shopId: string;
  variantId: string;
  quantite: number; // positif : entrée
  coutUnitaire: number;
  type?: StockMovementType; // défaut RECEPTION
  documentType?: string | null;
  documentId?: string | null;
  userId?: string | null;
  motif?: string | null;
};

// Entrée de stock valorisée (CUMP recalculé) : réception manuelle (M4),
// réception fournisseur (M14)... Toute entrée qui apporte un nouveau prix
// d'achat doit passer par ici — extrait de receiveStock pour ne jamais
// dupliquer la formule CUMP une 3e fois.
//
// CUMP = (stock_actuel × CUMP_actuel + qté_entrée × prix_entrée) / (stock_actuel + qté_entrée)
export async function creditStock(tx: Prisma.TransactionClient, params: CreditStockParams) {
  const {
    organizationId,
    shopId,
    variantId,
    quantite,
    coutUnitaire,
    type = "RECEPTION",
    documentType = null,
    documentId = null,
    userId = null,
    motif = null,
  } = params;

  const movement = await tx.stockMovement.create({
    data: {
      organizationId,
      shopId,
      variantId,
      type,
      quantite,
      coutUnitaire,
      documentType,
      documentId,
      userId,
      motif,
    },
  });

  const current = await tx.stockLevel.findUnique({
    where: { variantId_shopId: { variantId, shopId } },
  });
  const stockActuel = current ? Number(current.quantite) : 0;
  const cumpActuel = current ? Number(current.cump) : 0;
  const nouvelleQuantite = stockActuel + quantite;
  const nouveauCump = (stockActuel * cumpActuel + quantite * coutUnitaire) / nouvelleQuantite;

  await tx.stockLevel.upsert({
    where: { variantId_shopId: { variantId, shopId } },
    create: { organizationId, variantId, shopId, quantite: nouvelleQuantite, cump: nouveauCump },
    update: { quantite: nouvelleQuantite, cump: nouveauCump },
  });

  return { movement, nouvelleQuantite, cump: nouveauCump };
}

type AdjustStockQuantityParams = {
  organizationId: string;
  shopId: string;
  variantId: string;
  delta: number; // signé, ±, jamais 0
  type?: StockMovementType; // défaut AJUSTEMENT
  documentType?: string | null;
  documentId?: string | null;
  userId?: string | null;
  motif?: string | null;
};

// Correction de quantité sans nouveau prix d'achat (ajustement d'inventaire
// M7/M16, retour client sur annulation de ticket) : le CUMP ne bouge
// jamais — extrait de adjustStock pour la même raison que creditStock.
export async function adjustStockQuantity(
  tx: Prisma.TransactionClient,
  params: AdjustStockQuantityParams,
) {
  const {
    organizationId,
    shopId,
    variantId,
    delta,
    type = "AJUSTEMENT",
    documentType = null,
    documentId = null,
    userId = null,
    motif = null,
  } = params;

  const current = await tx.stockLevel.findUnique({
    where: { variantId_shopId: { variantId, shopId } },
  });
  const stockActuel = current ? Number(current.quantite) : 0;
  const cumpActuel = current ? Number(current.cump) : 0;
  const nouvelleQuantite = stockActuel + delta;

  const movement = await tx.stockMovement.create({
    data: {
      organizationId,
      shopId,
      variantId,
      type,
      quantite: delta,
      coutUnitaire: cumpActuel,
      documentType,
      documentId,
      userId,
      motif,
    },
  });

  await tx.stockLevel.upsert({
    where: { variantId_shopId: { variantId, shopId } },
    create: {
      organizationId,
      variantId,
      shopId,
      quantite: nouvelleQuantite,
      cump: cumpActuel,
    },
    update: { quantite: nouvelleQuantite },
  });

  return { movement, nouvelleQuantite, cump: cumpActuel };
}

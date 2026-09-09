import type { Prisma, StockMovementType } from "@prisma/client";

type ConsumeLotsFefoParams = {
  organizationId: string;
  shopId: string;
  variantId: string;
  quantite: number; // positif : quantité à sortir
  type: StockMovementType;
  documentType?: string | null;
  documentId?: string | null;
  userId?: string | null;
  motif?: string | null;
  createdAt?: Date;
};

// FEFO (premier périmé, premier sorti — section 5.1) : consomme les lots à
// quantité > 0 triés par date de péremption croissante (NULLS LAST, un lot
// sans date connue n'expire jamais et n'est donc consommé qu'en dernier
// recours). Une seule sortie logique (une ligne de vente, un ajustement)
// peut générer PLUSIEURS mouvements de stock si elle chevauche deux lots —
// c'est la seule différence avec adjustStockQuantity, le CUMP ne bouge
// toujours jamais sur une sortie.
export async function consumeLotsFefo(
  tx: Prisma.TransactionClient,
  params: ConsumeLotsFefoParams,
): Promise<{ coutUnitaireFige: number; nouvelleQuantite: number; expiredLotConsumed: boolean }> {
  const {
    organizationId,
    shopId,
    variantId,
    quantite,
    type,
    documentType = null,
    documentId = null,
    userId = null,
    motif = null,
    createdAt,
  } = params;

  const stockLevelBefore = await tx.stockLevel.findUnique({
    where: { variantId_shopId: { variantId, shopId } },
  });
  const coutUnitaireFige = stockLevelBefore ? Number(stockLevelBefore.cump) : 0;

  const lots = await tx.lot.findMany({
    where: { organizationId, shopId, variantId, quantite: { gt: 0 } },
    orderBy: { datePeremption: "asc" },
  });

  const now = new Date();
  let remaining = quantite;
  let expiredLotConsumed = false;

  for (const lot of lots) {
    if (remaining <= 0) break;
    const consumed = Math.min(Number(lot.quantite), remaining);
    if (consumed <= 0) continue;

    if (lot.datePeremption && lot.datePeremption < now) {
      expiredLotConsumed = true;
    }

    await tx.stockMovement.create({
      data: {
        organizationId,
        shopId,
        variantId,
        type,
        quantite: -consumed,
        coutUnitaire: coutUnitaireFige,
        documentType,
        documentId,
        userId,
        motif,
        lotId: lot.id,
        ...(createdAt ? { createdAt } : {}),
      },
    });

    await tx.lot.update({ where: { id: lot.id }, data: { quantite: { decrement: consumed } } });

    remaining -= consumed;
  }

  // Reliquat non couvert par un lot connu (stock déjà négatif avant
  // l'activation du suivi par lots, ou lots insuffisants) : un mouvement
  // sans lotId, comme pour un variant non suivi — jamais bloquant, même
  // principe que le stock négatif après resynchronisation (section 7.3).
  if (remaining > 0) {
    await tx.stockMovement.create({
      data: {
        organizationId,
        shopId,
        variantId,
        type,
        quantite: -remaining,
        coutUnitaire: coutUnitaireFige,
        documentType,
        documentId,
        userId,
        motif,
        ...(createdAt ? { createdAt } : {}),
      },
    });
  }

  const stockActuel = stockLevelBefore ? Number(stockLevelBefore.quantite) : 0;
  const nouvelleQuantite = stockActuel - quantite;

  await tx.stockLevel.upsert({
    where: { variantId_shopId: { variantId, shopId } },
    create: { organizationId, variantId, shopId, quantite: nouvelleQuantite, cump: coutUnitaireFige },
    update: { quantite: nouvelleQuantite },
  });

  return { coutUnitaireFige, nouvelleQuantite, expiredLotConsumed };
}

import type { Prisma } from "@prisma/client";

type AssignSerialNumbersFifoParams = {
  organizationId: string;
  shopId: string;
  variantId: string;
  quantite: number; // positif : nombre d'unités vendues
  saleLineId: string;
  soldAt?: Date;
};

// Affectation automatique en FIFO (première unité reçue, première vendue) —
// la caisse hors ligne ne scanne pas de numéro de série au point de vente
// (section 6, Phase 3 M23). Un reliquat non couvert (moins de numéros connus
// "en stock" que d'unités vendues — stock reçu avant l'activation du suivi,
// ou ajustement manuel) n'est jamais bloquant, même principe que le reliquat
// FEFO de lib/stock/lots.ts : la vente déjà encaissée reste appliquée telle
// quelle, simplement sans traçabilité individuelle pour les unités
// manquantes.
export async function assignSerialNumbersFifo(
  tx: Prisma.TransactionClient,
  params: AssignSerialNumbersFifoParams,
): Promise<{ assigned: number; shortfall: number }> {
  const { organizationId, shopId, variantId, quantite, saleLineId, soldAt } = params;

  const available = await tx.serialNumber.findMany({
    where: { organizationId, shopId, variantId, statut: "EN_STOCK" },
    orderBy: { receivedAt: "asc" },
    take: quantite,
  });

  if (available.length > 0) {
    await tx.serialNumber.updateMany({
      where: { id: { in: available.map((s) => s.id) } },
      data: { statut: "VENDU", saleLineId, soldAt: soldAt ?? new Date() },
    });
  }

  return { assigned: available.length, shortfall: quantite - available.length };
}

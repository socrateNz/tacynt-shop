import type { Prisma, LoyaltyLedgerType } from "@prisma/client";

// Solde = SUM(points), jamais un compteur mutable — même philosophie que
// lib/customers/ledger.ts.
export async function getLoyaltyBalance(
  tx: Prisma.TransactionClient,
  customerId: string,
): Promise<number> {
  const result = await tx.loyaltyLedger.aggregate({
    where: { customerId },
    _sum: { points: true },
  });
  return result._sum.points ?? 0;
}

type RecordLoyaltyEntryParams = {
  organizationId: string;
  customerId: string;
  type: LoyaltyLedgerType;
  points: number;
  documentType?: string | null;
  documentId?: string | null;
};

export async function recordLoyaltyEntry(
  tx: Prisma.TransactionClient,
  params: RecordLoyaltyEntryParams,
) {
  return tx.loyaltyLedger.create({
    data: {
      organizationId: params.organizationId,
      customerId: params.customerId,
      type: params.type,
      points: params.points,
      documentType: params.documentType ?? null,
      documentId: params.documentId ?? null,
    },
  });
}

import type { Prisma, CustomerLedgerType } from "@prisma/client";

// Solde = SUM(montant), jamais une colonne mutable (même philosophie que
// stock_levels vs stock_movements) : positif = le client doit, négatif =
// il a payé d'avance / a un avoir.
export async function getCustomerBalance(
  tx: Prisma.TransactionClient,
  customerId: string,
): Promise<number> {
  const result = await tx.customerLedger.aggregate({
    where: { customerId },
    _sum: { montant: true },
  });
  return Number(result._sum.montant ?? 0);
}

type RecordLedgerEntryParams = {
  organizationId: string;
  customerId: string;
  type: CustomerLedgerType;
  montant: number;
  documentType?: string | null;
  documentId?: string | null;
  userId?: string | null;
  motif?: string | null;
};

export async function recordCustomerLedgerEntry(
  tx: Prisma.TransactionClient,
  params: RecordLedgerEntryParams,
) {
  return tx.customerLedger.create({
    data: {
      organizationId: params.organizationId,
      customerId: params.customerId,
      type: params.type,
      montant: params.montant,
      documentType: params.documentType ?? null,
      documentId: params.documentId ?? null,
      userId: params.userId ?? null,
      motif: params.motif ?? null,
    },
  });
}

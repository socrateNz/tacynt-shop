import type { Prisma, SupplierLedgerType } from "@prisma/client";

// Solde = SUM(montant), jamais une colonne mutable — même philosophie que
// lib/customers/ledger.ts : positif = on doit au fournisseur, négatif = on a
// payé d'avance / on a un avoir.
export async function getSupplierBalance(
  tx: Prisma.TransactionClient,
  supplierId: string,
): Promise<number> {
  const result = await tx.supplierLedger.aggregate({
    where: { supplierId },
    _sum: { montant: true },
  });
  return Number(result._sum.montant ?? 0);
}

type RecordLedgerEntryParams = {
  organizationId: string;
  supplierId: string;
  type: SupplierLedgerType;
  montant: number;
  documentType?: string | null;
  documentId?: string | null;
  userId?: string | null;
  motif?: string | null;
};

export async function recordSupplierLedgerEntry(
  tx: Prisma.TransactionClient,
  params: RecordLedgerEntryParams,
) {
  return tx.supplierLedger.create({
    data: {
      organizationId: params.organizationId,
      supplierId: params.supplierId,
      type: params.type,
      montant: params.montant,
      documentType: params.documentType ?? null,
      documentId: params.documentId ?? null,
      userId: params.userId ?? null,
      motif: params.motif ?? null,
    },
  });
}

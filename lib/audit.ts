import type { Prisma } from "@prisma/client";

type AuditEntry = {
  organizationId: string;
  userId?: string | null;
  action: string;
  entite: string;
  entiteId?: string | null;
  avant?: unknown;
  apres?: unknown;
  ip?: string | null;
};

// Écrivain append-only : aucune méthode d'update/delete n'existe ici ni
// ailleurs pour audit_logs (section 5.8 : "toute action sensible est
// tracée de façon inaltérable").
export async function recordAuditLog(
  tx: Prisma.TransactionClient,
  entry: AuditEntry,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      organizationId: entry.organizationId,
      userId: entry.userId ?? null,
      action: entry.action,
      entite: entry.entite,
      entiteId: entry.entiteId ?? null,
      avant:
        entry.avant === undefined ? undefined : (entry.avant as Prisma.InputJsonValue),
      apres:
        entry.apres === undefined ? undefined : (entry.apres as Prisma.InputJsonValue),
      ip: entry.ip ?? null,
    },
  });
}

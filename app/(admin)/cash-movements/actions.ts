"use server";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getTenantContext } from "@/lib/tenant/context";

export type CashMovementState = { error: string | null };

// Formulaire intégré à l'écran caisse (app/(pos)/caisse/pos-client.tsx), pas
// une page admin séparée (section M15) — cash_session:manage suffit, pas de
// nouvelle capacité dédiée.
export async function recordCashMovement(
  _prevState: CashMovementState,
  formData: FormData,
): Promise<CashMovementState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "cash_session:manage");

  const cashSessionId = String(formData.get("cashSessionId") ?? "");
  const type = String(formData.get("type") ?? "");
  const montant = Number(formData.get("montant") ?? NaN);
  const motif = String(formData.get("motif") ?? "").trim();

  if (
    !cashSessionId ||
    !["APPRO", "PRELEVEMENT", "DEPOT_BANQUE"].includes(type) ||
    !Number.isFinite(montant) ||
    montant <= 0 ||
    !motif
  ) {
    return { error: "Type, montant (positif) et motif sont requis." };
  }

  // La boutique de la session, jamais celle "active" de l'appelant (même
  // raison que sessions/open et sync/sales, Phase 3 M18/M20).
  const session = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.cashSession.findUniqueOrThrow({ where: { id: cashSessionId } }),
  );
  if (session.closedAt) {
    return { error: "Cette session de caisse est déjà fermée." };
  }
  const shopId = session.shopId;

  await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
    const movement = await tx.cashMovement.create({
      data: {
        organizationId: ctx.organizationId,
        shopId,
        cashSessionId,
        type: type as "APPRO" | "PRELEVEMENT" | "DEPOT_BANQUE",
        montant,
        motif,
        userId: ctx.userId,
      },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "CASH_MOVEMENT_RECORDED",
      entite: "cash_movement",
      entiteId: movement.id,
      apres: { type, montant, motif },
    });
  });

  return { error: null };
}

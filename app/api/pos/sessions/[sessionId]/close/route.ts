import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

// Rapprochement (section 5.6) : espèces théoriques = fond + ventes espèces
// (+ entrées − sorties − dépenses payées en espèces, non trackées en Phase 1
// — fournisseurs/dépenses arrivent en Phase 2).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const ctx = await getTenantContext();
  assertCapability(ctx.role, "cash_session:manage");

  const { sessionId } = await params;
  const body = await request.json();
  const compteFinal = Number(body.compteFinal ?? NaN);

  if (!Number.isFinite(compteFinal) || compteFinal < 0) {
    return NextResponse.json({ error: "Comptage final (valide) requis." }, { status: 400 });
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  try {
    const result = await withTenantContext(
      { organizationId: ctx.organizationId, shopId },
      async (tx) => {
        const session = await tx.cashSession.findUniqueOrThrow({ where: { id: sessionId } });
        if (session.closedAt) {
          throw new Error("ALREADY_CLOSED");
        }

        const especesPayments = await tx.payment.aggregate({
          where: { mode: "ESPECES", sale: { sessionId } },
          _sum: { montant: true },
        });
        const ventesEspeces = Number(especesPayments._sum.montant ?? 0);
        const especesTheoriques = Number(session.fondInitial) + ventesEspeces;
        const ecart = compteFinal - especesTheoriques;

        const closed = await tx.cashSession.update({
          where: { id: sessionId },
          data: { compteFinal, ecart, closedAt: new Date() },
        });

        await recordAuditLog(tx, {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: "CASH_SESSION_CLOSED",
          entite: "cash_session",
          entiteId: sessionId,
          apres: { compteFinal, especesTheoriques, ecart },
        });

        return { especesTheoriques, ecart, compteFinal, fondInitial: Number(closed.fondInitial) };
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_CLOSED") {
      return NextResponse.json({ error: "Cette session est déjà fermée." }, { status: 409 });
    }
    throw error;
  }
}

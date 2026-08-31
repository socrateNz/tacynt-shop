import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

export async function POST(request: Request) {
  const ctx = await getTenantContext();
  assertCapability(ctx.role, "cash_session:manage");

  const body = await request.json();
  const registerId = String(body.registerId ?? "");
  const fondInitial = Number(body.fondInitial ?? 0);

  if (!registerId || !Number.isFinite(fondInitial) || fondInitial < 0) {
    return NextResponse.json(
      { error: "Poste de caisse et fond initial (valide) requis." },
      { status: 400 },
    );
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  const session = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    async (tx) => {
      // Idempotent : rouvrir la même caisse renvoie la session déjà ouverte
      // plutôt que d'en créer une seconde en double.
      const existing = await tx.cashSession.findFirst({
        where: { registerId, closedAt: null },
      });
      if (existing) return existing;

      const created = await tx.cashSession.create({
        data: {
          organizationId: ctx.organizationId,
          shopId,
          registerId,
          userId: ctx.userId,
          fondInitial,
        },
      });

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "CASH_SESSION_OPENED",
        entite: "cash_session",
        entiteId: created.id,
        apres: { fondInitial },
      });

      return created;
    },
  );

  return NextResponse.json({ sessionId: session.id, fondInitial: Number(session.fondInitial) });
}

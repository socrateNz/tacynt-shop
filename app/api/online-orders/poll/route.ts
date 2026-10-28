import { NextResponse } from "next/server";

import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getAssignedShopIds } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";

// Même garde que app/(admin)/online-orders/page.tsx — cette route n'existe
// que pour détecter de nouvelles commandes depuis le dernier rendu de cette
// page côté client (app/(admin)/online-orders/live-updates.tsx), jamais pour
// remplacer la requête complète de la page elle-même.
export async function GET(request: Request) {
  const ctx = await getTenantContext();
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  if (
    !hasCapability(ctx.role, "ecommerce:manage") ||
    !organizationHasModule(organization.enabledModules, "ecommerce")
  ) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const after = new URL(request.url).searchParams.get("after");
  const afterDate = after ? new Date(after) : null;
  if (!afterDate || Number.isNaN(afterDate.getTime())) {
    return NextResponse.json({ error: "Paramètre after invalide." }, { status: 400 });
  }

  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);
  const orders = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.onlineOrder.findMany({
      where: { shopId: { in: myShopIds }, createdAt: { gt: afterDate } },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
  );

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      numero: o.numero,
      nomClient: o.nomClient,
      totalTtcLabel: formatMoney(o.totalTtc, organization.devise),
      createdAt: o.createdAt.toISOString(),
    })),
  });
}

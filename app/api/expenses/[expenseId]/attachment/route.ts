import { NextResponse } from "next/server";

import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getAssignedShopIds } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

// L'isolation tenant est héritée de RLS : un expenseId d'une autre
// organisation ne matche simplement aucune ligne (section M15). L'isolation
// boutique, elle, ne l'est pas (app.shop_id non positionné ci-dessous, une
// dépense pouvant être approuvée par un utilisateur affecté à plusieurs
// boutiques) — vérifiée explicitement contre les boutiques affectées.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ expenseId: string }> },
) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "expenses:manage");
  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);

  const { expenseId } = await params;

  const expense = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.expense.findUnique({ where: { id: expenseId } }),
  );

  if (!expense || !expense.justificatifData || !myShopIds.includes(expense.shopId)) {
    return NextResponse.json({ error: "Justificatif introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(expense.justificatifData), {
    headers: {
      "Content-Type": expense.justificatifMimeType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

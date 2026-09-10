import { NextResponse } from "next/server";

import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getTenantContext } from "@/lib/tenant/context";

// L'isolation tenant est héritée de RLS : un expenseId d'une autre
// organisation ne matche simplement aucune ligne (section M15).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ expenseId: string }> },
) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "expenses:manage");

  const { expenseId } = await params;

  const expense = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.expense.findUnique({ where: { id: expenseId } }),
  );

  if (!expense || !expense.justificatifData) {
    return NextResponse.json({ error: "Justificatif introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(expense.justificatifData), {
    headers: {
      "Content-Type": expense.justificatifMimeType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

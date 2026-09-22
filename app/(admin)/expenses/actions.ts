"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getAssignedShopIds } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

async function setExpenseStatus(expenseId: string, statut: "VALIDEE" | "REJETEE") {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "expenses:approve");
  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const expense = await tx.expense.findUniqueOrThrow({ where: { id: expenseId } });
    // Ne jamais approuver/rejeter une dépense d'une boutique où cet
    // utilisateur n'a rien à faire, même avec expenses:approve.
    if (!myShopIds.includes(expense.shopId)) return;
    if (expense.statut !== "EN_ATTENTE") return;

    await tx.expense.update({
      where: { id: expenseId },
      data: { statut, approvedByUserId: ctx.userId, approvedAt: new Date() },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: statut === "VALIDEE" ? "EXPENSE_APPROVED" : "EXPENSE_REJECTED",
      entite: "expense",
      entiteId: expenseId,
    });
  });

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${expenseId}`);
}

export async function approveExpense(formData: FormData) {
  const expenseId = String(formData.get("expenseId") ?? "");
  if (!expenseId) return;
  await setExpenseStatus(expenseId, "VALIDEE");
}

export async function rejectExpense(formData: FormData) {
  const expenseId = String(formData.get("expenseId") ?? "");
  if (!expenseId) return;
  await setExpenseStatus(expenseId, "REJETEE");
}

"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getTenantContext } from "@/lib/tenant/context";

async function setExpenseStatus(expenseId: string, statut: "VALIDEE" | "REJETEE") {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "expenses:approve");

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const expense = await tx.expense.findUniqueOrThrow({ where: { id: expenseId } });
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

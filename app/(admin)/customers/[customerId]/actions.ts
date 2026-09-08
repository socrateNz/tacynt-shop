"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { recordCustomerLedgerEntry } from "@/lib/customers/ledger";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";

export type PaymentFormState = { error: string | null };

export async function recordPayment(
  _prevState: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const ctx = await getTenantContext();
  assertCapability(ctx.role, "customers:manage");

  const customerId = String(formData.get("customerId") ?? "");
  const montant = Number(formData.get("montant") ?? NaN);
  const motif = String(formData.get("motif") ?? "").trim() || null;

  if (!customerId || !Number.isFinite(montant) || montant <= 0) {
    return { error: "Montant (positif) requis." };
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    // Un paiement réduit la dette : montant négatif dans le journal signé.
    const entry = await recordCustomerLedgerEntry(tx, {
      organizationId: ctx.organizationId,
      customerId,
      type: "PAIEMENT",
      montant: -montant,
      userId: ctx.userId,
      motif,
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "CUSTOMER_PAYMENT_RECORDED",
      entite: "customer_ledger",
      entiteId: entry.id,
      apres: { customerId, montant },
    });
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  return { error: null };
}

export type CustomerUpdateState = { error: string | null };

export async function updateCustomer(
  _prevState: CustomerUpdateState,
  formData: FormData,
): Promise<CustomerUpdateState> {
  const ctx = await getTenantContext();
  assertCapability(ctx.role, "customers:manage");

  const customerId = String(formData.get("customerId") ?? "");
  const categorieTarif = String(formData.get("categorieTarif") ?? "").trim();
  const plafondCredit = Number(formData.get("plafondCredit") ?? NaN);
  const actif = formData.get("actif") === "on";

  if (!customerId || !Number.isFinite(plafondCredit) || plafondCredit < 0) {
    return { error: "Plafond de crédit (valide) requis." };
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    await tx.customer.update({
      where: { id: customerId },
      data: { categorieTarif, plafondCredit, actif },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "CUSTOMER_UPDATED",
      entite: "customer",
      entiteId: customerId,
      apres: { categorieTarif, plafondCredit, actif },
    });
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  return { error: null };
}

"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getTenantContext } from "@/lib/tenant/context";

export type CustomerFormState = { error: string | null };

export async function createCustomer(
  _prevState: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "customers:manage");

  const nom = String(formData.get("nom") ?? "").trim();
  const telephone = String(formData.get("telephone") ?? "").trim() || null;
  const categorieTarif = String(formData.get("categorieTarif") ?? "").trim();
  const plafondCredit = Number(formData.get("plafondCredit") ?? 0);

  if (!nom || !Number.isFinite(plafondCredit) || plafondCredit < 0) {
    return { error: "Nom et plafond de crédit (valide) sont requis." };
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const customer = await tx.customer.create({
      data: {
        organizationId: ctx.organizationId,
        nom,
        telephone,
        categorieTarif,
        plafondCredit,
      },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "CUSTOMER_CREATED",
      entite: "customer",
      entiteId: customer.id,
      apres: { nom, telephone, categorieTarif, plafondCredit },
    });
  });

  revalidatePath("/customers");
  return { error: null };
}

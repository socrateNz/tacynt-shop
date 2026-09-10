"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getTenantContext } from "@/lib/tenant/context";

export type SupplierFormState = { error: string | null };

export async function createSupplier(
  _prevState: SupplierFormState,
  formData: FormData,
): Promise<SupplierFormState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "suppliers:manage");

  const nom = String(formData.get("nom") ?? "").trim();
  const telephone = String(formData.get("telephone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const delaiRaw = String(formData.get("delaiLivraisonJours") ?? "").trim();
  const delaiLivraisonJours = delaiRaw ? Number(delaiRaw) : null;

  if (!nom) {
    return { error: "Le nom du fournisseur est requis." };
  }
  if (delaiLivraisonJours !== null && (!Number.isFinite(delaiLivraisonJours) || delaiLivraisonJours < 0)) {
    return { error: "Délai de livraison invalide." };
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const supplier = await tx.supplier.create({
      data: {
        organizationId: ctx.organizationId,
        nom,
        telephone,
        email,
        delaiLivraisonJours,
      },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "SUPPLIER_CREATED",
      entite: "supplier",
      entiteId: supplier.id,
      apres: { nom, telephone, email, delaiLivraisonJours },
    });
  });

  revalidatePath("/suppliers");
  return { error: null };
}

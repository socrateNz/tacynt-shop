"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";

export async function createCategory(formData: FormData) {
  const ctx = await getTenantContext();
  assertCapability(ctx.role, "catalog:write");

  const nom = String(formData.get("nom") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "") || null;

  if (!nom) {
    throw new Error("Le nom de la catégorie est requis.");
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const category = await tx.category.create({
      data: { organizationId: ctx.organizationId, nom, parentId },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "CATEGORY_CREATED",
      entite: "category",
      entiteId: category.id,
      apres: { nom, parentId },
    });
  });

  revalidatePath("/catalog/categories");
}

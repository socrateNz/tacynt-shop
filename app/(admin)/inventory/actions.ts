"use server";

import { redirect } from "next/navigation";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

export type InventorySessionFormState = { error: string | null };

export async function startInventorySession(
  _prevState: InventorySessionFormState,
  formData: FormData,
): Promise<InventorySessionFormState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "inventory:manage");

  const type = String(formData.get("type") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "") || null;

  if (!["COMPLET", "PARTIEL"].includes(type)) {
    return { error: "Type d'inventaire requis." };
  }
  if (type === "PARTIEL" && !categoryId) {
    return { error: "Une catégorie est requise pour un inventaire partiel." };
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  const session = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    async (tx) => {
      const session = await tx.inventorySession.create({
        data: {
          organizationId: ctx.organizationId,
          shopId,
          type: type as "COMPLET" | "PARTIEL",
          categoryId: type === "PARTIEL" ? categoryId : null,
          userId: ctx.userId,
        },
      });

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "INVENTORY_SESSION_STARTED",
        entite: "inventory_session",
        entiteId: session.id,
        apres: { type, categoryId },
      });

      return session;
    },
  );

  redirect(`/inventory/${session.id}`);
}

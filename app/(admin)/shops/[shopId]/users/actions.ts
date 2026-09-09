"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";

export async function assignUserToShop(formData: FormData) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "shops:manage");

  const shopId = String(formData.get("shopId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!shopId || !userId) return;

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    await tx.userShop.upsert({
      where: { userId_shopId: { userId, shopId } },
      create: { organizationId: ctx.organizationId, userId, shopId },
      update: {},
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "USER_ASSIGNED_TO_SHOP",
      entite: "user_shop",
      entiteId: userId,
      apres: { shopId },
    });
  });

  revalidatePath(`/shops/${shopId}/users`);
}

export async function unassignUserFromShop(formData: FormData) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "shops:manage");

  const shopId = String(formData.get("shopId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!shopId || !userId) return;

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    // Jamais retirer la dernière boutique d'un utilisateur : getActiveShopId
    // lève une erreur dure si la liste devient vide, il vaut mieux ignorer
    // la demande que casser sa prochaine connexion.
    const count = await tx.userShop.count({ where: { userId } });
    if (count <= 1) return;

    await tx.userShop.delete({ where: { userId_shopId: { userId, shopId } } });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "USER_UNASSIGNED_FROM_SHOP",
      entite: "user_shop",
      entiteId: userId,
      apres: { shopId },
    });
  });

  revalidatePath(`/shops/${shopId}/users`);
}

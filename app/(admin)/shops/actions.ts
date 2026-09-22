"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { assertWithinQuota, QuotaExceededError } from "@/lib/quotas";
import { ACTIVE_SHOP_COOKIE_NAME } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

export type ShopFormState = { error: string | null };

export async function createShop(
  _prevState: ShopFormState,
  formData: FormData,
): Promise<ShopFormState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "shops:manage");

  const nom = String(formData.get("nom") ?? "").trim();
  const adresse = String(formData.get("adresse") ?? "").trim() || null;
  const telephone = String(formData.get("telephone") ?? "").trim() || null;

  if (!nom) {
    return { error: "Le nom de la boutique est requis." };
  }

  try {
    await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
      });
      await assertWithinQuota(tx, ctx.organizationId, organization.plan, "shops");

      const shop = await tx.shop.create({
        data: { organizationId: ctx.organizationId, nom, adresse, telephone },
      });

      // Sans ça, cette boutique n'a aucun poste de caisse et /caisse plante
      // (register.findFirstOrThrow) dès qu'un utilisateur qui y est affecté
      // essaie de vendre — bug réel constaté en production. Même poste par
      // défaut que celui créé à l'inscription
      // (app/platform/(authenticated)/new/actions.ts).
      await tx.register.create({
        data: { organizationId: ctx.organizationId, shopId: shop.id, nom: "Caisse 1", code: "C1" },
      });

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "SHOP_CREATED",
        entite: "shop",
        entiteId: shop.id,
        apres: { nom, adresse, telephone },
      });
    });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/shops");
  return { error: null };
}

export async function toggleShopActive(formData: FormData) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "shops:manage");

  const shopId = String(formData.get("shopId") ?? "");
  if (!shopId) return;

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const shop = await tx.shop.findUniqueOrThrow({ where: { id: shopId } });
    await tx.shop.update({ where: { id: shopId }, data: { actif: !shop.actif } });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: shop.actif ? "SHOP_DEACTIVATED" : "SHOP_ACTIVATED",
      entite: "shop",
      entiteId: shopId,
    });
  });

  revalidatePath("/shops");
}

export async function toggleShopTaxMode(formData: FormData) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "shops:manage");

  const shopId = String(formData.get("shopId") ?? "");
  if (!shopId) return;

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const shop = await tx.shop.findUniqueOrThrow({ where: { id: shopId } });
    await tx.shop.update({
      where: { id: shopId },
      data: { taxeRetenueSource: !shop.taxeRetenueSource },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "SHOP_TAX_MODE_CHANGED",
      entite: "shop",
      entiteId: shopId,
      avant: { taxeRetenueSource: shop.taxeRetenueSource },
      apres: { taxeRetenueSource: !shop.taxeRetenueSource },
    });
  });

  revalidatePath("/shops");
}

export async function setActiveShop(formData: FormData) {
  const ctx = await getTenantContext();
  const shopId = String(formData.get("shopId") ?? "");
  if (!shopId) return;

  // Jamais fait confiance sans validation : le cookie ne doit pointer que
  // vers une boutique à laquelle cet utilisateur est réellement affecté.
  const assignment = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.userShop.findUnique({ where: { userId_shopId: { userId: ctx.userId, shopId } } }),
  );
  if (!assignment) return;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_SHOP_COOKIE_NAME, shopId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });

  revalidatePath("/");
}

"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { systemPrisma } from "@/lib/db/system-client";
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

export type DeleteShopState = { error: string | null };

// Irréversible : supprime la boutique et TOUTES ses données propres (ventes,
// stock, caisses, achats, dépenses, transferts...). Réservé au Propriétaire
// (shops:delete, jamais partagé avec Gérant — voir lib/permissions.ts).
//
// systemPrisma (rôle propriétaire), pas withTenantContext : le rôle
// applicatif tacynt_app n'a jamais eu de droit DELETE (accordé nulle part
// dans prisma/rls-manifest.sql — l'app tenant ne supprime normalement
// jamais rien, chaque journal est append-only par conception). Même choix
// que la suppression d'organisation
// (app/platform/(authenticated)/organization-detail-actions.ts) : la RLS ne
// filtre donc plus rien, organizationId est explicite sur CHAQUE requête —
// c'est lui, pas la policy, qui garantit qu'on ne touche que cette
// organisation. deleteMany ordonné, enfants avant parents, table par table,
// plutôt qu'un cascade Prisma/SQL — chaque FK shop_id/from_shop_id/to_shop_id
// reste volontairement RESTRICT (décision verrouillée #10), donc l'ordre est
// obligatoire ou Postgres refuse chaque suppression avec une violation de
// contrainte. Les entités mutualisées au niveau de l'organisation (produits,
// catégories, clients, fournisseurs) ne sont jamais touchées ici.
export async function deleteShop(
  _prevState: DeleteShopState,
  formData: FormData,
): Promise<DeleteShopState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "shops:delete");

  const shopId = String(formData.get("shopId") ?? "");
  const confirmNom = String(formData.get("confirmNom") ?? "").trim();

  if (!shopId) {
    return { error: "Boutique requise." };
  }

  const result = await systemPrisma.$transaction(async (tx) => {
    const shop = await tx.shop.findUnique({ where: { id: shopId } });
    // organizationId vérifié explicitement : systemPrisma n'a aucune policy
    // RLS pour le faire à sa place.
    if (!shop || shop.organizationId !== ctx.organizationId) {
      return { error: "Boutique introuvable." };
    }
    // Revalidé côté serveur, jamais fait confiance à la seule désactivation
    // du bouton côté client — même garde que la suppression d'organisation.
    if (confirmNom !== shop.nom) {
      return { error: "Le texte de confirmation ne correspond pas au nom de la boutique." };
    }

    const shopCount = await tx.shop.count({ where: { organizationId: ctx.organizationId } });
    if (shopCount <= 1) {
      return { error: "Impossible de supprimer la dernière boutique de l'organisation." };
    }

    const openSession = await tx.cashSession.findFirst({
      where: { organizationId: ctx.organizationId, shopId, closedAt: null },
    });
    if (openSession) {
      return {
        error: "Fermez d'abord toutes les sessions de caisse ouvertes de cette boutique.",
      };
    }

    const where = { organizationId: ctx.organizationId, shopId };
    const transferWhere = {
      organizationId: ctx.organizationId,
      OR: [{ fromShopId: shopId }, { toShopId: shopId }],
    };

    // 1) Feuilles sans aucune autre table de cette boutique qui les référence.
    await tx.serialNumber.deleteMany({ where });
    await tx.stockAlert.deleteMany({ where });
    await tx.customerCategoryPrice.deleteMany({ where });
    await tx.shopPrice.deleteMany({ where });
    await tx.stockLevel.deleteMany({ where });
    await tx.stockMovement.deleteMany({ where });
    await tx.saleLine.deleteMany({ where });
    await tx.payment.deleteMany({ where });
    await tx.onlineOrderLine.deleteMany({ where });
    await tx.cashMovement.deleteMany({ where });
    await tx.expense.deleteMany({ where });
    await tx.inventoryCount.deleteMany({ where });
    await tx.purchaseOrderLine.deleteMany({ where });
    await tx.goodsReceiptLine.deleteMany({ where });
    await tx.stockTransferLine.deleteMany({ where: transferWhere });

    // 2) Devenues sans dépendant après (1).
    await tx.lot.deleteMany({ where }); // après stock_movements : stock_movements.lot_id -> lots
    await tx.onlineOrder.deleteMany({ where }); // avant sale : online_orders.sale_id -> sales
    await tx.sale.deleteMany({ where }); // avant cash_sessions : sales.session_id -> cash_sessions
    await tx.goodsReceipt.deleteMany({ where }); // avant purchase_orders : goods_receipts.purchase_order_id
    await tx.inventorySession.deleteMany({ where });
    await tx.stockTransfer.deleteMany({ where: transferWhere });

    // 3) Devenues sans dépendant après (2).
    await tx.purchaseOrder.deleteMany({ where });
    await tx.cashSession.deleteMany({ where });

    // 4) Devenue sans dépendant après (3).
    await tx.register.deleteMany({ where });

    // 5) N'importe quand : aucune autre table de cette boutique n'y réfère.
    await tx.userShop.deleteMany({ where });

    // 6) Plus rien ne référence la boutique.
    await tx.shop.delete({ where: { id: shopId } });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "SHOP_DELETED",
      entite: "shop",
      entiteId: shopId,
      apres: { nom: shop.nom },
    });

    return { error: null };
  });

  if (!result.error) {
    revalidatePath("/shops");
  }
  return result;
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

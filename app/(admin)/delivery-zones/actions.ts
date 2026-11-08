"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";

async function assertAllowed() {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "ecommerce:manage");
  const organization = await systemPrisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } });
  if (!organizationHasModule(organization.enabledModules, "ecommerce")) {
    throw new Error("Le module E-commerce n'est pas activé pour cette organisation.");
  }
  return ctx;
}

export async function createDeliveryZone(formData: FormData) {
  const ctx = await assertAllowed();

  const shopId = String(formData.get("shopId") ?? "");
  const nom = String(formData.get("nom") ?? "").trim().slice(0, 120);
  if (!shopId || !nom) throw new Error("Boutique et nom de la zone requis.");

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    // La boutique doit appartenir à l'organisation (RLS) — lève sinon.
    await tx.shop.findUniqueOrThrow({ where: { id: shopId } });

    const zone = await tx.deliveryZone.create({
      data: { organizationId: ctx.organizationId, shopId, nom },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "DELIVERY_ZONE_CREATED",
      entite: "delivery_zone",
      entiteId: zone.id,
      apres: { shopId, nom },
    });
  });

  revalidatePath("/delivery-zones");
}

// Panier minimum pour être livré (par boutique). Vide = aucun minimum.
export async function updateDeliveryMinimum(formData: FormData) {
  const ctx = await assertAllowed();

  const shopId = String(formData.get("shopId") ?? "");
  const raw = String(formData.get("montantMinimumLivraison") ?? "").replace(/\s/g, "").replace(",", ".");
  if (!shopId) return;
  const montant = raw === "" ? null : Number(raw);
  if (montant !== null && (!Number.isFinite(montant) || montant < 0)) {
    throw new Error("Montant minimum invalide.");
  }
  const value = montant === 0 ? null : montant;

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const shop = await tx.shop.findUniqueOrThrow({ where: { id: shopId } });
    await tx.shop.update({ where: { id: shopId }, data: { montantMinimumLivraison: value } });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "SHOP_DELIVERY_MINIMUM_CHANGED",
      entite: "shop",
      entiteId: shopId,
      avant: { montantMinimumLivraison: shop.montantMinimumLivraison === null ? null : Number(shop.montantMinimumLivraison) },
      apres: { montantMinimumLivraison: value },
    });
  });

  revalidatePath("/delivery-zones");
}

// Jamais de suppression : une zone se désactive (elle disparaît alors des
// choix proposés aux clients) et se réactive à volonté.
export async function toggleDeliveryZone(formData: FormData) {
  const ctx = await assertAllowed();

  const zoneId = String(formData.get("zoneId") ?? "");
  if (!zoneId) return;

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const zone = await tx.deliveryZone.findUniqueOrThrow({ where: { id: zoneId } });
    await tx.deliveryZone.update({ where: { id: zoneId }, data: { actif: !zone.actif } });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "DELIVERY_ZONE_TOGGLED",
      entite: "delivery_zone",
      entiteId: zoneId,
      avant: { actif: zone.actif },
      apres: { actif: !zone.actif },
    });
  });

  revalidatePath("/delivery-zones");
}

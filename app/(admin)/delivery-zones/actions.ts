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
  const frais = parseAmount(formData.get("frais"));
  if (!shopId || !nom) throw new Error("Boutique et nom de la zone requis.");
  if (frais === "invalide") throw new Error("Frais de livraison invalides.");

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    // La boutique doit appartenir à l'organisation (RLS) — lève sinon.
    await tx.shop.findUniqueOrThrow({ where: { id: shopId } });

    const zone = await tx.deliveryZone.create({
      data: { organizationId: ctx.organizationId, shopId, nom, frais: frais ?? 0 },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "DELIVERY_ZONE_CREATED",
      entite: "delivery_zone",
      entiteId: zone.id,
      apres: { shopId, nom, frais: frais ?? 0 },
    });
  });

  revalidatePath("/delivery-zones");
}

// Montant saisi dans un champ de formulaire : vide = null, sinon nombre >= 0.
function parseAmount(value: FormDataEntryValue | null): number | null | "invalide" {
  const raw = String(value ?? "").replace(/\s/g, "").replace(",", ".");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : "invalide";
}

export type DeliverySettingsState = { error: string | null; saved?: boolean };

// Paramètres de livraison d'une boutique (dialogue "Paramètres de
// livraison") : activation, panier minimum pour être livré, livraison
// offerte au-delà d'un montant (case + montant).
export async function updateDeliverySettings(
  _prev: DeliverySettingsState,
  formData: FormData,
): Promise<DeliverySettingsState> {
  const ctx = await assertAllowed();

  const shopId = String(formData.get("shopId") ?? "");
  if (!shopId) return { error: "Boutique introuvable." };

  const livraisonActive = formData.get("livraisonActive") === "on";
  const livraisonGratuiteActive = formData.get("livraisonGratuiteActive") === "on";
  const minimum = parseAmount(formData.get("montantMinimumLivraison"));
  const seuil = parseAmount(formData.get("montantLivraisonGratuite"));

  // Champs désactivés (livraison décochée) : non envoyés par le navigateur,
  // on conserve alors les valeurs déjà enregistrées.
  const fieldsSent = formData.has("montantMinimumLivraison");
  if (minimum === "invalide") return { error: "Panier minimum invalide." };
  if (seuil === "invalide") return { error: "Montant de livraison gratuite invalide." };
  if (fieldsSent && livraisonGratuiteActive && (seuil === null || seuil <= 0)) {
    return { error: "Indiquez le montant à partir duquel la livraison est gratuite." };
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const shop = await tx.shop.findUniqueOrThrow({ where: { id: shopId } });

    const data = fieldsSent
      ? {
          livraisonActive,
          montantMinimumLivraison: minimum === 0 ? null : minimum,
          livraisonGratuiteActive,
          montantLivraisonGratuite: livraisonGratuiteActive ? seuil : shop.montantLivraisonGratuite,
        }
      : { livraisonActive };

    await tx.shop.update({ where: { id: shopId }, data });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "SHOP_DELIVERY_SETTINGS_CHANGED",
      entite: "shop",
      entiteId: shopId,
      avant: {
        livraisonActive: shop.livraisonActive,
        montantMinimumLivraison: shop.montantMinimumLivraison === null ? null : Number(shop.montantMinimumLivraison),
        livraisonGratuiteActive: shop.livraisonGratuiteActive,
        montantLivraisonGratuite:
          shop.montantLivraisonGratuite === null ? null : Number(shop.montantLivraisonGratuite),
      },
      apres: {
        livraisonActive,
        montantMinimumLivraison: fieldsSent ? (minimum === 0 ? null : minimum) : "inchangé",
        livraisonGratuiteActive: fieldsSent ? livraisonGratuiteActive : "inchangé",
        montantLivraisonGratuite: fieldsSent && livraisonGratuiteActive ? seuil : "inchangé",
      },
    });
  });

  revalidatePath("/delivery-zones");
  return { error: null, saved: true };
}

// Prix de livraison d'une zone (0 = gratuit).
export async function updateZoneFrais(formData: FormData) {
  const ctx = await assertAllowed();

  const zoneId = String(formData.get("zoneId") ?? "");
  const frais = parseAmount(formData.get("frais"));
  if (!zoneId || frais === "invalide") return;

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const zone = await tx.deliveryZone.findUniqueOrThrow({ where: { id: zoneId } });
    await tx.deliveryZone.update({ where: { id: zoneId }, data: { frais: frais ?? 0 } });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "DELIVERY_ZONE_FEE_CHANGED",
      entite: "delivery_zone",
      entiteId: zoneId,
      avant: { frais: Number(zone.frais) },
      apres: { frais: frais ?? 0 },
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

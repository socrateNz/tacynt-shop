"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

export type ReceiveStockState = { error: string | null };

export async function receiveStock(
  _prevState: ReceiveStockState,
  formData: FormData,
): Promise<ReceiveStockState> {
  const ctx = await getTenantContext();
  assertCapability(ctx.role, "stock:write");

  const variantId = String(formData.get("variantId") ?? "");
  const quantite = Number(formData.get("quantite") ?? 0);
  const coutUnitaire = Number(formData.get("coutUnitaire") ?? 0);
  const motif = String(formData.get("motif") ?? "").trim() || null;

  if (
    !variantId ||
    !Number.isFinite(quantite) ||
    quantite <= 0 ||
    !Number.isFinite(coutUnitaire) ||
    coutUnitaire < 0
  ) {
    return { error: "Produit, quantité (positive) et coût unitaire (valide) sont requis." };
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
    const movement = await tx.stockMovement.create({
      data: {
        organizationId: ctx.organizationId,
        shopId,
        variantId,
        type: "RECEPTION",
        quantite, // positif : entrée (cf. commentaire sur le modèle)
        coutUnitaire,
        documentType: "reception_manuelle",
        userId: ctx.userId,
        motif,
      },
    });

    const current = await tx.stockLevel.findUnique({
      where: { variantId_shopId: { variantId, shopId } },
    });

    const stockActuel = current ? Number(current.quantite) : 0;
    const cumpActuel = current ? Number(current.cump) : 0;
    const nouvelleQuantite = stockActuel + quantite;
    // CUMP = (stock_actuel × CUMP_actuel + qté_entrée × prix_entrée) / (stock_actuel + qté_entrée)
    const nouveauCump = (stockActuel * cumpActuel + quantite * coutUnitaire) / nouvelleQuantite;

    await tx.stockLevel.upsert({
      where: { variantId_shopId: { variantId, shopId } },
      create: {
        organizationId: ctx.organizationId,
        variantId,
        shopId,
        quantite: nouvelleQuantite,
        cump: nouveauCump,
      },
      update: { quantite: nouvelleQuantite, cump: nouveauCump },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "STOCK_RECEIVED",
      entite: "stock_movement",
      entiteId: movement.id,
      apres: { variantId, quantite, coutUnitaire },
    });
  });

  revalidatePath("/stock/movements");
  return { error: null };
}

export type AdjustStockState = { error: string | null };

// Ajustement d'inventaire (section 5.2, sens ±) : comptage physique ou
// casse/perte/vol. Le CUMP ne bouge jamais sur un ajustement — on n'a pas de
// nouveau prix d'achat à intégrer, seule la quantité change.
export async function adjustStock(
  _prevState: AdjustStockState,
  formData: FormData,
): Promise<AdjustStockState> {
  const ctx = await getTenantContext();
  assertCapability(ctx.role, "stock:write");

  const variantId = String(formData.get("variantId") ?? "");
  const delta = Number(formData.get("delta") ?? NaN);
  const motif = String(formData.get("motif") ?? "").trim();

  if (!variantId || !Number.isFinite(delta) || delta === 0 || !motif) {
    return { error: "Produit, écart (non nul) et motif sont requis." };
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
    const current = await tx.stockLevel.findUnique({
      where: { variantId_shopId: { variantId, shopId } },
    });
    const stockActuel = current ? Number(current.quantite) : 0;
    const cumpActuel = current ? Number(current.cump) : 0;
    const nouvelleQuantite = stockActuel + delta;

    const movement = await tx.stockMovement.create({
      data: {
        organizationId: ctx.organizationId,
        shopId,
        variantId,
        type: "AJUSTEMENT",
        quantite: delta,
        coutUnitaire: cumpActuel,
        documentType: "ajustement_inventaire",
        userId: ctx.userId,
        motif,
      },
    });

    await tx.stockLevel.upsert({
      where: { variantId_shopId: { variantId, shopId } },
      create: {
        organizationId: ctx.organizationId,
        variantId,
        shopId,
        quantite: nouvelleQuantite,
        cump: cumpActuel,
      },
      update: { quantite: nouvelleQuantite },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "STOCK_ADJUSTED",
      entite: "stock_movement",
      entiteId: movement.id,
      apres: { variantId, delta, motif },
    });
  });

  revalidatePath("/stock/movements");
  return { error: null };
}

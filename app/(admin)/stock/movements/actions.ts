"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { adjustStockQuantity, creditStock } from "@/lib/stock/movements";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

export type ReceiveStockState = { error: string | null };

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function receiveStock(
  _prevState: ReceiveStockState,
  formData: FormData,
): Promise<ReceiveStockState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "stock:write");

  const variantId = String(formData.get("variantId") ?? "");
  const quantite = Number(formData.get("quantite") ?? 0);
  const coutUnitaire = Number(formData.get("coutUnitaire") ?? 0);
  const motif = String(formData.get("motif") ?? "").trim() || null;
  // Optionnels même pour un produit à suiviLots=true (section M22) : ne pas
  // les renseigner ne bloque pas la réception, l'entrée reste comptée
  // normalement, simplement sans traçabilité de péremption pour cette
  // quantité — cohérent avec le principe de ne jamais bloquer une opération
  // de stock déjà appliquée.
  const lotNumero = String(formData.get("lotNumero") ?? "").trim() || null;
  const datePeremptionRaw = String(formData.get("datePeremption") ?? "").trim();
  const datePeremption = datePeremptionRaw ? new Date(datePeremptionRaw) : null;
  // Optionnel, un numéro par unité (Phase 3 M23) : contrairement au lot (une
  // quantité pour N unités), chaque numéro de série identifie une seule
  // unité — la quantité reçue et le nombre de numéros doivent donc
  // correspondre exactement quand des numéros sont saisis.
  const serialNumbersRaw = String(formData.get("serialNumbers") ?? "");
  const serialNumbers = serialNumbersRaw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (
    !variantId ||
    !Number.isFinite(quantite) ||
    quantite <= 0 ||
    !Number.isFinite(coutUnitaire) ||
    coutUnitaire < 0
  ) {
    return { error: "Produit, quantité (positive) et coût unitaire (valide) sont requis." };
  }

  if (serialNumbers.length > 0 && serialNumbers.length !== quantite) {
    return {
      error: `${serialNumbers.length} numéro(s) de série saisi(s) pour une quantité reçue de ${quantite} — les deux doivent correspondre.`,
    };
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  try {
    await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
      let lotId: string | null = null;
      if (lotNumero) {
        const lot = await tx.lot.upsert({
          where: { variantId_shopId_numero: { variantId, shopId, numero: lotNumero } },
          create: {
            organizationId: ctx.organizationId,
            shopId,
            variantId,
            numero: lotNumero,
            datePeremption,
            quantite,
          },
          update: { quantite: { increment: quantite }, ...(datePeremption ? { datePeremption } : {}) },
        });
        lotId = lot.id;
      }

      const { movement } = await creditStock(tx, {
        organizationId: ctx.organizationId,
        shopId,
        variantId,
        quantite,
        coutUnitaire,
        documentType: "reception_manuelle",
        userId: ctx.userId,
        motif,
        lotId,
      });

      if (serialNumbers.length > 0) {
        await tx.serialNumber.createMany({
          data: serialNumbers.map((numero) => ({
            organizationId: ctx.organizationId,
            shopId,
            variantId,
            numero,
          })),
        });
      }

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "STOCK_RECEIVED",
        entite: "stock_movement",
        entiteId: movement.id,
        apres: { variantId, quantite, coutUnitaire, lotNumero, serialNumbers },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "Un ou plusieurs numéros de série existent déjà." };
    }
    throw error;
  }

  revalidatePath("/stock/movements");
  return { error: null };
}

export type AdjustStockState = { error: string | null };

// Ajustement d'inventaire (section 5.2, sens ±) : comptage physique ou
// casse/perte/vol. Le CUMP ne bouge jamais sur un ajustement.
export async function adjustStock(
  _prevState: AdjustStockState,
  formData: FormData,
): Promise<AdjustStockState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "stock:write");

  const variantId = String(formData.get("variantId") ?? "");
  const delta = Number(formData.get("delta") ?? NaN);
  const motif = String(formData.get("motif") ?? "").trim();

  if (!variantId || !Number.isFinite(delta) || delta === 0 || !motif) {
    return { error: "Produit, écart (non nul) et motif sont requis." };
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
    const { movement } = await adjustStockQuantity(tx, {
      organizationId: ctx.organizationId,
      shopId,
      variantId,
      delta,
      documentType: "ajustement_inventaire",
      userId: ctx.userId,
      motif,
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

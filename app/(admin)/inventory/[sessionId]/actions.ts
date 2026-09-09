"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions";
import { adjustStockQuantity } from "@/lib/stock/movements";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

export type InventoryCountState = { error: string | null };

export async function recordInventoryCount(
  _prevState: InventoryCountState,
  formData: FormData,
): Promise<InventoryCountState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "inventory:manage");

  const inventorySessionId = String(formData.get("inventorySessionId") ?? "");
  const variantId = String(formData.get("variantId") ?? "");
  const quantiteComptee = Number(formData.get("quantiteComptee") ?? NaN);

  if (!inventorySessionId || !variantId || !Number.isFinite(quantiteComptee) || quantiteComptee < 0) {
    return { error: "Quantité comptée (positive ou nulle) requise." };
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  const session = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    (tx) => tx.inventorySession.findUniqueOrThrow({ where: { id: inventorySessionId } }),
  );
  if (session.statut !== "EN_COURS") {
    return { error: "Cet inventaire n'est plus en cours." };
  }

  await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
    // Figé à l'instant précis du comptage de CETTE ligne, jamais à
    // l'ouverture de la session — la boutique continue de vendre pendant ce
    // temps (section M16).
    const stockLevel = await tx.stockLevel.findUnique({
      where: { variantId_shopId: { variantId, shopId } },
    });
    const quantiteTheorique = stockLevel ? Number(stockLevel.quantite) : 0;
    const cumpAuComptage = stockLevel ? Number(stockLevel.cump) : 0;

    await tx.inventoryCount.upsert({
      where: { inventorySessionId_variantId: { inventorySessionId, variantId } },
      create: {
        organizationId: ctx.organizationId,
        shopId,
        inventorySessionId,
        variantId,
        quantiteTheorique,
        quantiteComptee,
        cumpAuComptage,
        comptePar: ctx.userId,
        comptedAt: new Date(),
      },
      update: {
        quantiteTheorique,
        quantiteComptee,
        cumpAuComptage,
        comptePar: ctx.userId,
        comptedAt: new Date(),
      },
    });
  });

  revalidatePath(`/inventory/${inventorySessionId}`);
  return { error: null };
}

export async function validateInventorySession(formData: FormData) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "inventory:manage");

  const inventorySessionId = String(formData.get("inventorySessionId") ?? "");
  if (!inventorySessionId) return;

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
    const session = await tx.inventorySession.findUniqueOrThrow({
      where: { id: inventorySessionId },
    });
    if (session.statut !== "EN_COURS") return;

    const counts = await tx.inventoryCount.findMany({
      where: { inventorySessionId, quantiteComptee: { not: null } },
    });

    let adjustedLines = 0;
    for (const count of counts) {
      const delta = Number(count.quantiteComptee) - Number(count.quantiteTheorique);
      if (delta === 0) continue;

      // Le delta est figé au moment du comptage de cette ligne : il vient
      // s'additionner à l'état courant du stock (qui peut avoir bougé
      // depuis, ventes normales incluses), jamais l'écraser — c'est ce qui
      // rend le comptage cohérent même si la boutique a vendu entre-temps.
      await adjustStockQuantity(tx, {
        organizationId: ctx.organizationId,
        shopId,
        variantId: count.variantId,
        delta,
        documentType: "inventory_session",
        documentId: session.id,
        userId: ctx.userId,
        motif: `Écart d'inventaire (${session.type})`,
      });
      adjustedLines += 1;
    }

    await tx.inventorySession.update({
      where: { id: session.id },
      data: { statut: "VALIDEE", validatedAt: new Date() },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "INVENTORY_SESSION_VALIDATED",
      entite: "inventory_session",
      entiteId: session.id,
      apres: { countedLines: counts.length, adjustedLines },
    });
  });

  revalidatePath(`/inventory/${inventorySessionId}`);
  revalidatePath("/inventory");
}

export async function cancelInventorySession(formData: FormData) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "inventory:manage");

  const inventorySessionId = String(formData.get("inventorySessionId") ?? "");
  if (!inventorySessionId) return;

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const session = await tx.inventorySession.findUniqueOrThrow({
      where: { id: inventorySessionId },
    });
    if (session.statut !== "EN_COURS") return;

    await tx.inventorySession.update({
      where: { id: session.id },
      data: { statut: "ANNULEE" },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "INVENTORY_SESSION_CANCELLED",
      entite: "inventory_session",
      entiteId: session.id,
    });
  });

  revalidatePath(`/inventory/${inventorySessionId}`);
  revalidatePath("/inventory");
}

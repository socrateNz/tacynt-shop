"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { creditStock } from "@/lib/stock/movements";
import { recordSupplierLedgerEntry } from "@/lib/suppliers/ledger";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

export type ReceiveGoodsState = { error: string | null };

export async function receiveGoods(
  _prevState: ReceiveGoodsState,
  formData: FormData,
): Promise<ReceiveGoodsState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "purchasing:manage");

  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  const variantIds = formData.getAll("lineVariantId") as string[];
  const quantites = formData.getAll("lineQuantiteRecue") as string[];
  const prix = formData.getAll("linePrixUnitaireRecu") as string[];

  const lines = variantIds
    .map((variantId, i) => ({
      variantId,
      quantiteRecue: Number(quantites[i]),
      prixUnitaireRecu: Number(prix[i]),
    }))
    .filter((l) => Number.isFinite(l.quantiteRecue) && l.quantiteRecue > 0);

  if (!purchaseOrderId || lines.length === 0) {
    return { error: "Au moins une ligne avec une quantité reçue (positive) est requise." };
  }
  if (lines.some((l) => !Number.isFinite(l.prixUnitaireRecu) || l.prixUnitaireRecu < 0)) {
    return { error: "Prix unitaire reçu invalide sur au moins une ligne." };
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
    const po = await tx.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrderId },
      include: { lines: true },
    });

    const count = await tx.goodsReceipt.count({ where: { organizationId: ctx.organizationId } });
    const numero = `REC-${String(count + 1).padStart(6, "0")}`;

    const receipt = await tx.goodsReceipt.create({
      data: {
        organizationId: ctx.organizationId,
        shopId,
        supplierId: po.supplierId,
        purchaseOrderId: po.id,
        numero,
        userId: ctx.userId,
      },
    });

    let totalRecu = 0;
    for (const line of lines) {
      await tx.goodsReceiptLine.create({
        data: {
          organizationId: ctx.organizationId,
          shopId,
          goodsReceiptId: receipt.id,
          variantId: line.variantId,
          quantiteRecue: line.quantiteRecue,
          prixUnitaireRecu: line.prixUnitaireRecu,
        },
      });

      // Entrée de stock valorisée : le CUMP se recalcule sur cette réception,
      // même mécanique que la réception manuelle (lib/stock/movements.ts).
      await creditStock(tx, {
        organizationId: ctx.organizationId,
        shopId,
        variantId: line.variantId,
        quantite: line.quantiteRecue,
        coutUnitaire: line.prixUnitaireRecu,
        documentType: "goods_receipt",
        documentId: receipt.id,
        userId: ctx.userId,
      });

      // Dernier prix d'achat connu (section M14) : mis à jour à chaque
      // réception, indépendamment des commandes/réceptions futures.
      await tx.supplierProduct.upsert({
        where: { supplierId_variantId: { supplierId: po.supplierId, variantId: line.variantId } },
        create: {
          organizationId: ctx.organizationId,
          supplierId: po.supplierId,
          variantId: line.variantId,
          prixAchatDernier: line.prixUnitaireRecu,
        },
        update: { prixAchatDernier: line.prixUnitaireRecu },
      });

      totalRecu += line.quantiteRecue * line.prixUnitaireRecu;
    }

    await recordSupplierLedgerEntry(tx, {
      organizationId: ctx.organizationId,
      supplierId: po.supplierId,
      type: "RECEPTION",
      montant: totalRecu,
      documentType: "goods_receipt",
      documentId: receipt.id,
      userId: ctx.userId,
    });

    // Statut recalculé sur le cumul réel des réceptions liées à cette
    // commande, pas seulement ce dernier lot (une commande reçue en
    // plusieurs fois doit converger vers RECUE_COMPLETE une fois tout reçu).
    const allReceiptLines = await tx.goodsReceiptLine.findMany({
      where: { goodsReceipt: { purchaseOrderId: po.id } },
    });
    const receivedByVariant = new Map<string, number>();
    for (const l of allReceiptLines) {
      receivedByVariant.set(
        l.variantId,
        (receivedByVariant.get(l.variantId) ?? 0) + Number(l.quantiteRecue),
      );
    }
    const fullyReceived = po.lines.every(
      (l) => (receivedByVariant.get(l.variantId) ?? 0) >= Number(l.quantiteCommandee),
    );

    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { statut: fullyReceived ? "RECUE_COMPLETE" : "RECUE_PARTIELLE" },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "GOODS_RECEIVED",
      entite: "goods_receipt",
      entiteId: receipt.id,
      apres: { purchaseOrderId: po.id, numero, totalRecu, fullyReceived },
    });
  });

  revalidatePath(`/purchase-orders/${purchaseOrderId}/receive`);
  revalidatePath(`/suppliers`);
  return { error: null };
}

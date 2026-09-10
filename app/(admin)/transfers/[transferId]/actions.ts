"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { adjustStockQuantity, creditStock } from "@/lib/stock/movements";
import { getTenantContext } from "@/lib/tenant/context";

export type ShipTransferState = { error: string | null };

export async function shipTransfer(
  _prevState: ShipTransferState,
  formData: FormData,
): Promise<ShipTransferState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "transfers:manage");

  const transferId = String(formData.get("transferId") ?? "");
  const lineIds = formData.getAll("lineId") as string[];
  const quantites = formData.getAll("lineQuantiteExpediee") as string[];

  const lines = lineIds
    .map((lineId, i) => ({ lineId, quantiteExpediee: Number(quantites[i]) }))
    .filter((l) => Number.isFinite(l.quantiteExpediee) && l.quantiteExpediee > 0);

  if (!transferId || lines.length === 0) {
    return { error: "Au moins une ligne avec une quantité expédiée (positive) est requise." };
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const transfer = await tx.stockTransfer.findUniqueOrThrow({ where: { id: transferId } });
    if (transfer.statut !== "DEMANDE") return;

    for (const line of lines) {
      const transferLine = await tx.stockTransferLine.findUniqueOrThrow({ where: { id: line.lineId } });

      // Coût figé au moment de l'expédition : la boutique destinataire
      // hérite du coût réel de la boutique émettrice (lib/stock/movements.ts).
      const stockLevel = await tx.stockLevel.findUnique({
        where: { variantId_shopId: { variantId: transferLine.variantId, shopId: transfer.fromShopId } },
      });
      const coutUnitaireExpedition = stockLevel ? Number(stockLevel.cump) : 0;

      await adjustStockQuantity(tx, {
        organizationId: ctx.organizationId,
        shopId: transfer.fromShopId,
        variantId: transferLine.variantId,
        delta: -line.quantiteExpediee,
        type: "TRANSFERT_SORTANT",
        documentType: "stock_transfer",
        documentId: transfer.id,
        userId: ctx.userId,
        motif: `Expédition transfert ${transfer.numero}`,
      });

      await tx.stockTransferLine.update({
        where: { id: line.lineId },
        data: { quantiteExpediee: line.quantiteExpediee, coutUnitaireExpedition },
      });
    }

    await tx.stockTransfer.update({ where: { id: transferId }, data: { statut: "EXPEDIE" } });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "STOCK_TRANSFER_SHIPPED",
      entite: "stock_transfer",
      entiteId: transferId,
      apres: { lineCount: lines.length },
    });
  });

  revalidatePath(`/transfers/${transferId}`);
  revalidatePath("/transfers");
  return { error: null };
}

export type ReceiveTransferState = { error: string | null };

export async function receiveTransfer(
  _prevState: ReceiveTransferState,
  formData: FormData,
): Promise<ReceiveTransferState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "transfers:manage");

  const transferId = String(formData.get("transferId") ?? "");
  const lineIds = formData.getAll("lineId") as string[];
  const quantites = formData.getAll("lineQuantiteRecue") as string[];

  const lines = lineIds
    .map((lineId, i) => ({ lineId, quantiteRecue: Number(quantites[i]) }))
    .filter((l) => Number.isFinite(l.quantiteRecue) && l.quantiteRecue >= 0);

  if (!transferId || lines.length === 0) {
    return { error: "Au moins une ligne avec une quantité reçue (positive ou nulle) est requise." };
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const transfer = await tx.stockTransfer.findUniqueOrThrow({ where: { id: transferId } });
    if (transfer.statut !== "EXPEDIE") return;

    for (const line of lines) {
      if (line.quantiteRecue <= 0) continue;
      const transferLine = await tx.stockTransferLine.findUniqueOrThrow({ where: { id: line.lineId } });

      await creditStock(tx, {
        organizationId: ctx.organizationId,
        shopId: transfer.toShopId,
        variantId: transferLine.variantId,
        quantite: line.quantiteRecue,
        coutUnitaire: Number(transferLine.coutUnitaireExpedition ?? 0),
        type: "TRANSFERT_ENTRANT",
        documentType: "stock_transfer",
        documentId: transfer.id,
        userId: ctx.userId,
        motif: `Réception transfert ${transfer.numero}`,
      });

      await tx.stockTransferLine.update({
        where: { id: line.lineId },
        data: { quantiteRecue: line.quantiteRecue },
      });

      // Écart constaté (perte en transit) : jamais silencieux — la ligne
      // enregistre la quantité réellement reçue, un audit log trace l'écart
      // pour investigation, sans jamais bloquer la réception (section 5.2 :
      // même principe que le stock négatif après resynchronisation).
      const expediee = Number(transferLine.quantiteExpediee ?? 0);
      if (line.quantiteRecue !== expediee) {
        await recordAuditLog(tx, {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          action: "STOCK_TRANSFER_DISCREPANCY",
          entite: "stock_transfer_line",
          entiteId: line.lineId,
          apres: {
            variantId: transferLine.variantId,
            quantiteExpediee: expediee,
            quantiteRecue: line.quantiteRecue,
            ecart: line.quantiteRecue - expediee,
          },
        });
      }
    }

    await tx.stockTransfer.update({ where: { id: transferId }, data: { statut: "RECU" } });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "STOCK_TRANSFER_RECEIVED",
      entite: "stock_transfer",
      entiteId: transferId,
      apres: { lineCount: lines.length },
    });
  });

  revalidatePath(`/transfers/${transferId}`);
  revalidatePath("/transfers");
  return { error: null };
}

export async function cancelTransfer(formData: FormData) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "transfers:manage");

  const transferId = String(formData.get("transferId") ?? "");
  if (!transferId) return;

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const transfer = await tx.stockTransfer.findUniqueOrThrow({ where: { id: transferId } });
    if (transfer.statut !== "DEMANDE") return;

    await tx.stockTransfer.update({ where: { id: transferId }, data: { statut: "ANNULE" } });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "STOCK_TRANSFER_CANCELLED",
      entite: "stock_transfer",
      entiteId: transferId,
    });
  });

  revalidatePath(`/transfers/${transferId}`);
  revalidatePath("/transfers");
}

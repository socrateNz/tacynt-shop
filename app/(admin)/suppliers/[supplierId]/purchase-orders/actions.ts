"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

export type PurchaseOrderFormState = { error: string | null };

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function createPurchaseOrder(
  _prevState: PurchaseOrderFormState,
  formData: FormData,
): Promise<PurchaseOrderFormState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "purchasing:manage");

  const supplierId = String(formData.get("supplierId") ?? "");
  const variantIds = formData.getAll("lineVariantId") as string[];
  const quantites = formData.getAll("lineQuantite") as string[];
  const prix = formData.getAll("linePrixUnitaire") as string[];

  const lines = variantIds
    .map((variantId, i) => ({
      variantId,
      quantiteCommandee: Number(quantites[i]),
      prixUnitaireCommande: Number(prix[i]),
    }))
    .filter((l) => l.variantId && Number.isFinite(l.quantiteCommandee) && l.quantiteCommandee > 0);

  if (!supplierId || lines.length === 0) {
    return { error: "Fournisseur et au moins une ligne (quantité positive) requis." };
  }
  if (lines.some((l) => !Number.isFinite(l.prixUnitaireCommande) || l.prixUnitaireCommande < 0)) {
    return { error: "Prix unitaire invalide sur au moins une ligne." };
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  try {
    await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
      const count = await tx.purchaseOrder.count({ where: { organizationId: ctx.organizationId } });
      const numero = `CMD-${String(count + 1).padStart(6, "0")}`;

      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          organizationId: ctx.organizationId,
          shopId,
          supplierId,
          numero,
          userId: ctx.userId,
        },
      });

      for (const line of lines) {
        await tx.purchaseOrderLine.create({
          data: {
            organizationId: ctx.organizationId,
            shopId,
            purchaseOrderId: purchaseOrder.id,
            variantId: line.variantId,
            quantiteCommandee: line.quantiteCommandee,
            prixUnitaireCommande: line.prixUnitaireCommande,
          },
        });
      }

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "PURCHASE_ORDER_CREATED",
        entite: "purchase_order",
        entiteId: purchaseOrder.id,
        apres: { supplierId, numero, lineCount: lines.length },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "Conflit de numéro de commande, réessayez." };
    }
    throw error;
  }

  revalidatePath(`/suppliers/${supplierId}/purchase-orders`);
  return { error: null };
}

export async function sendPurchaseOrder(formData: FormData) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "purchasing:manage");

  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  const supplierId = String(formData.get("supplierId") ?? "");
  if (!purchaseOrderId) return;

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const po = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrderId } });
    if (po.statut !== "BROUILLON") return;

    await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { statut: "ENVOYEE" } });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "PURCHASE_ORDER_SENT",
      entite: "purchase_order",
      entiteId: purchaseOrderId,
    });
  });

  revalidatePath(`/suppliers/${supplierId}/purchase-orders`);
}

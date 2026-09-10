"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { getTenantContext } from "@/lib/tenant/context";

export type TransferFormState = { error: string | null };

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

// Le transfert touche deux boutiques : withTenantContext est appelé SANS
// shopId (app.shop_id reste NULL), la policy RLS dédiée (rls-manifest.sql)
// autorise alors l'écriture quelle que soit la boutique active — les deux
// boutiques réelles viennent des champs explicites du formulaire, pas du
// sélecteur de boutique active de l'en-tête.
export async function createTransferRequest(
  _prevState: TransferFormState,
  formData: FormData,
): Promise<TransferFormState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "transfers:manage");

  const fromShopId = String(formData.get("fromShopId") ?? "");
  const toShopId = String(formData.get("toShopId") ?? "");
  const variantIds = formData.getAll("lineVariantId") as string[];
  const quantites = formData.getAll("lineQuantite") as string[];

  const lines = variantIds
    .map((variantId, i) => ({ variantId, quantiteDemandee: Number(quantites[i]) }))
    .filter((l) => l.variantId && Number.isFinite(l.quantiteDemandee) && l.quantiteDemandee > 0);

  if (!fromShopId || !toShopId || fromShopId === toShopId || lines.length === 0) {
    return {
      error: "Boutique émettrice, boutique destinataire (différentes) et au moins une ligne sont requises.",
    };
  }

  try {
    await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
      const count = await tx.stockTransfer.count({ where: { organizationId: ctx.organizationId } });
      const numero = `TR-${String(count + 1).padStart(6, "0")}`;

      const transfer = await tx.stockTransfer.create({
        data: { organizationId: ctx.organizationId, fromShopId, toShopId, numero, userId: ctx.userId },
      });

      for (const line of lines) {
        await tx.stockTransferLine.create({
          data: {
            organizationId: ctx.organizationId,
            fromShopId,
            toShopId,
            stockTransferId: transfer.id,
            variantId: line.variantId,
            quantiteDemandee: line.quantiteDemandee,
          },
        });
      }

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "STOCK_TRANSFER_REQUESTED",
        entite: "stock_transfer",
        entiteId: transfer.id,
        apres: { fromShopId, toShopId, numero, lineCount: lines.length },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "Conflit de numéro de transfert, réessayez." };
    }
    throw error;
  }

  revalidatePath("/transfers");
  return { error: null };
}

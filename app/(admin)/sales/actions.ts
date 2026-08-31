"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

export type CancelSaleState = { error: string | null };

// "Annulation d'un ticket : uniquement par un profil autorisé, motif
// obligatoire, ticket conservé au statut « annulé » — jamais effacé"
// (section 5.3). Les lignes de stock suivi sont réintégrées par un
// mouvement inverse (jamais une édition du mouvement de vente d'origine).
export async function cancelSale(
  _prevState: CancelSaleState,
  formData: FormData,
): Promise<CancelSaleState> {
  const ctx = await getTenantContext();
  assertCapability(ctx.role, "pos:cancel_ticket");

  const saleId = String(formData.get("saleId") ?? "");
  const motif = String(formData.get("motif") ?? "").trim();

  if (!saleId || !motif) {
    return { error: "Motif d'annulation obligatoire." };
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  try {
    await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
      const sale = await tx.sale.findUniqueOrThrow({
        where: { id: saleId },
        include: { lines: { include: { variant: { include: { product: true } } } } },
      });

      if (sale.statut !== "VALIDEE") {
        throw new Error("ALREADY_CANCELLED");
      }

      await tx.sale.update({ where: { id: saleId }, data: { statut: "ANNULEE" } });

      for (const line of sale.lines) {
        if (!line.variant.product.suiviStock) continue;

        const current = await tx.stockLevel.findUnique({
          where: { variantId_shopId: { variantId: line.variantId, shopId } },
        });
        const cumpActuel = current ? Number(current.cump) : 0;
        const quantiteActuelle = current ? Number(current.quantite) : 0;
        const nouvelleQuantite = quantiteActuelle + Number(line.quantite);

        await tx.stockMovement.create({
          data: {
            organizationId: ctx.organizationId,
            shopId,
            variantId: line.variantId,
            type: "RETOUR_CLIENT",
            quantite: Number(line.quantite), // positif : retour en stock
            // CUMP courant, pas le coût figé d'origine : l'annulation ne
            // doit pas fausser rétroactivement le coût moyen (même logique
            // que l'ajustement d'inventaire).
            coutUnitaire: cumpActuel,
            documentType: "sale_cancellation",
            documentId: sale.id,
            userId: ctx.userId,
            motif,
          },
        });

        await tx.stockLevel.upsert({
          where: { variantId_shopId: { variantId: line.variantId, shopId } },
          create: {
            organizationId: ctx.organizationId,
            variantId: line.variantId,
            shopId,
            quantite: nouvelleQuantite,
            cump: cumpActuel,
          },
          update: { quantite: nouvelleQuantite },
        });
      }

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "SALE_CANCELLED",
        entite: "sale",
        entiteId: sale.id,
        avant: { statut: "VALIDEE" },
        apres: { statut: "ANNULEE", motif },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_CANCELLED") {
      return { error: "Ce ticket est déjà annulé." };
    }
    throw error;
  }

  revalidatePath("/sales");
  return { error: null };
}

"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions";
import { assertWithinQuota, QuotaExceededError } from "@/lib/quotas";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

export type ProductFormState = { error: string | null };

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function createProduct(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const ctx = await getTenantContext();
  assertCapability(ctx.role, "catalog:write");

  const reference = String(formData.get("reference") ?? "").trim();
  const designation = String(formData.get("designation") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const unite = String(formData.get("unite") ?? "piece").trim() || "piece";
  const tauxTaxe = Number(formData.get("tauxTaxe") ?? 0);
  const suiviStock = formData.get("suiviStock") === "on";
  const codeBarres = String(formData.get("codeBarres") ?? "").trim() || null;
  const prixAchatRef = Number(formData.get("prixAchatRef") ?? 0);
  const prixVente = Number(formData.get("prixVente") ?? 0);
  const prixPlancherRaw = String(formData.get("prixPlancher") ?? "").trim();
  const prixPlancher = prixPlancherRaw ? Number(prixPlancherRaw) : null;
  const seuilAlerteRaw = String(formData.get("seuilAlerte") ?? "").trim();
  const seuilAlerte = seuilAlerteRaw ? Number(seuilAlerteRaw) : null;

  if (!reference || !designation || !Number.isFinite(prixVente) || prixVente < 0) {
    return { error: "Référence, désignation et prix de vente (valide) sont requis." };
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  try {
    await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
      });
      await assertWithinQuota(tx, ctx.organizationId, organization.plan, "products");

      const product = await tx.product.create({
        data: {
          organizationId: ctx.organizationId,
          reference,
          designation,
          categoryId,
          unite,
          tauxTaxe,
          suiviStock,
        },
      });

      // Catalogue simple (Phase 1) : chaque produit reçoit une variante par
      // défaut. Les vraies variantes (taille/couleur) arrivent en Phase 2 —
      // mais stock/prix/code-barres s'accrochent toujours à une variante,
      // jamais directement au produit (cf. modèle de données section 10).
      const variant = await tx.productVariant.create({
        data: {
          organizationId: ctx.organizationId,
          productId: product.id,
          codeBarres,
          prixAchatRef,
        },
      });

      await tx.shopPrice.create({
        data: {
          organizationId: ctx.organizationId,
          variantId: variant.id,
          shopId,
          prixVente,
          prixPlancher,
          seuilAlerte,
        },
      });

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "PRODUCT_CREATED",
        entite: "product",
        entiteId: product.id,
        apres: { reference, designation, prixVente },
      });
    });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return { error: error.message };
    }
    if (isUniqueViolation(error)) {
      return { error: "Cette référence ou ce code-barres existe déjà." };
    }
    throw error;
  }

  revalidatePath("/catalog/products");
  return { error: null };
}

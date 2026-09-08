"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

export type VariantFormState = { error: string | null };

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function createVariant(
  _prevState: VariantFormState,
  formData: FormData,
): Promise<VariantFormState> {
  const ctx = await getTenantContext();
  assertCapability(ctx.role, "catalog:write");

  const productId = String(formData.get("productId") ?? "");
  const attributeNames = formData.getAll("attributeName") as string[];
  const attributeValues = formData.getAll("attributeValue") as string[];
  const codeBarres = String(formData.get("codeBarres") ?? "").trim() || null;
  const prixAchatRef = Number(formData.get("prixAchatRef") ?? 0);
  const prixVente = Number(formData.get("prixVente") ?? 0);
  const prixPlancherRaw = String(formData.get("prixPlancher") ?? "").trim();
  const prixPlancher = prixPlancherRaw ? Number(prixPlancherRaw) : null;
  const seuilAlerteRaw = String(formData.get("seuilAlerte") ?? "").trim();
  const seuilAlerte = seuilAlerteRaw ? Number(seuilAlerteRaw) : null;

  if (!productId || !Number.isFinite(prixVente) || prixVente < 0) {
    return { error: "Produit et prix de vente (valide) sont requis." };
  }

  // Attributs libres (clé/valeur) : le modèle reste générique, aucune
  // liste d'attributs codée en dur (section 5.1).
  const attributs: Record<string, string> = {};
  attributeNames.forEach((name, i) => {
    const trimmedName = name.trim();
    const value = (attributeValues[i] ?? "").trim();
    if (trimmedName && value) attributs[trimmedName] = value;
  });

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  try {
    await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
      const variant = await tx.productVariant.create({
        data: {
          organizationId: ctx.organizationId,
          productId,
          attributs,
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
        action: "VARIANT_CREATED",
        entite: "product_variant",
        entiteId: variant.id,
        apres: { productId, attributs, codeBarres, prixVente },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "Ce code-barres existe déjà." };
    }
    throw error;
  }

  revalidatePath(`/catalog/products/${productId}/variants`);
  return { error: null };
}

export async function deactivateVariant(formData: FormData) {
  const ctx = await getTenantContext();
  assertCapability(ctx.role, "catalog:write");

  const variantId = String(formData.get("variantId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  if (!variantId) return;

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    await tx.productVariant.update({ where: { id: variantId }, data: { actif: false } });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "VARIANT_DEACTIVATED",
      entite: "product_variant",
      entiteId: variantId,
    });
  });

  revalidatePath(`/catalog/products/${productId}/variants`);
}
